package com.ims.service;

import com.ims.entity.AssetOrphan;
import com.ims.mapper.AssetOrphanMapper;
import com.ims.util.COSUtil;
import com.ims.util.CdnUtil;
import com.ims.util.CosObjectInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 素材库（COS 资产）业务。
 * 删除时逐 key 捕获异常，单 key 失败不影响其他；公开对象 best-effort 触发 CDN 刷新，
 * 删除异常经 AssetOrphanMapper 记录孤儿兜底。
 */
@Service
public class AssetService {

    private static final Logger log = LoggerFactory.getLogger(AssetService.class);

    @Autowired
    private COSUtil cosUtil;

    @Autowired
    private CdnUtil cdnUtil;

    @Autowired
    private AssetOrphanMapper assetOrphanMapper;

    public List<Map<String, Object>> list(String prefix) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (CosObjectInfo info : cosUtil.listByPrefix(prefix)) {
            Map<String, Object> m = new HashMap<>();
            m.put("key", info.key());
            m.put("url", buildUrl(info.key()));
            m.put("size", info.size());
            m.put("lastModified", info.lastModified());
            m.put("owner", null);
            result.add(m);
        }
        return result;
    }

    public List<Map<String, Object>> upload(String prefix, List<MultipartFile> files) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (files == null) {
            return result;
        }
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            String url = cosUtil.uploadTo(prefix, file);
            String key = cosUtil.keyFromUrl(url);
            Map<String, Object> m = new HashMap<>();
            m.put("key", key);
            m.put("url", buildUrl(key));
            result.add(m);
        }
        return result;
    }

    /**
     * 公开 key 返回公开 URL；私有（assets/private/）key 返回签名 URL，前端可直接访问。
     */
    private String buildUrl(String key) {
        if (key.startsWith("assets/private/")) {
            return cosUtil.generatePresignedUrl(key, 600);
        }
        return cosUtil.publicUrl(key);
    }

    /**
     * 逐 key 删除。公开对象触发 CDN URL 刷新；任一 key 失败则记录孤儿，不影响其余 key。
     */
    public void delete(List<String> keys) {
        if (keys == null) {
            return;
        }
        for (String key : keys) {
            if (key == null || key.isBlank()) {
                continue;
            }
            try {
                cosUtil.deleteObject(key);
                if (key.startsWith("assets/public/")) {
                    try {
                        cdnUtil.purgeUrlsCache(List.of(cosUtil.publicUrl(key)));
                    } catch (Exception e) {
                        log.warn("CDN 刷新跳过（不影响删除）: {}", key, e);
                    }
                }
            } catch (Exception e) {
                log.warn("删除 COS 对象失败，记录孤儿: {}", key, e);
                try {
                    AssetOrphan orphan = new AssetOrphan();
                    orphan.setObjectKey(key);
                    orphan.setReason(e.getMessage());
                    assetOrphanMapper.insert(orphan);
                } catch (Exception ex) {
                    log.error("写入孤儿表失败: {}", key, ex);
                }
            }
        }
    }

    public String sign(String key) {
        return cosUtil.generatePresignedUrl(key, 600);
    }

    /**
     * 复制整个前缀下的对象到新前缀（copy only，不删源）。
     * 用于 Q3：新建文章先用 draft- 前缀上传，保存拿到真实 id 后把图片复制到
     * assets/public/blogs/&lt;id&gt;/，素材库才能按文章聚合看到。
     * 返回 [{ oldKey, oldUrl, newKey, newUrl }]，单个对象失败不影响其余。
     * 源对象由前端在文章内容回写成功后，再走既有 /objects 删除接口清理（安全顺序）。
     */
    public List<Map<String, Object>> copyPrefix(String fromPrefix, String toPrefix) {
        List<Map<String, Object>> result = new ArrayList<>();
        String from = normalizePrefix(fromPrefix);
        String to = normalizePrefix(toPrefix);
        if (from == null || to == null || from.equals(to)) {
            return result;
        }
        for (CosObjectInfo info : cosUtil.listByPrefix(from)) {
            String srcKey = info.key();
            String fileName = srcKey.substring(from.length());
            if (fileName.isEmpty()) {
                continue; // 跳过前缀占位对象
            }
            String destKey = to + fileName;
            try {
                cosUtil.copyObject(srcKey, destKey);
                Map<String, Object> m = new HashMap<>();
                m.put("oldKey", srcKey);
                m.put("oldUrl", buildUrl(srcKey));
                m.put("newKey", destKey);
                m.put("newUrl", buildUrl(destKey));
                result.add(m);
                try {
                    cdnUtil.purgeUrlsCache(List.of(cosUtil.publicUrl(destKey)));
                } catch (Exception e) {
                    log.warn("CDN 刷新跳过（不影响复制）: {}", destKey, e);
                }
            } catch (Exception e) {
                log.warn("复制素材失败（跳过该对象）: {} -> {}", srcKey, destKey, e);
            }
        }
        return result;
    }

    /**
     * 收录同桶外部 URL 到目标前缀（Q4）。
     * 本地项目与线上共用同一 COS 仓库时，图片链接本就是本桶对象：
     * 校验 URL 反解的 key 真实存在后，复制一份到当前文章前缀，
     * 既让素材库可见，也不破坏原 URL 的引用。
     * 返回 [{ key, url }]。
     */
    public Map<String, Object> importUrl(String url, String toPrefix) {
        String key = keyFromExternalUrl(url);
        if (key == null) {
            throw new IllegalArgumentException("无法解析的图片链接，仅支持本站 COS 仓库的对象");
        }
        if (!cosUtil.doesObjectExist(key)) {
            throw new IllegalArgumentException("链接对应对象不存在或已被删除：" + key);
        }
        String to = normalizePrefix(toPrefix);
        if (to == null) {
            throw new IllegalArgumentException("目标前缀不合法");
        }
        // 若目标对象已存在（同 key 重复收录），直接返回，不重复复制
        String destKey = to + key.substring(key.lastIndexOf('/') + 1);
        if (!destKey.equals(key) && !cosUtil.doesObjectExist(destKey)) {
            cosUtil.copyObject(key, destKey);
        }
        Map<String, Object> m = new HashMap<>();
        m.put("key", destKey);
        m.put("url", buildUrl(destKey));
        return m;
    }

    /**
     * 从外部 URL 反解 COS key：
     * 1) 裸 key（assets/...）直接用；
     * 2) 本桶公开域名 URL（cos.domain）用 keyFromUrl 反解；
     * 3) CDN 域名（minipluto.cn）或带签名参数的其他域名，取 path 部分校验。
     * 反解结果统一交给 doesObjectExist 做真实性校验，杜绝任意路径注入。
     */
    private String keyFromExternalUrl(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String trimmed = url.trim();
        // 裸 key 形态
        if (trimmed.startsWith("assets/")) {
            return trimmed;
        }
        try {
            java.net.URI uri = java.net.URI.create(trimmed);
            String path = uri.getPath();
            if (path == null || path.isBlank()) {
                return null;
            }
            String candidate = path.startsWith("/") ? path.substring(1) : path;
            if (candidate.startsWith("assets/")) {
                return candidate;
            }
        } catch (Exception e) {
            // fallthrough
        }
        // cos.domain 域名走原反解（也兜底一次）
        String key = cosUtil.keyFromUrl(trimmed);
        return key.startsWith("assets/") ? key : null;
    }

    private String normalizePrefix(String prefix) {
        if (prefix == null || prefix.isBlank()) {
            return null;
        }
        String p = prefix.trim();
        return p.endsWith("/") ? p : p + "/";
    }

    /**
     * 导入孤儿记录（供迁移脚本导出文件 / 定时任务调用）。逐条插入，单条失败不影响其他。
     */
    public int importOrphans(List<AssetOrphan> orphans) {
        if (orphans == null) {
            return 0;
        }
        int n = 0;
        for (AssetOrphan o : orphans) {
            if (o == null || o.getObjectKey() == null || o.getObjectKey().isBlank()) {
                continue;
            }
            try {
                assetOrphanMapper.insert(o);
                n++;
            } catch (Exception e) {
                log.warn("导入孤儿记录失败: {}", o.getObjectKey(), e);
            }
        }
        return n;
    }
}
