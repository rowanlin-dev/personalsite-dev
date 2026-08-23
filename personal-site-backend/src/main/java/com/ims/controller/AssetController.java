package com.ims.controller;

import com.ims.entity.Admin;
import com.ims.entity.AssetOrphan;
import com.ims.entity.Result;
import com.ims.service.AssetService;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 后台素材库 REST API（位于 /api/admin/**，自动受 LoginInterceptor + AdminForceChangeInterceptor 保护）。
 */
@RestController
@RequestMapping("/api/admin/assets")
public class AssetController {

    private static final Logger log = LoggerFactory.getLogger(AssetController.class);

    @Autowired
    private AssetService assetService;

    /**
     * 返回分区描述。头像/简历前缀由当前登录 admin 的 uid 解析为完整前缀
     * （assets/public/avatars/&lt;uid&gt;/、assets/private/resume/&lt;uid&gt;/）；
     * 博客/项目为动态分区，前端再用 slug 拼叶子前缀。
     */
    @GetMapping("/zones")
    public Result<?> zones(HttpSession session) {
        Integer uid = currentUid(session);
        String uidStr = uid != null ? String.valueOf(uid) : "me";
        List<Map<String, Object>> zones = new ArrayList<>();
        zones.add(zone("assets/public/avatars/" + uidStr + "/", "头像", "个人信息", false, null));
        zones.add(zone("assets/private/resume/" + uidStr + "/", "简历", "个人信息", false, null));
        zones.add(zone("assets/public/blogs/", "博客配图", "博客配图", true, "blogs"));
        zones.add(zone("assets/public/projects/", "项目配图", "项目配图", true, "projects"));
        return Result.ok(zones);
    }

    private Map<String, Object> zone(String key, String label, String group, boolean dynamic, String source) {
        Map<String, Object> m = new HashMap<>();
        m.put("key", key);
        m.put("label", label);
        m.put("group", group);
        m.put("dynamic", dynamic);
        m.put("source", source);
        return m;
    }

    private Integer currentUid(HttpSession session) {
        Admin admin = (Admin) session.getAttribute("admin");
        return admin != null ? admin.getId() : null;
    }

    @GetMapping("/list")
    public Result<?> list(@RequestParam String prefix) {
        return Result.ok(assetService.list(prefix));
    }

    @PostMapping("/upload")
    public Result<?> upload(@RequestParam String prefix,
                            @RequestParam("files") List<MultipartFile> files) {
        return Result.ok(assetService.upload(prefix, files));
    }

    @DeleteMapping("/objects")
    public Result<?> delete(@RequestBody List<String> keys) {
        assetService.delete(keys);
        return Result.ok();
    }

    @GetMapping("/sign")
    public Result<?> sign(@RequestParam String key) {
        return Result.ok(assetService.sign(key));
    }

    /**
     * Q3：复制前缀（新建文章 draft- 前缀 -> 真实 id 前缀），返回旧/新 key 与 URL 映射。
     * 只复制不删源；源对象由前端在正文回写成功后，走 /objects 删除接口清理。
     */
    @PostMapping("/copy")
    public Result<?> copy(@RequestParam String fromPrefix, @RequestParam String toPrefix) {
        return Result.ok(assetService.copyPrefix(fromPrefix, toPrefix));
    }

    /**
     * Q4：收录同桶外部 URL 到目标前缀（本地项目与线上共用同一 COS 仓库）。
     */
    @PostMapping("/import-url")
    public Result<?> importUrl(@RequestParam String url, @RequestParam String prefix) {
        return Result.ok(assetService.importUrl(url, prefix));
    }

    /**
     * 导入孤儿记录（迁移脚本导出的 migration_purge_failed.json 内容），返回成功写入条数。
     * 后端持有 DB 依赖，迁移脚本保持无 DB 依赖，职责清晰解耦。
     */
    @PostMapping("/orphans/import")
    public Result<?> importOrphans(@RequestBody List<AssetOrphan> orphans) {
        return Result.ok(assetService.importOrphans(orphans));
    }
}
