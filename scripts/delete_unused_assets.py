#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
delete_unused_assets.py — PersonalSite COS 孤立旧图彻底清理（生产不可逆删除）
================================================================================
【用途】
删除 8 张已确认无引用的孤立旧图（每个有两份 key：public/ 原始 + assets/ 迁移副本），
共 16 个删除动作。彻底清理，不可恢复。

【硬性安全约束（违反即严重事故）】
1. 删除列表 DELETION_KEYS 写死 16 个 key。脚本只会删这个列表里的 key，绝不动态拼 key，
   绝不碰任何列表外的对象。
2. PROTECTED_FRAGMENTS 列出 3 个"在用"资源的 UUID 片段，它们的任何副本都绝不可删：
      14758077-0c6f-411f-9ee5-fdedba719f8a  (微信二维码, public/ & assets/public/blogs/uncategorized/)
      304e3c70-5de6-421b-84fb-fa26a79adf0d  (简历 PDF,   public/ & assets/private/resume/1/)
      f29cb362-c1c1-4cd1-a541-be632975928f  (头像,       public/ & assets/public/avatars/1/)
   若 DELETION_KEYS 中任一 key 命中 PROTECTED_FRAGMENTS，立即中止整个运行并报警。
3. 删除前对每个 key 做 head_object 确认存在（不存在记为 skip，不报错）。
4. 删除后再对每个 key 做 head_object 确认已消失（应抛 404 / NoSuchKey）。
5. 密钥从环境变量注入（COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION），
   脚本绝不落盘密钥。

【执行】
  export COS_SECRET_ID='...'
  export COS_SECRET_KEY='...'
  export COS_BUCKET='personal-site-images-1312192644'
  export COS_REGION='ap-guangzhou'
  python delete_unused_assets.py
