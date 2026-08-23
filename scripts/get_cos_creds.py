#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
get_cos_creds.py — 一键取生产 COS 密钥（不落盘、只输出可 source 的 export 语句）

背景：deploy_frontend.py 从环境变量读 COS 密钥（绝不落盘）。生产密钥在
服务器 /opt/personalsite/.env（root 600，ubuntu 免密 sudo 可读）。
本脚本通过 ssh（免密密钥，与 scp 传包同密钥）读生产 .env，把前端发布
需要的 4 个变量以 export 语句输出到 stdout，供 eval 注入当前 shell。

用法（bash）：
    eval "$(python scripts/get_cos_creds.py)"
    # 然后直接：
    python scripts/deploy_frontend.py deploy --build --fast

说明：
- 生产 .env 里的 COS_BUCKET 是【图片桶】personal-site-images-1312192644，
  前端发布需要【web 桶】personalsite-web-1312192644，因此这里固定导出 web 桶。
- 密钥不写文件、不进命令历史（仅以 stdout 输出 export 语句）。
- 服务器 / 用户 / 密钥路径可用环境变量 PROD_HOST / PROD_USER / PROD_SSH_KEY 覆盖。
"""

import os
import shutil
import subprocess
import sys

# 生产机信息（可用环境变量覆盖）
PROD_HOST = os.environ.get("PROD_HOST", "<PROD_HOST>")
PROD_USER = os.environ.get("PROD_USER", "ubuntu")
PROD_SSH_KEY = os.environ.get("PROD_SSH_KEY", "<PROD_SSH_KEY_PATH>")
ENV_FILE = "/opt/personalsite/.env"

# 前端发布固定使用 web 桶（生产 .env 的 COS_BUCKET 是图片桶，不能复用）
WEB_BUCKET = os.environ.get("COS_WEB_BUCKET", "personalsite-web-1312192644")
WEB_REGION = os.environ.get("COS_WEB_REGION", "ap-guangzhou")

# 需要从生产 .env 读取的键
NEED_KEYS = ("COS_SECRET_ID", "COS_SECRET_KEY")


def main():
    ssh = shutil.which("ssh") or "ssh"
    remote = "sudo cat %s | grep -E '^(%s)='" % (ENV_FILE, "|".join(NEED_KEYS))
    cmd = [ssh, "-i", PROD_SSH_KEY,
           "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=15",
           "%s@%s" % (PROD_USER, PROD_HOST), remote]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        sys.stderr.write("[ERROR] 获取生产密钥失败：%s\n" % e)
        sys.exit(1)
    if r.returncode != 0:
        sys.stderr.write("[ERROR] ssh 读取 %s 失败：%s\n" % (ENV_FILE, r.stderr.strip()))
        sys.exit(1)

    values = {}
    for line in r.stdout.splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            if k in NEED_KEYS and v:
                values[k] = v

    missing = [k for k in NEED_KEYS if k not in values]
    if missing:
        sys.stderr.write("[ERROR] 生产 .env 缺少键：%s\n" % ", ".join(missing))
        sys.exit(1)

    print('export COS_SECRET_ID=%s' % values["COS_SECRET_ID"])
    print('export COS_SECRET_KEY=%s' % values["COS_SECRET_KEY"])
    print("export COS_BUCKET=%s" % WEB_BUCKET)
    print("export COS_REGION=%s" % WEB_REGION)
    print("[ok] 已注入 COS 密钥（SecretId 前 6 位：%s）" % values["COS_SECRET_ID"][:6], file=sys.stderr)


if __name__ == "__main__":
    main()
