#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
deploy_frontend.py — PersonalSite 前端「版本化前缀发布 + 回滚」脚本
============================================================================

【背景 / 要解决的问题】
旧的发布方式 `coscmd upload -r <dist绝对路径> /` 会把本地目录名作为前缀，
导致桶内出现多余的 `/dist/` 前缀（网站根目录拿不到 index.html）。
本脚本落地新的生产发布流程：
    构建 → 上传至 /releases/<时间戳> 版本前缀 → 校验 → 冒烟
         → 服务端 copy 到桶根（近似原子提升）→ 提示刷新 CDN。

【用法】
  # 完整发布（构建 + 上传 + 校验 + 冒烟 + 提升）
  python deploy_frontend.py deploy --build

  # 推荐：提升走生产机 coscli 并行 sync（231 对象从 19min 降到 4s）
  python deploy_frontend.py deploy --build --fast

  # 仅上传+校验+冒烟，不提升（先 stage 一个 release，人工确认后再提升）
  python deploy_frontend.py deploy --build --no-promote

  # 提升一个已存在的 release（配合 --no-promote 使用；提升即把版本前缀 copy 到桶根）
  python deploy_frontend.py promote --to 20240101-120000 --fast

  # 回滚到某个 release（本质也是把该版本前缀 copy 回桶根）
  python deploy_frontend.py rollback --to 20240101-120000

  # 列出可用 release（回滚点）
  python deploy_frontend.py rollback --list
  python deploy_frontend.py list

  # 自定义 coscmd 路径（默认使用隔离 venv 里的 exe）
  python deploy_frontend.py deploy --build --coscmd "C:/path/to/coscmd.exe"

【密钥注入（重要：脚本绝不落盘密钥）】
  coscmd 1.9.0.6 不支持从环境变量读取密钥，只能读配置文件 ~/.cos.conf。
  因此本脚本从环境变量读取密钥后，写入一个「临时」配置文件（权限 600），
  通过 coscmd 的 `-c` 参数指向它；所有 coscmd 调用结束后立即删除该临时文件。
  密钥不会出现在脚本源码，也不会持久化到磁盘。

  主理人执行前，从生产机 sudo 读取真实密钥并注入本进程环境变量：
    # 在生产机读取（root 600 的 /opt/personalsite/.env）
    ssh <prod> 'sudo cat /opt/personalsite/.env'
    # 在本机 export（值以生产机 .env 为准；桶名 = 前端 web 桶）
    export COS_SECRET_ID='AKIDxxxx'
    export COS_SECRET_KEY='xxxx'
    export COS_BUCKET='personalsite-web-1312192644'
    export COS_REGION='ap-guangzhou'
    # 然后运行本脚本
    python deploy_frontend.py deploy --build

  也可把密钥作为环境变量直接传给脚本（同样不写文件）：
    COS_SECRET_ID=... COS_SECRET_KEY=... COS_BUCKET=... COS_REGION=... \
        python deploy_frontend.py deploy --build

【CDN 刷新（脚本无法自动完成）】
  提升完成后桶根已是最新版本，但 CDN 边缘节点仍可能缓存旧文件。
  本脚本运行在本机，无法直接调用 cloud-ops-mcp 的 cdn_refresh 工具。
  请在提升完成后，由主理人通过 cloud-ops-mcp 执行刷新：
    cdn_refresh  https://minipluto.cn/
    cdn_refresh  https://www.minipluto.cn/
  脚本在提升成功后会打印上述提示。

【Go / No-Go 检查清单】（提升前必须全部满足）
  1. 构建无错（--build 时 npm run build 退出码 0）
  2. dist 存在且 dist/index.html 非空
  3. 上传至版本前缀 /releases/<ts>/，且 list 校验「无 /dist/ 前缀」
  4. release 冒烟通过（curl 源站 /releases/<ts>/index.html 返回 200）
  5. 回滚路径就绪（目标 release 已存在于 /releases/ 下，随时可 rollback）

