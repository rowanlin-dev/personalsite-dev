package com.ims.controller;

import com.ims.entity.PageBean;
import com.ims.entity.PageQuery;
import com.ims.entity.Result;
import com.ims.entity.Skill;
import com.ims.service.SkillService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/skill")
public class SkillController {

    @Autowired
    private SkillService skillService;

    @GetMapping("/list")
    public Result<PageBean<Skill>> list(PageQuery query) {
        return Result.ok(skillService.findPage(query));
    }

    @GetMapping("/all")
    public Result<List<Skill>> all() {
        return Result.ok(skillService.findAll());
    }

    @GetMapping("/detail")
    public Result<Skill> detail(@RequestParam Integer id) {
        return Result.ok(skillService.findById(id));
    }

    @GetMapping("/radar")
    public Result<Map<String, Object>> radar() {
        return Result.ok(skillService.radarData());
    }

    @PostMapping("/save")
    public Result<?> save(@RequestBody Skill skill) {
        try {
            return skillService.save(skill) ? Result.ok() : Result.error("保存失败");
        } catch (IllegalArgumentException e) {
            // 业务校验失败返回明确信息（HTTP 仍 200，前端按 code 区分）
            return Result.error(e.getMessage());
        }
    }

    @PostMapping("/create-from-tag")
    public Result<?> createFromTag(@RequestBody Map<String, Integer> body) {
        try {
            Integer tagId = body.get("tagId");
            Integer level = body.get("level");
            return skillService.createFromTag(tagId, level) ? Result.ok() : Result.error("创建失败");
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        }
    }

    @PostMapping("/delete")
    public Result<?> delete(@RequestParam Integer id) {
        return skillService.delete(id) ? Result.ok() : Result.error("删除失败");
    }
}
