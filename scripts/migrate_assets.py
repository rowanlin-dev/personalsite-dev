#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
migrate_assets.py — PersonalSite 旧 COS 资产安全迁移脚本
============================================================================

【背景 / 要解决的问题】
现有 COS 对象堆在 flat 的 `public/`（可能还有根），无分类。
新前缀树：
    assets/public/{avatars,blogs,projects}/<slug|uid>/   （公开，可 CDN）
    assets/private/resume/<uid>                          （私有，不 CDN）
本脚本把旧对象「安全」搬进新树。

[WARN] 命名约定（主理人拍板）：历史对象迁移只做「分类归位」，目标 key 保留原文件名，
   例如 assets/public/avatars/<original-filename>、
         assets/private/resume/<original-filename>、
         assets/public/blogs/uncategorized/<original-filename>。
   内容 hash 命名（前缀/SHA-256前12位hex.扩展名）仅用于后端 AssetService 的【新上传】，
   迁移 copy 不取名 hash、不取字节/ETag，服务端 copy 即可。
本脚本把旧对象「安全」搬进新树：
    * 默认不删原对象（仅 copy，绝不 move/delete）；
    * 幂等（目标已存在则跳过）；
    * 产出 inventory / plan / manifest 三份清单，便于人工复核与回滚；
    * 支持孤儿盘点（orphans）。

【四个子命令】
  inventory                     只读盘点：列出 public/、private/ 及根下对象
                                -> scripts/migration_inventory.json
  plan [--mapping m.json]       规划目标 key（映射优先，否则启发式分类）
                                -> scripts/migration_plan.json
  run [--yes] [--purge]         桶内 copy 旧 key -> 新 key（不删原对象）
                                -> scripts/migration_manifest.json
                                仅当 --purge 且 --yes 且全部 copy 成功才删原对象
  orphans [--db db.sqlite]      列出 assets/ 下未被引用的对象（best-effort）

【真实迁移操作顺序（请严格按此执行）】
  python migrate_assets.py inventory          # 1) 盘点，产出 inventory
  python migrate_assets.py plan               # 2) 生成 plan（可先看一眼）
  # 3) 人工复核 migration_plan.json，必要时编辑修正，或给 plan --mapping 指定映射
  python migrate_assets.py run --yes          # 4) 真正 copy（默认不删原对象）
  # 5) 复核 manifest；确认无误后再考虑： python migrate_assets.py run --yes --purge
  python migrate_assets.py orphans            # 6) 盘点孤儿，供人工核查清理

【密钥注入（与 deploy_frontend.py 一致；脚本绝不落盘密钥）】
  coscmd 1.9.0.6 不支持从环境变量读密钥，只能读配置文件。
  本脚本两套后端：
    (A) qcloud_cos Python SDK —— 优先；从环境变量直接取密钥，无需落盘。
    (B) coscmd CLI 回退 —— 当 qcloud_cos 不可用时，从环境变量读密钥写入
        临时配置（权限 600），调用结束后立即删除，密钥不持久化。
  主理人执行前从生产机 sudo 读取真实密钥并注入本进程环境变量：
    export COS_SECRET_ID='AKIDxxxx'
    export COS_SECRET_KEY='xxxx'
    export COS_BUCKET='personalsite-web-1312192644'
    export COS_REGION='ap-guangzhou'
    python migrate_assets.py inventory
  [WARN] 本脚本只编写、不针对线上桶执行（无凭证）。

【安全要点】
  * 幂等：目标 key 已存在则跳过（qcloud_cos copy 默认会覆盖，故先 head 校验）。
  * 默认不删；删除仅 --purge 且 --yes，且全部 copy 成功、manifest 已写。
  * purge 删原对象前，再次校验目标已存在，避免误删。
