package com.ims.controller;

import com.ims.entity.Result;
import com.ims.service.SiteConfigService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/config")
public class SiteConfigController {

    @Autowired
    private SiteConfigService siteConfigService;

    @GetMapping("/all")
    public Result<Map<String, String>> all() {
        return Result.ok(siteConfigService.findAll());
    }

    @GetMapping("/about")
    public Result<Map<String, String>> about() {
        Map<String, String> map = new HashMap<>();
        map.put("title", siteConfigService.getValue("about_title"));
        map.put("content", siteConfigService.getValue("about_content"));
        return Result.ok(map);
    }

    @GetMapping("/contact")
    public Result<Map<String, String>> contact() {
        Map<String, String> map = new HashMap<>();
        map.put("email", siteConfigService.getValue("contact_email"));
        map.put("github", siteConfigService.getValue("contact_github"));
        map.put("wechat", siteConfigService.getValue("contact_wechat"));
        return Result.ok(map);
    }

    @GetMapping("/resume")
    public Result<Map<String, Object>> resume() {
        String enable = siteConfigService.getValue("resume_enable");
        Map<String, Object> map = new HashMap<>();
        map.put("enable", "1".equals(enable));
        map.put("url", siteConfigService.getValue("resume_pdf"));
        return Result.ok(map);
    }

    @GetMapping("/avatar")
    public Result<Map<String, Object>> avatar() {
        Map<String, Object> map = new HashMap<>();
        map.put("url", siteConfigService.getValue("avatar_url"));
        String show = siteConfigService.getValue("avatar_show");
        map.put("show", "1".equals(show));
        return Result.ok(map);
    }

    @PostMapping("/save")
    public Result<?> save(@RequestParam String key, @RequestParam String value) {
        return siteConfigService.save(key, value) ? Result.ok() : Result.error("保存失败");
    }
}