================================================================================
"""

import os
import sys
import json
import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MANIFEST_FILE = os.path.join(SCRIPT_DIR, "migration_delete_manifest.json")

# ----------------------------------------------------------------------------
# 写死的删除清单（严格 16 个 key，绝不多删一个）
# ----------------------------------------------------------------------------
DELETION_KEYS = [
    # 1) 21cc51b8
    "public/21cc51b8-5aca-468c-a64f-97c3d73eb7e7.png",
    "assets/public/blogs/uncategorized/21cc51b8-5aca-468c-a64f-97c3d73eb7e7.png",
    # 2) 444b7ba4
    "public/444b7ba4-4f3b-4ccc-b285-c3cedde8a334.png",
    "assets/public/blogs/uncategorized/444b7ba4-4f3b-4ccc-b285-c3cedde8a334.png",
    # 3) 6b4d79a9
    "public/6b4d79a9-e78c-415a-afc5-5222e9e61f0a.png",
    "assets/public/blogs/uncategorized/6b4d79a9-e78c-415a-afc5-5222e9e61f0a.png",
    # 4) 8d20465c
    "public/8d20465c-a853-4794-8c3d-0c52d251969b.png",
    "assets/public/blogs/uncategorized/8d20465c-a853-4794-8c3d-0c52d251969b.png",
    # 5) 8d875e8e
    "public/8d875e8e-d70b-45c4-bc2c-6568147e7edb.png",
    "assets/public/blogs/uncategorized/8d875e8e-d70b-45c4-bc2c-6568147e7edb.png",
    # 6) b78d0ff1
    "public/b78d0ff1-0556-4d54-af54-c7a515c4db64.png",
    "assets/public/blogs/uncategorized/b78d0ff1-0556-4d54-af54-c7a515c4db64.png",
    # 7) c31810d8
    "public/c31810d8-0aec-46a9-8443-2b072a2e811c.jpg",
    "assets/public/blogs/uncategorized/c31810d8-0aec-46a9-8443-2b072a2e811c.jpg",
    # 8) d6aef653
    "public/d6aef653-37c9-47e8-96ae-b5252a85c7ef.png",
    "assets/public/blogs/uncategorized/d6aef653-37c9-47e8-96ae-b5252a85c7ef.png",
]

# ----------------------------------------------------------------------------
# 绝对保护：这 3 个在用资源的 UUID 片段，任何副本都绝不可删
# ----------------------------------------------------------------------------
PROTECTED_FRAGMENTS = [
    "14758077-0c6f-411f-9ee5-fdedba719f8a",  # 微信二维码
    "304e3c70-5de6-421b-84fb-fa26a79adf0d",  # 简历 PDF
    "f29cb362-c1c1-4cd1-a541-be632975928f",  # 头像
]

# 8 张待删孤立图的 UUID（用于独立复核时确认它们不在桶里）
ORPHAN_UUIDS = {
    "21cc51b8-5aca-468c-a64f-97c3d73eb7e7",
    "444b7ba4-4f3b-4ccc-b285-c3cedde8a334",
    "6b4d79a9-e78c-415a-afc5-5222e9e61f0a",
    "8d20465c-a853-4794-8c3d-0c52d251969b",
    "8d875e8e-d70b-45c4-bc2c-6568147e7edb",
    "b78d0ff1-0556-4d54-af54-c7a515c4db64",
    "c31810d8-0aec-46a9-8443-2b072a2e811c",
    "d6aef653-37c9-47e8-96ae-b5252a85c7ef",
}

# 复核用的两个前缀
VERIFY_PREFIX_PUBLIC = "public/"
VERIFY_PREFIX_UNCATEGORIZED = "assets/public/blogs/uncategorized/"


def die(msg, code=1):
    print("[FATAL] " + msg, file=sys.stderr)
    sys.exit(code)


def read_creds():
    need = ["COS_SECRET_ID", "COS_SECRET_KEY", "COS_BUCKET", "COS_REGION"]
    missing = [k for k in need if not os.environ.get(k)]
    if missing:
        die("缺少必需环境变量（密钥）：" + ", ".join(missing))
    return {k: os.environ[k] for k in need}


class CosClient:
    def __init__(self, creds):
        from qcloud_cos import CosConfig, CosS3Client
        from qcloud_cos.cos_exception import CosServiceError
        config = CosConfig(
            Region=creds["COS_REGION"],
            SecretId=creds["COS_SECRET_ID"],
            SecretKey=creds["COS_SECRET_KEY"],
        )
        self.client = CosS3Client(config)
        self.bucket = creds["COS_BUCKET"]
        self.CosServiceError = CosServiceError

    def exists(self, key):
        """返回 (exists: bool, err: str|None)。exists=None 表示判断出错。"""
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True, None
        except self.CosServiceError as e:
            if e.get_status_code() == 404:
                return False, None
            return None, "CosServiceError status=%s %s" % (e.get_status_code(), e)
        except Exception as e:  # noqa: BLE001
            return None, "head error: %s" % e

    def delete(self, key):
        """返回 (deleted: bool, err: str|None)。deleted=True 表示删除请求成功。"""
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
            return True, None
        except self.CosServiceError as e:
            if e.get_status_code() == 404:
                # 已经不存在：视为删除成功（幂等）
                return True, None
            return False, "CosServiceError status=%s %s" % (e.get_status_code(), e)
        except Exception as e:  # noqa: BLE001
            return False, "delete error: %s" % e

    def list_prefix(self, prefix):
        """yield (key, size)。"""
        marker = ""
        while True:
            resp = self.client.list_objects(
                Bucket=self.bucket, Prefix=prefix, Marker=marker, MaxKeys=1000
            )
            for c in resp.get("Contents", []):
                if c["Key"].endswith("/"):
                    continue
                yield c["Key"], int(c.get("Size", 0))
            if resp.get("IsTruncated") == "true":
                marker = resp.get("NextMarker", "")
                if not marker:
                    break
            else:
                break


def main():
    print("=== delete_unused_assets.py ===")
    print("时间: %s" % datetime.datetime.now().isoformat())

    # ---- 0) 安全预检：删除列表里绝不可包含任何 PROTECTED 片段 ----
    print("\n[SAFETY] 预检：删除清单是否误含受保护资源 ...")
    for k in DELETION_KEYS:
        for frag in PROTECTED_FRAGMENTS:
            if frag in k:
                die("安全约束触发：删除清单含受保护片段 %s (key=%s)。"
                    "已中止整个运行，未删除任何对象！" % (frag, k))
    # 受保护片段之间也不能相互出现在删除列表
    for frag in PROTECTED_FRAGMENTS:
        if frag in " ".join(DELETION_KEYS) and frag not in []:
            pass  # 上面已逐 key 检查
    print("[SAFETY] OK：16 个删除 key 均不含受保护 UUID 片段。")

    if len(DELETION_KEYS) != 16:
        die("删除清单数量异常（应为 16，实际 %d），已中止。" % len(DELETION_KEYS))

    creds = read_creds()
    print("[INFO] 桶=%s 区域=%s" % (creds["COS_BUCKET"], creds["COS_REGION"]))
    cos = CosClient(creds)

    # ---- 1) 逐 key：head -> delete -> head 验证 ----
    manifest = []
    deleted_count = 0
    skip_count = 0
    error_count = 0

    for idx, key in enumerate(DELETION_KEYS, 1):
        print("\n[%d/%d] %s" % (idx, len(DELETION_KEYS), key))
        # 二次安全闸：删除前再确认不是受保护 key
        bad = [f for f in PROTECTED_FRAGMENTS if f in key]
        if bad:
            rec = {"key": key, "existed_before": None, "deleted": False,
                   "verified_gone": False,
                   "error": "SAFETY: protected fragment %s" % bad[0]}
            manifest.append(rec)
            error_count += 1
            print("  [ABORT-KEY] 命中受保护片段，跳过并报警：%s" % bad[0])
            continue

        existed_before, err = cos.exists(key)
        if existed_before is None:
            rec = {"key": key, "existed_before": None, "deleted": False,
                   "verified_gone": False, "error": "head failed: %s" % err}
            manifest.append(rec)
            error_count += 1
            print("  [ERROR] head 失败：%s" % err)
            continue
        if not existed_before:
            rec = {"key": key, "existed_before": False, "deleted": False,
                   "verified_gone": True, "error": None}
            manifest.append(rec)
            skip_count += 1
            print("  [SKIP] 对象不存在，跳过（记为已消失）。")
            continue

        # 存在 -> 删除
        ok, derr = cos.delete(key)
        if not ok:
            rec = {"key": key, "existed_before": True, "deleted": False,
                   "verified_gone": False, "error": "delete failed: %s" % derr}
            manifest.append(rec)
            error_count += 1
            print("  [ERROR] 删除失败：%s" % derr)
            continue

        # 删除后验证消失
        gone, verr = cos.exists(key)
        verified_gone = (gone is False)
        rec = {"key": key, "existed_before": True, "deleted": True,
               "verified_gone": verified_gone,
               "error": ("verify head: %s" % verr) if verr else None}
        manifest.append(rec)
        deleted_count += 1
        if verified_gone:
            print("  [OK] 已删除并确认消失。")
        else:
            error_count += 1
            print("  [WARN] 删除请求成功，但复核 head 仍返回存在（可能一致性延迟）：%s" % verr)

    # ---- 2) 写出 manifest ----
    out = {
        "generated_at": datetime.datetime.now().isoformat(),
        "bucket": creds["COS_BUCKET"],
        "region": creds["COS_REGION"],
        "summary": {
            "total_keys": len(DELETION_KEYS),
            "deleted": deleted_count,
            "skipped_not_exist": skip_count,
            "errors": error_count,
        },
        "records": manifest,
    }
    with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("\n=== 第一阶段完成 ===")
    print("删除 %d / 跳过(不存在) %d / 错误 %d" % (deleted_count, skip_count, error_count))
    print("manifest -> %s" % MANIFEST_FILE)

    # ---- 3) 独立复核：列出 public/ 与 uncategorized/ 前缀 ----
    print("\n=== 独立复核：前缀对象计数 ===")
    pub_keys = [k for k, _ in cos.list_prefix(VERIFY_PREFIX_PUBLIC)]
    unc_keys = [k for k, _ in cos.list_prefix(VERIFY_PREFIX_UNCATEGORIZED)]

    pub_remaining_orphans = [k for k in pub_keys
                             if any(u in k for u in ORPHAN_UUIDS)]
    unc_remaining_orphans = [k for k in unc_keys
                             if any(u in k for u in ORPHAN_UUIDS)]
    # 确认 3 个受保护 key 仍在
    pub_protected = [f for f in PROTECTED_FRAGMENTS if any(f in k for k in pub_keys)]
    unc_protected = [f for f in PROTECTED_FRAGMENTS if any(f in k for k in unc_keys)]

    verify = {
        "public_prefix": {
            "count": len(pub_keys),
            "orphans_remaining": pub_remaining_orphans,
            "protected_present": pub_protected,
        },
        "uncategorized_prefix": {
            "count": len(unc_keys),
            "orphans_remaining": unc_remaining_orphans,
            "protected_present": unc_protected,
        },
    }
    print("public/ 对象数: %d" % len(pub_keys))
    print("  - 残留孤立图: %s" % (pub_remaining_orphans or "无"))
    print("  - 受保护 key 在 public/: %s" % (pub_protected or "无"))
    print("uncategorized/ 对象数: %d" % len(unc_keys))
    print("  - 残留孤立图: %s" % (unc_remaining_orphans or "无"))
    print("  - 受保护 key 在 uncategorized/: %s" % (unc_protected or "无"))

    out["verification"] = verify
    # 把复核结果也写回 manifest
    with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    # ---- 4) 终判 ----
    all_gone = (not pub_remaining_orphans) and (not unc_remaining_orphans)
    if error_count == 0 and all_gone:
        print("\n[OK] 全部 16 个 key 处理完毕，8 张孤立图均不在桶内，无错误。")
    else:
        print("\n[WARN] 复核需关注：errors=%d, 残留孤立图=%d"
              % (error_count, len(pub_remaining_orphans) + len(unc_remaining_orphans)))
    print("最终 manifest -> %s" % MANIFEST_FILE)


if __name__ == "__main__":
    main()