============================================================================
"""

import os
import sys
import json
import argparse
import subprocess
import tempfile
import shutil
import datetime
import configparser
import stat

# ----------------------------------------------------------------------------
# 路径常量（基于本脚本所在位置推导）
# ----------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

INVENTORY_FILE = os.path.join(SCRIPT_DIR, "migration_inventory.json")
PLAN_FILE = os.path.join(SCRIPT_DIR, "migration_plan.json")
MANIFEST_FILE = os.path.join(SCRIPT_DIR, "migration_manifest.json")
PURGE_FAILED_FILE = os.path.join(SCRIPT_DIR, "migration_purge_failed.json")

DEFAULT_COSCMD = r"C:\Users\12629\.workbuddy\binaries\python\envs\default\Scripts\coscmd.exe"

# 盘点时排除的「非旧对象」前缀（避免把迁移目的地 assets/ 和前端 releases/ 再搬一遍）
EXCLUDE_PREFIXES = ("assets/", "releases/", "public/", "private/")

# 新前缀树常量
PUB_AVATARS = "assets/public/avatars/"
PUB_BLOGS = "assets/public/blogs/uncategorized/"
PUB_MIGRATED = "assets/public/migrated/"
PRI_RESUME = "assets/private/resume/"


# ----------------------------------------------------------------------------
# 基础工具
# ----------------------------------------------------------------------------
def die(msg, code=1):
    print("[ERROR] " + msg, file=sys.stderr)
    sys.exit(code)


def print_step(n, msg):
    print("\n=== [%s] %s ===" % (n, msg))


def read_creds():
    """从环境变量读取密钥；缺失则报错并给出注入指引（与 deploy_frontend.py 一致）。"""
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
    """把环境变量里的密钥写入临时配置文件（权限 600），返回 (conf_path, tmp_dir)。
    仅在本次进程内存在，调用方须在 finally 中删除。"""
    tmp_dir = tempfile.mkdtemp(prefix="coscmd_migrate_")
    conf = os.path.join(tmp_dir, ".cos.conf")
    cp = configparser.ConfigParser()
    cp.optionxform = str
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
        os.chmod(conf, stat.S_IRUSR | stat.S_IWUSR)
    except OSError:
        pass
    return conf, tmp_dir


def coscmd_run(coscmd_exe, conf, subcommand_args, timeout=600):
    """调用 coscmd：-c 指向临时配置。返回 subprocess.CompletedProcess。"""
    log_path = os.path.join(os.path.dirname(conf), "coscmd.log")
    cmd = [coscmd_exe, "-c", conf, "-l", log_path] + list(subcommand_args)
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        die("找不到 coscmd 可执行文件：%s\n请通过 --coscmd 指定正确路径。" % coscmd_exe)
    except subprocess.TimeoutExpired:
        die("coscmd 调用超时：%s" % " ".join(subcommand_args))
    if proc.stdout:
        sys.stdout.write(proc.stdout)
    if proc.stderr:
        sys.stderr.write(proc.stderr)
    return proc


# ----------------------------------------------------------------------------
# COS 后端抽象（qcloud_cos 优先；coscmd CLI 回退）
# ----------------------------------------------------------------------------
class COSBackend:
    """统一接口：list_prefix / object_exists / copy_object / delete_object。"""

    def list_prefix(self, prefix):
        """yield (key, size, last_modified_iso)。last_modified_iso 为 ISO 字符串。"""
        raise NotImplementedError

    def object_exists(self, key):
        raise NotImplementedError

    def copy_object(self, src_key, dst_key):
        """桶内 copy：src_key -> dst_key。调用方需先确认 dst 不存在（幂等）。"""
        raise NotImplementedError

    def delete_object(self, key):
        raise NotImplementedError


class QcloudCosBackend(COSBackend):
    def __init__(self, creds):
        try:
            from qcloud_cos import CosConfig, CosS3Client
            from qcloud_cos.cos_exception import CosServiceError
        except ImportError:
            raise RuntimeError("qcloud_cos SDK 不可用")
        config = CosConfig(
            Region=creds["COS_REGION"],
            SecretId=creds["COS_SECRET_ID"],
            SecretKey=creds["COS_SECRET_KEY"],
        )
        self.client = CosS3Client(config)
        self.bucket = creds["COS_BUCKET"]
        self.region = creds["COS_REGION"]
        self.CosServiceError = CosServiceError

    def list_prefix(self, prefix):
        marker = ""
        while True:
            resp = self.client.list_objects(
                Bucket=self.bucket, Prefix=prefix, Marker=marker, MaxKeys=1000
            )
            for c in resp.get("Contents", []):
                lm = c.get("LastModified")
                if hasattr(lm, "isoformat"):
                    lm_iso = lm.isoformat()
                else:
                    lm_iso = str(lm) if lm is not None else ""
                yield c["Key"], int(c.get("Size", 0)), lm_iso
            if resp.get("IsTruncated") == "true":
                marker = resp.get("NextMarker", "")
                if not marker:
                    break
            else:
                break

    def object_exists(self, key):
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except self.CosServiceError as e:
            if getattr(e, "get_status_code", lambda: 0)() == 404:
                return False
            raise

    def copy_object(self, src_key, dst_key):
        copy_source = {
            "Bucket": self.bucket,
            "Key": src_key,
            "Region": self.region,
        }
        self.client.copy_object(Bucket=self.bucket, Key=dst_key, CopySource=copy_source)

    def delete_object(self, key):
        self.client.delete_object(Bucket=self.bucket, Key=key)


class CoscmdBackend(COSBackend):
    def __init__(self, creds, coscmd_exe):
        self.creds = creds
        self.coscmd_exe = coscmd_exe
        self.conf, self.tmp_dir = make_temp_conf(creds)
        self._exists_cache = {}

    def _close(self):
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def list_prefix(self, prefix):
        proc = coscmd_run(self.coscmd_exe, self.conf, ["list", "-r", "-a", "/" + prefix])
        if proc.returncode != 0:
            die("coscmd list 失败（prefix=%s），退出码 %d" % (prefix, proc.returncode))
        for line in (proc.stdout or "").splitlines():
            s = line.strip()
            if not s:
                continue
            toks = s.split()
            key = toks[0] if toks else ""
            if not key.startswith(prefix):
                continue
            size = 0
            lm_iso = ""
            # coscmd list 行格式不稳定，尽力解析：尝试取数字为 size，时间戳为时间
            for t in toks[1:]:
                if t.isdigit():
                    size = int(t)
                    break
            yield key, size, lm_iso

    def object_exists(self, key):
        if key in self._exists_cache:
            return self._exists_cache[key]
        # coscmd 无 head，用前缀 list 在缓存里找
        prefix = key.rsplit("/", 1)[0] + "/" if "/" in key else ""
        found = False
        for k, _, _ in self.list_prefix(prefix):
            self._exists_cache[k] = True
            if k == key:
                found = True
        self._exists_cache[key] = found
        return found

    def copy_object(self, src_key, dst_key):
        source = "%s.cos.%s.myqcloud.com/%s" % (
            self.creds["COS_BUCKET"], self.creds["COS_REGION"], src_key
        )
        dest = "/" + dst_key
        proc = coscmd_run(self.coscmd_exe, self.conf, ["copy", "-f", "-y", source, dest])
        if proc.returncode != 0:
            raise RuntimeError("coscmd copy 失败：%s -> %s" % (src_key, dst_key))

    def delete_object(self, key):
        proc = coscmd_run(self.coscmd_exe, self.conf, ["delete", "-f", "/" + key])
        if proc.returncode != 0:
            raise RuntimeError("coscmd delete 失败：%s" % key)


def get_backend(creds, args):
    """优先 qcloud_cos；不可用则回退 coscmd CLI。"""
    try:
        return QcloudCosBackend(creds)
    except RuntimeError:
        print("[INFO] qcloud_cos SDK 不可用，回退 coscmd CLI 后端。")
        return CoscmdBackend(creds, args.coscmd)


# ----------------------------------------------------------------------------
# 启发式分类
# ----------------------------------------------------------------------------
def classify(fname):
    """返回 (new_key, reason)。fname 为对象 key（用于匹配文件名）。"""
    low = fname.lower()
    base = fname.rsplit("/", 1)[-1]  # 取最后一段作为文件名
    low_base = base.lower()
    if "avatar" in low_base or "avatar" in low:
        return PUB_AVATARS + base, "文件名含 avatar -> 公开头像目录"
    if "resume" in low_base or "cv" in low_base or "resume" in low or "cv" in low:
        return PRI_RESUME + base, "文件名含 resume/cv -> 私有简历目录"
    # 其余：公开博客/未分类；若已有 migrated 倾向可改用 PUB_MIGRATED
    return PUB_BLOGS + base, "默认归类 -> 公开博客/未分类"


# ----------------------------------------------------------------------------
# 子命令实现
# ----------------------------------------------------------------------------
def cmd_inventory(args, creds, backend):
    print_step("1/1", "inventory：只读盘点 public/、private/ 及根下对象")
    seen = {}
    # 1) public/ 与 private/
    for prefix in ("public/", "private/"):
        print("  -> 列举 %s" % prefix)
        for key, size, lm in backend.list_prefix(prefix):
            if key.endswith("/"):
                continue  # 跳过目录标记
            seen[key] = {"key": key, "size": size, "last_modified": lm}
    # 2) 根下（含其它未知顶层前缀），排除新树/前端/releases
    print("  -> 列举根 /（排除 %s）" % ", ".join(EXCLUDE_PREFIXES))
    for key, size, lm in backend.list_prefix(""):
        if key.endswith("/"):
            continue
        if key.startswith(EXCLUDE_PREFIXES):
            continue
        seen[key] = {"key": key, "size": size, "last_modified": lm}

    items = sorted(seen.values(), key=lambda x: x["key"])
    with open(INVENTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    print("  -> 写出 %s（共 %d 个对象）" % (INVENTORY_FILE, len(items)))
    print("\n[OK] inventory 完成（只读，未改动桶内任何对象）。")


def cmd_plan(args, creds, backend):
    print_step("1/2", "plan：读取 inventory")
    if not os.path.isfile(INVENTORY_FILE):
        die("找不到 %s，请先运行 inventory。" % INVENTORY_FILE)
    with open(INVENTORY_FILE, encoding="utf-8") as f:
        inventory = json.load(f)

    mapping = {}
    if args.mapping:
        if not os.path.isfile(args.mapping):
            die("映射文件不存在：%s" % args.mapping)
        with open(args.mapping, encoding="utf-8") as f:
            mapping = json.load(f)
        # 支持 {"old_key": "new_key"} 或 [{"old":..,"new":..}]
        if isinstance(mapping, list):
            mapping = {m["old"]: m["new"] for m in mapping}
        print("  -> 载入映射 %d 条（%s）" % (len(mapping), args.mapping))

    print_step("2/2", "plan：决定每个对象的目标 key")
    plan = []
    for it in inventory:
        old = it["key"]
        if old in mapping:
            new = mapping[old]
            reason = "显式映射"
        else:
            new, reason = classify(old)
        plan.append({"old": old, "new": new, "reason": reason})

    with open(PLAN_FILE, "w", encoding="utf-8") as f:
        json.dump(plan, f, ensure_ascii=False, indent=2)
    print("  -> 写出 %s（共 %d 项）" % (PLAN_FILE, len(plan)))
    mapped = sum(1 for p in plan if p["reason"] == "显式映射")
    print("     其中显式映射 %d 项，启发式 %d 项" % (mapped, len(plan) - mapped))
    print("\n[OK] plan 完成。请人工复核 migration_plan.json（必要时编辑或用 --mapping 指定）。")


def cmd_run(args, creds, backend):
    print_step("1/4", "run：读取 plan")
    if not os.path.isfile(PLAN_FILE):
        die("找不到 %s，请先运行 plan。" % PLAN_FILE)
    with open(PLAN_FILE, encoding="utf-8") as f:
        plan = json.load(f)
    if not plan:
        die("plan 为空，无需执行。")

    if not args.yes:
        print_step("DRY-RUN", "未传 --yes，仅预览将要执行的 copy（不改动桶）")
        skip = 0
        do = 0
        for p in plan:
            exists = backend.object_exists(p["new"])
            if exists:
                print("  [SKIP] 跳过(已存在) %s -> %s" % (p["old"], p["new"]))
                skip += 1
            else:
                print("  -> copy        %s -> %s" % (p["old"], p["new"]))
                do += 1
        print("\n预览：将 copy %d 项，跳过(已存在) %d 项。" % (do, skip))
        print("确认无误后执行：python %s run --yes%s"
              % (os.path.basename(__file__), " --purge" if args.purge else ""))
        return

    print_step("2/4", "run --yes：桶内 copy 旧 key -> 新 key（不删原对象）")
    manifest = []
    failed = []
    total = len(plan)
    done = 0
    for p in plan:
        done += 1
        old, new = p["old"], p["new"]
        # 幂等：目标已存在则跳过
        if backend.object_exists(new):
            print("  [SKIP] [%d/%d] 跳过(已存在) %s -> %s" % (done, total, old, new))
            manifest.append({"old": old, "new": new, "copied": True, "skipped": True})
            continue
        try:
            backend.copy_object(old, new)
            print("  [OK] [%d/%d] copy %s -> %s" % (done, total, old, new))
            manifest.append({"old": old, "new": new, "copied": True})
        except Exception as e:
            print("  [FAIL] [%d/%d] 失败 %s -> %s : %s" % (done, total, old, new, e))
            manifest.append({"old": old, "new": new, "copied": False, "error": str(e)})
            failed.append(old)

    with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("  -> 写出 %s" % MANIFEST_FILE)
    print_step("3/4", "核对 copy 结果")
    if failed:
        print("  [WARN] %d 个对象 copy 失败：%s" % (len(failed), failed))
        print("  因存在失败项，按安全策略禁止 --purge。")
        print("\n[OK] run 完成（有失败，未删除原对象）。请排查后重跑 run --yes。")
        return

    print("  -> 全部 %d 项 copy 成功（若已存在则视为跳过）。" % total)

    # 4) 删除原对象（仅当 --purge 且 --yes 且全部成功且 manifest 已写）
    if args.purge:
        print_step("4/4", "run --purge：删除原对象（二次校验目标存在后）")
        purged = 0
        purge_failed = []
        for m in manifest:
            if not m.get("copied"):
                continue
            # 删除前再次确认目标已存在，避免误删
            if not backend.object_exists(m["new"]):
                print("  [WARN] 目标缺失，跳过删除原对象：%s" % m["old"])
                continue
            try:
                backend.delete_object(m["old"])
                purged += 1
                print("  [DEL] 已删原对象 %s" % m["old"])
            except Exception as e:
                print("  [FAIL] 删除失败 %s : %s" % (m["old"], e))
                purge_failed.append(m["old"])
        print("  -> 共删除原对象 %d 个；删除失败 %d 个。" % (purged, len(purge_failed)))
        # 删除失败的对象：写出失败清单供人工/后端后续处理，脚本不引入任何 DB 依赖
        if purge_failed:
            with open(PURGE_FAILED_FILE, "w", encoding="utf-8") as f:
                json.dump(purge_failed, f, ensure_ascii=False, indent=2)
            print("  [WARN] 删除失败的原对象已写入 %s" % PURGE_FAILED_FILE)
            print("    请人工核查后：")
            print("      (a) 直接重跑本脚本清理残留：python %s run --yes --purge"
                  % os.path.basename(__file__))
            print("      (b) 或交后端运行时删除（asset_orphan 表仅服务于运行时删除）")
        else:
            # 全部成功：清理上次可能遗留的失败清单
            if os.path.exists(PURGE_FAILED_FILE):
                try:
                    os.remove(PURGE_FAILED_FILE)
                except OSError:
                    pass
    else:
        print_step("4/4", "run：保留原对象（未传 --purge）")
        print("  默认不删原对象。确认 manifest 无误后，如需清理可执行：")
        print("    python %s run --yes --purge" % os.path.basename(__file__))

    print("\n[OK] run 完成。manifest 见 %s" % MANIFEST_FILE)


def cmd_orphans(args, creds, backend):
    print_step("1/2", "orphans：列举 assets/ 树")
    assets = []
    for key, size, lm in backend.list_prefix("assets/"):
        if key.endswith("/"):
            continue
        assets.append(key)
    assets = sorted(set(assets))
    print("  -> assets/ 下共 %d 个对象" % len(assets))

    referenced = set()
    if args.db:
        print_step("2/2", "orphans：尝试从 DB 读取引用")
        referenced = _scan_db_references(args.db, assets)
        print("  -> 从 DB 解析到 %d 个被引用的 assets key" % len(referenced))
    else:
        print_step("2/2", "orphans：未提供 --db，仅列出 assets/ 供人工核查")
        print("  提示：传 --db <path.sqlite> 可做 best-effort 引用比对。")

    orphans = [k for k in assets if k not in referenced]
    print("\n=== 孤儿对象（未被引用 / 待人工核查）===")
    for k in orphans:
        print("  - " + k)
    print("\n共 %d 个 assets 对象，其中 %d 个为孤儿/待核查。"
          % (len(assets), len(orphans)))
    if referenced:
        print("（已排除 %d 个被 DB 引用的对象）" % len(referenced))


def _scan_db_references(db_path, assets):
    """best-effort：扫描 sqlite 中所有文本列，提取含 'assets/' 子串的值作为引用 key。"""
    try:
        import sqlite3
    except ImportError:
        print("  [WARN] sqlite3 模块不可用，跳过 DB 引用比对。")
        return set()
    refs = set()
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        for tbl in tables:
            try:
                cur.execute("SELECT * FROM \"%s\" LIMIT 200" % tbl)
                cols = [d[0] for d in cur.description] if cur.description else []
                for row in cur.fetchall():
                    for val in row:
                        if isinstance(val, str) and "assets/" in val:
                            # 取形如 assets/... 的前缀片段作为 key（到第一个空白/引号为止）
                            for tok in val.replace('"', ' ').split():
                                if tok.startswith("assets/"):
                                    refs.add(tok.strip("\"');>"))
            except Exception:
                continue
        conn.close()
    except Exception as e:
        print("  [WARN] 读取 DB 失败（%s），仅列出 assets/ 树。" % e)
        return set()
    # 只保留确实存在于 assets 树中的引用
    return refs & set(assets)


# ----------------------------------------------------------------------------
# 入口
# ----------------------------------------------------------------------------
def build_parser():
    parser = argparse.ArgumentParser(
        description="PersonalSite COS 资产安全迁移脚本（inventory/plan/run/orphans）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="cmd")

    p_inv = sub.add_parser("inventory", help="只读盘点 public/、private/ 及根下对象")
    p_inv.add_argument("--coscmd", default=DEFAULT_COSCMD, help="coscmd.exe 路径（回退后端用）")

    p_plan = sub.add_parser("plan", help="规划目标 key（映射优先，否则启发式）")
    p_plan.add_argument("--mapping", default=None, help="映射文件 old_key->new_key (JSON)")

    p_run = sub.add_parser("run", help="桶内 copy 旧 key -> 新 key（默认不删原对象）")
    p_run.add_argument("--yes", action="store_true", help="真正执行 copy（否则仅预览）")
    p_run.add_argument("--purge", action="store_true", help="全部成功后删除原对象（须配合 --yes）")
    p_run.add_argument("--coscmd", default=DEFAULT_COSCMD, help="coscmd.exe 路径（回退后端用）")

    p_orph = sub.add_parser("orphans", help="列出 assets/ 下未被引用的对象")
    p_orph.add_argument("--db", default=None, help="可选 sqlite 路径，做 best-effort 引用比对")
    p_orph.add_argument("--coscmd", default=DEFAULT_COSCMD, help="coscmd.exe 路径（回退后端用）")

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    if args.cmd is None:
        parser.print_help()
        sys.exit(2)

    # inventory / orphans / run 需要桶访问；plan 纯本地
    backend = None
    coscmd_backend = None
    if args.cmd in ("inventory", "run", "orphans"):
        creds = read_creds()
        backend = get_backend(creds, args)
        if isinstance(backend, CoscmdBackend):
            coscmd_backend = backend
        try:
            if args.cmd == "inventory":
                cmd_inventory(args, creds, backend)
            elif args.cmd == "run":
                cmd_run(args, creds, backend)
            elif args.cmd == "orphans":
                cmd_orphans(args, creds, backend)
        finally:
            if coscmd_backend is not None:
                coscmd_backend._close()
    elif args.cmd == "plan":
        cmd_plan(args, None, None)
    else:
        parser.print_help()
        sys.exit(2)


if __name__ == "__main__":
    main()