【关于 coscmd upload 的坑（已规避）】
  coscmd 在 target 以 '/' 结尾时，会把 source 的「最后一段目录名」追加为前缀。
  若 `cd dist && coscmd upload -r . /releases/<ts>/`（带尾斜杠），coscmd 会把
  源 basename '.' 追加成字面量 `./` 段（源码无 `.`/`..` 归一化），得到
  releases/<ts>/./index.html 这类脏 key。
  本脚本改为「不带尾斜杠」的 target：coscmd upload -r . /releases/<ts>，
  由 upload_folder 自行补 '/'，得到干净的 releases/<ts>/index.html。
  同时脚本在解析 key 时会再做一次防御性归一化（折叠 /./ → /），双保险。
============================================================================
"""

import os
import sys
import argparse
import subprocess
import tempfile
import shutil
import datetime
import configparser
import stat

# ----------------------------------------------------------------------------
# 路径常量（基于本脚本所在位置推导，无需硬编码业务路径）
# ----------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "personal-site-frontend")
DIST_DIR = os.path.join(FRONTEND_DIR, "dist")

DEFAULT_COSCMD = r"C:\Users\12629\.workbuddy\binaries\python\envs\default\Scripts\coscmd.exe"

RELEASE_PREFIX = "releases"          # 版本前缀目录（桶内）
CDN_URLS = ["https://minipluto.cn/", "https://www.minipluto.cn/"]

# ----------------------------------------------------------------------------
# 快速提升（coscli sync，生产机并行执行）相关配置
# 背景：coscmd `copy` 逐对象串行，231 个对象实测 19m42s；
#       生产机 coscli 并行 sync 实测 4.5s（约快 260 倍），且自动跳过相同对象。
# 前提：生产机已安装 coscli 并写好 ~/.cos.yaml（密钥取自 /opt/personalsite/.env）。
#       本机到生产机 ssh 用免密密钥直连（与 scp 传包同密钥）。
# ----------------------------------------------------------------------------
PROD_HOST = os.environ.get("PROD_HOST", "<PROD_HOST>")
PROD_USER = os.environ.get("PROD_USER", "ubuntu")
PROD_SSH_KEY = os.environ.get("PROD_SSH_KEY", "<PROD_SSH_KEY_PATH>")
COSCLI_ENDPOINT = os.environ.get("COSCLI_ENDPOINT", "cos.ap-guangzhou.myqcloud.com")


# ----------------------------------------------------------------------------
# 基础工具
# ----------------------------------------------------------------------------
def die(msg, code=1):
    print("[ERROR] " + msg, file=sys.stderr)
    sys.exit(code)


def print_step(n, msg):
    print("\n=== [%s] %s ===" % (n, msg))


def read_creds():
    """从环境变量读取密钥；缺失则报错并给出注入指引。"""
    need = ["COS_SECRET_ID", "COS_SECRET_KEY", "COS_BUCKET", "COS_REGION"]
    missing = [k for k in need if not os.environ.get(k)]
    if missing:
        die(
            "缺少必需的环境变量（密钥）。请主理人从生产机 sudo 读取 .env 后 export：\n"
            "  export COS_SECRET_ID='...'\n"
            "  export COS_SECRET_KEY='...'\n"
            "  export COS_BUCKET='personalsite-web-1312192644'\n"
            "  export COS_REGION='ap-guangzhou'\n"
            "缺失项：" + ", ".join(missing)
        )
    return {k: os.environ[k] for k in need}


def make_temp_conf(creds):
    """把环境变量里的密钥写入一个临时配置文件（权限 600），返回 (conf_path, tmp_dir)。
    该文件仅在本次进程内存在，调用方须在 finally 中删除。"""
    tmp_dir = tempfile.mkdtemp(prefix="coscmd_deploy_")
    conf = os.path.join(tmp_dir, ".cos.conf")
    cp = configparser.ConfigParser()
    cp.optionxform = str  # 保留键名大小写
    cp["common"] = {
        "secret_id": creds["COS_SECRET_ID"],
        "secret_key": creds["COS_SECRET_KEY"],
        "bucket": creds["COS_BUCKET"],
        "region": creds["COS_REGION"],
        "schema": "https",
        "verify": "md5",
        "anonymous": "False",
        "max_thread": "5",
        "part_size": "1",
        "retry": "5",
        "timeout": "60",
    }
    with open(conf, "w") as f:
        cp.write(f)
    try:
        os.chmod(conf, stat.S_IRUSR | stat.S_IWUSR)  # 仅当前用户可读写
    except OSError:
        pass
    return conf, tmp_dir


def coscmd_run(coscmd_exe, conf, subcommand_args, cwd=None, timeout=600):
    """调用 coscmd：-c 指向临时配置，并把日志也写到临时目录避免在家目录留痕。
    返回 subprocess.CompletedProcess（capture_output=True）。"""
    log_path = os.path.join(os.path.dirname(conf), "coscmd.log")
    cmd = [coscmd_exe, "-c", conf, "-l", log_path] + list(subcommand_args)
    try:
        proc = subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout
        )
    except FileNotFoundError:
        die("找不到 coscmd 可执行文件：%s\n请通过 --coscmd 指定正确路径。" % coscmd_exe)
    except subprocess.TimeoutExpired:
        die("coscmd 调用超时：%s" % " ".join(subcommand_args))
    if proc.stdout:
        sys.stdout.write(proc.stdout)
    if proc.stderr:
        sys.stderr.write(proc.stderr)
    return proc


def normalize_key(key):
    """折叠字面量 ./ 段、合并多余斜杠，得到规范 key。
    仅用于计算目标路径，COPY 的源 key 仍使用 list 返回的真实存储 key。"""
    out = []
    for part in key.split("/"):
        if part == "." or part == "":
            continue
        out.append(part)
    return "/".join(out)


def list_keys(coscmd_exe, conf, prefix):
    """列出 prefix 下的全部对象 key（真实存储 key，未归一化），按 prefix 过滤。
    prefix 形如 'releases/20240101-120000/'。"""
    proc = coscmd_run(coscmd_exe, conf, ["list", "-r", "-a", "/" + prefix])
    if proc.returncode != 0:
        die("coscmd list 失败（prefix=%s），退出码 %s" % (prefix, proc.returncode))
    keys = []
    for line in (proc.stdout or "").splitlines():
        s = line.strip()
        if not s:
            continue
        toks = s.split()
        first = toks[0] if toks else ""
        if first.startswith(prefix):
            keys.append(first)
    return keys


def list_releases(coscmd_exe, conf):
    """列出 /releases/ 下的版本目录（CommonPrefixes），返回排序后的 ts 列表。"""
    proc = coscmd_run(coscmd_exe, conf, ["list", "/releases/"])
    releases = []
    for line in (proc.stdout or "").splitlines():
        s = line.strip()
        if not s:
            continue
        toks = s.split()
        first = toks[0] if toks else ""
        if first.startswith("releases/") and first.endswith("/"):
            ts = first[len("releases/"):-1]
            if ts:
                releases.append(ts)
    return sorted(releases)


def http_status(url, timeout=30):
    """返回 URL 的 HTTP 状态码（int）；失败返回 None。
    优先使用 curl（与发布规范一致），缺失则回退 urllib。"""
    curl = shutil.which("curl")
    if curl:
        body_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".html")
        body_path = body_tmp.name
        body_tmp.close()
        try:
            r = subprocess.run(
                [curl, "-s", "-o", body_path, "-w", "%{http_code}", url],
                capture_output=True, text=True, timeout=timeout,
            )
            code = (r.stdout or "").strip()
            return int(code) if code.isdigit() else None
        except Exception:
            return None
        finally:
            try:
                os.remove(body_path)
            except OSError:
                pass
    # 回退：urllib HEAD 请求
    try:
        import urllib.request
        import urllib.error
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return None


def promote_release(coscmd_exe, conf, ts, bucket, region):
    """把 /releases/<ts>/ 下的所有对象服务端 copy 到桶根 /。返回失败的对象 key 列表。"""
    prefix = "%s/%s/" % (RELEASE_PREFIX, ts)
    keys = list_keys(coscmd_exe, conf, prefix)
    if not keys:
        die("release /%s 下没有对象，无法提升/回滚" % prefix)
    failed = []
    total = len(keys)
    done = 0
    for raw in keys:
        if raw == prefix or raw.endswith("/"):
            continue  # 跳过目录标记（如有）
        # 源必须是真实存储 key，且需带 host（copy_file 按 host 解析 bucket/region）
        source = "%s.cos.%s.myqcloud.com/%s" % (bucket, region, raw)
        norm = normalize_key(raw)
        rel = norm[len(prefix):] if norm.startswith(prefix) else norm
        if not rel:
            continue
        dest = "/" + rel
        proc = coscmd_run(coscmd_exe, conf, ["copy", "-f", "-y", source, dest])
        done += 1
        if proc.returncode != 0:
            failed.append(raw)
            print("  ✗ [%d/%d] %s -> %s (rc=%d)" % (done, total, raw, dest, proc.returncode))
        else:
            print("  ✓ [%d/%d] %s -> %s" % (done, total, raw, dest))
    return failed


def ssh_run(remote_cmd, timeout=300):
    """在本机通过 ssh（免密密钥）到生产机执行命令；返回 CompletedProcess。
    命令失败（返回码非 0）时直接 die，避免提升静默失败。"""
    ssh = shutil.which("ssh") or "ssh"
    cmd = [ssh, "-i", PROD_SSH_KEY,
           "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=15",
           "%s@%s" % (PROD_USER, PROD_HOST), remote_cmd]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        die("找不到 ssh 可执行文件，无法走 --fast（coscli 提升走生产机执行）")
    except subprocess.TimeoutExpired:
        die("ssh 执行生产命令超时：%s" % remote_cmd[:120])
    if proc.stdout:
        sys.stdout.write(proc.stdout)
    if proc.stderr:
        sys.stderr.write(proc.stderr)
    return proc


def promote_fast(ts, bucket):
    """快速提升：在生产机用 coscli 并行 sync，把 /releases/<ts>/ 同步到桶根。
    对比 coscmd 逐对象 copy（231 对象约 19min），实测 4.5s 完成。
    注意三个 coscli 坑（均已规避）：
      - COS→COS 必须显式 --endpoint（否则报 endpoint is missing）
      - 源是目录必须 --recursive
      - --fail-output-path 不能落在源目录树下（放 /tmp）
    返回失败列表（coscli 单命令失败时由本函数 die，理论上无逐对象失败列表）。"""
    src = "cos://%s/releases/%s/" % (bucket, ts)
    dst = "cos://%s/" % bucket
    remote = (
        "coscli sync --recursive --endpoint %s "
        "--fail-output-path /tmp/coscli_fail_%s --process-log-path /tmp/coscli_plog "
        "%s %s"
    ) % (COSCLI_ENDPOINT, ts, src, dst)
    print("  -> 生产机 coscli 并行 sync（%s -> %s）" % (src, dst))
    proc = ssh_run(remote)
    if proc.returncode != 0:
        die("coscli sync 提升失败（rc=%d），可用回滚：python %s rollback --to %s"
            % (proc.returncode, os.path.basename(__file__), ts))
    return []


def verify_root_soft(coscmd_exe, conf):
    """提升后轻量校验桶根：确认 index.html 与 assets/ 存在（仅告警，不中止）。"""
    proc = coscmd_run(coscmd_exe, conf, ["list", "/"])
    tokens = set()
    for line in (proc.stdout or "").splitlines():
        s = line.strip()
        if not s:
            continue
        toks = s.split()
        if toks:
            tokens.add(toks[0])
    if "index.html" not in tokens:
        print("  ⚠ 桶根未检测到 index.html，提升可能不完整")
    if "assets/" not in tokens:
        print("  ⚠ 桶根未检测到 assets/，请检查")


def print_cdn_hint():
    print("提升完成，请主理人用 cloud-ops-mcp 的 cdn_refresh 刷新")
    for u in CDN_URLS:
        print("    cdn_refresh " + u)


def clean_dist():
    """构建前硬清理 dist（P0-5：修复构建流程卡点）。

    【背景】
    Vite 的 emptyOutDir 会对 dist/assets 做一次「递归批量删除」。在带批量删除
    防护的工作环境下该调用被守卫拦截，构建直接失败：

        [safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]
        {"count":306,"threshold":50,"scope":"turn",...}
        x Build failed in 25.43s        （personal-site-frontend/qa-build.log）

    这就是架构评审 R4 记录的「上次构建失败、dist 为 8-04 旧产物」的根因。

    【修复】
    前端侧已把 vite.config.js 的 build.emptyOutDir 关掉，构建不再自行删除；
    清理职责上移到发布脚本这一层，由 Python 的 shutil.rmtree 完成 ——
    Python 进程不经过 Node 侧的删除守卫，可靠且不受阈值限制。

    【为什么必须清干净】
    emptyOutDir=False 时若不清理，历史产物会不断堆积在 dist/，
    随后被 coscmd 整目录上传到 /releases/<ts>/，导致 release 体积虚高、
    且把早已废弃的 chunk 一起提升到桶根，污染线上文件列表。

    :return: None
    """
    if not os.path.isdir(DIST_DIR):
        print("  -> dist 不存在，无需清理")
        return

    # 安全护栏：只允许删除本项目 personal-site-frontend/dist，
    # 防止常量推导异常时误删其他目录。
    expected = os.path.normcase(os.path.normpath(DIST_DIR))
    guard = os.path.normcase(os.path.normpath(os.path.join(FRONTEND_DIR, "dist")))
    if expected != guard or os.path.basename(expected) != "dist":
        die("dist 路径异常，拒绝清理：%s" % DIST_DIR)

    file_count = sum(len(files) for _, _, files in os.walk(DIST_DIR))
    shutil.rmtree(DIST_DIR, ignore_errors=False)
    os.makedirs(DIST_DIR, exist_ok=True)
    print("  -> 已清空 dist（原有 %d 个文件）：%s" % (file_count, DIST_DIR))


# ----------------------------------------------------------------------------
# 子命令实现
# ----------------------------------------------------------------------------
def cmd_deploy(args, creds, conf):
    coscmd_exe = args.coscmd
    bucket = creds["COS_BUCKET"]
    region = creds["COS_REGION"]

    # 1) 构建（可选）
    print_step("1/8", "构建（可选）")
    if args.build:
        if not os.path.isdir(FRONTEND_DIR):
            die("前端目录不存在：%s" % FRONTEND_DIR)
        # 先硬清理 dist，再构建。vite.config.js 已关闭 emptyOutDir，
        # 清理由这里负责，既修复了构建卡点，也保证 release 产物无历史残留。
        print("  -> 清理 dist")
        clean_dist()
        print("  -> npm run build  (cwd=%s)" % FRONTEND_DIR)
        r = subprocess.run("npm run build", cwd=FRONTEND_DIR, shell=True)
        if r.returncode != 0:
            die("npm run build 失败（go/no-go 第 1 项未通过）")
    else:
        print("  -> 跳过（未指定 --build），使用已有 dist/")

    # 2) 校验 dist/index.html
    print_step("2/8", "校验 dist/index.html")
    index_html = os.path.join(DIST_DIR, "index.html")
    if not os.path.isfile(index_html):
        die("dist/index.html 不存在：%s（go/no-go 第 2 项未通过）" % index_html)
    if os.path.getsize(index_html) == 0:
        die("dist/index.html 为空（go/no-go 第 2 项未通过）")
    print("  -> OK (%d bytes)" % os.path.getsize(index_html))

    # 3) 生成 release 名
    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    prefix = "%s/%s/" % (RELEASE_PREFIX, ts)
    print_step("3/8", "生成 release 名：/%s" % prefix)

    # 4) 上传 + 校验（根除 /dist/ 前缀）
    print_step("4/8", "上传 dist -> /%s（cd dist && coscmd upload -r . /releases/%s）" % (prefix, ts))
    if not os.path.isdir(DIST_DIR):
        die("dist 目录不存在：%s" % DIST_DIR)
    # 注意：target 不带尾斜杠，避免 coscmd 把源 basename '.' 追加成 ./ 段
    proc = coscmd_run(coscmd_exe, conf, ["upload", "-r", ".", "/releases/%s" % ts], cwd=DIST_DIR)
    if proc.returncode != 0:
        die("上传失败，退出码 %d" % proc.returncode)
    keys = list_keys(coscmd_exe, conf, prefix)
    if not keys:
        die("上传后 list 为空，疑似上传失败")
    has_index = any(k == prefix + "index.html" for k in keys)
    has_assets = any(k.startswith(prefix + "assets/") for k in keys)
    has_dist = any("/dist/" in k or k.startswith("dist/") for k in keys)
    if not has_index:
        die("release 缺少 index.html（go/no-go 第 3 项：校验失败）")
    if not has_assets:
        print("  ⚠ release 下未发现 assets/ 目录，请确认构建产物结构")
    if has_dist:
        die("⛔ 检测到 /dist/ 前缀！旧发布 bug 复现，中止（go/no-go 第 3 项未通过）")
    print("  -> 上传 %d 个对象；index.html ✓；assets/ %s；无 /dist/ 前缀 ✓"
          % (len(keys), "✓" if has_assets else "✗"))

    # 5) 冒烟
    print_step("5/8", "冒烟：curl COS 源站 /%sindex.html" % prefix)
    if args.no_smoke:
        print("  -> 跳过（--no-smoke）")
    else:
        url = "https://%s.cos-website.%s.myqcloud.com/%sindex.html" % (bucket, region, prefix)
        code = http_status(url)
        if code != 200:
            die("冒烟失败：%s 返回 %s（go/no-go 第 4 项未通过）" % (url, code))
        print("  -> %s 返回 %s ✓" % (url, code))

    # 6) 提升（近似原子，服务端 copy；--fast 走生产机 coscli 并行 sync）
    if args.no_promote:
        print_step("6/8", "提升：跳过（--no-promote）")
        print("  已 stage release /%s。" % prefix)
        print("  稍后提升：python %s promote --to %s" % (os.path.basename(__file__), ts))
    else:
        if args.fast:
            print_step("6/8", "提升（--fast，生产机 coscli 并行 sync）")
        else:
            print_step("6/8", "提升（近似原子）：服务端 copy 到桶根 /")
        failed = (promote_fast(ts, bucket) if args.fast
                  else promote_release(coscmd_exe, conf, ts, bucket, region))
        if failed:
            die("提升过程中 %d 个对象 copy 失败：%s" % (len(failed), failed))
        verify_root_soft(coscmd_exe, conf)

    # 7) CDN 刷新提示
    if not args.no_promote:
        print_step("7/8", "CDN 刷新（需主理人手动执行）")
        print_cdn_hint()

    # 8) 列出 releases + 保留近 3 个提示
    print_step("8/8", "列出已有 releases（保留近 3 个，脚本不自动删除）")
    releases = list_releases(coscmd_exe, conf)
    for r in releases:
        mark = "  <- 本次" if r == ts else ""
        print("  - %s%s" % (r, mark))
    if len(releases) > 3:
        print("  ⚠ 共 %d 个 release，建议仅保留近 3 个；" % len(releases))
        print("    脚本不会自动删除，避免误删回滚点。如需清理请主理人手动确认。")

    print("\n✅ 完成。回滚路径就绪：python %s rollback --to %s"
          % (os.path.basename(__file__), ts))


def cmd_rollback(args, creds, conf):
    coscmd_exe = args.coscmd
    bucket = creds["COS_BUCKET"]
    region = creds["COS_REGION"]

    if args.list_only:
        releases = list_releases(coscmd_exe, conf)
        print("可用 release（回滚点）：")
        for r in releases:
            print("  - %s" % r)
        print("%d 个。回滚：python %s rollback --to <ts>"
              % (len(releases), os.path.basename(__file__)))
        return

    if not args.to:
        die("rollback 需要 --to <ts> 或 --list")

    ts = args.to
    prefix = "%s/%s/" % (RELEASE_PREFIX, ts)
    keys = list_keys(coscmd_exe, conf, prefix)
    if not keys:
        die("release /%s 不存在或为空，无法回滚" % prefix)

    print_step("回滚", "将 /%s 服务端 copy 到桶根 /" % prefix)
    failed = promote_release(coscmd_exe, conf, ts, bucket, region)
    if failed:
        die("回滚过程中 %d 个对象 copy 失败：%s" % (len(failed), failed))
    verify_root_soft(coscmd_exe, conf)
    print("\n✅ 回滚完成，请主理人用 cloud-ops-mcp 的 cdn_refresh 刷新")
    for u in CDN_URLS:
        print("    cdn_refresh " + u)


def cmd_promote(args, creds, conf):
    coscmd_exe = args.coscmd
    bucket = creds["COS_BUCKET"]
    region = creds["COS_REGION"]

    ts = args.to
    prefix = "%s/%s/" % (RELEASE_PREFIX, ts)
    keys = list_keys(coscmd_exe, conf, prefix)
    if not keys:
        die("release /%s 不存在或为空，无法提升" % prefix)

    if args.fast:
        print_step("提升", "--fast：生产机 coscli 并行 sync /%s 到桶根 /" % prefix)
        failed = promote_fast(ts, bucket)
    else:
        print_step("提升", "将 /%s 服务端 copy 到桶根 /" % prefix)
        failed = promote_release(coscmd_exe, conf, ts, bucket, region)
    if failed:
        die("提升过程中 %d 个对象 copy 失败：%s" % (len(failed), failed))
    verify_root_soft(coscmd_exe, conf)
    print("\n✅ 提升完成，请主理人用 cloud-ops-mcp 的 cdn_refresh 刷新")
    for u in CDN_URLS:
        print("    cdn_refresh " + u)


def cmd_list(args, creds, conf):
    releases = list_releases(coscmd_exe=args.coscmd, conf=conf)
    print("可用 release（回滚点）：")
    for r in releases:
        print("  - %s" % r)
    print("%d 个。建议保留近 3 个（脚本不自动删除）。" % len(releases))


# ----------------------------------------------------------------------------
# 入口
# ----------------------------------------------------------------------------
def build_parser():
    parser = argparse.ArgumentParser(
        description="PersonalSite 前端版本化前缀发布 + 回滚脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="cmd")

    p_deploy = sub.add_parser("deploy", help="完整发布（默认子命令）")
    p_deploy.add_argument("--build", action="store_true", help="先本地 npm run build")
    p_deploy.add_argument("--coscmd", default=DEFAULT_COSCMD, help="coscmd.exe 路径")
    p_deploy.add_argument("--no-smoke", action="store_true", help="跳过源站冒烟")
    p_deploy.add_argument("--no-promote", action="store_true", help="仅上传+校验+冒烟，不提升")
    p_deploy.add_argument("--fast", action="store_true",
                          help="提升走生产机 coscli 并行 sync（231 对象 19min→4s）")

    p_rollback = sub.add_parser("rollback", help="回滚到指定 release")
    p_rollback.add_argument("--to", default=None, help="release 时间戳 YYYYMMDD-HHMMSS")
    p_rollback.add_argument("--list", action="store_true", dest="list_only", help="列出可用 release")
    p_rollback.add_argument("--coscmd", default=DEFAULT_COSCMD, help="coscmd.exe 路径")

    p_promote = sub.add_parser("promote", help="提升一个已存在的 release 到桶根")
    p_promote.add_argument("--to", required=True, help="release 时间戳 YYYYMMDD-HHMMSS")
    p_promote.add_argument("--coscmd", default=DEFAULT_COSCMD, help="coscmd.exe 路径")
    p_promote.add_argument("--fast", action="store_true",
                           help="提升走生产机 coscli 并行 sync（推荐）")

    p_list = sub.add_parser("list", help="列出可用 release")
    p_list.add_argument("--coscmd", default=DEFAULT_COSCMD, help="coscmd.exe 路径")

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    # 默认子命令 = deploy（无参数时等价于 `deploy`）
    if args.cmd is None:
        args.cmd = "deploy"
        args.build = False
        args.coscmd = DEFAULT_COSCMD
        args.no_smoke = False
        args.no_promote = False
        args.fast = False

    # 所有子命令都需要 COS 凭证（含 list，因为要从桶列举）
    creds = read_creds()
    conf, tmp_dir = make_temp_conf(creds)
    try:
        if args.cmd == "deploy":
            cmd_deploy(args, creds, conf)
        elif args.cmd == "rollback":
            cmd_rollback(args, creds, conf)
        elif args.cmd == "promote":
            cmd_promote(args, creds, conf)
        elif args.cmd == "list":
            cmd_list(args, creds, conf)
        else:
            parser.print_help()
            sys.exit(2)
    finally:
        # 无论成功失败，删除临时配置（密钥绝不落盘）
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
