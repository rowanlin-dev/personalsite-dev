package com.ims.controller;

import com.ims.entity.Result;
import com.ims.entity.TechRelation;
import com.ims.service.TechRelationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tech-relation")
public class TechRelationController {

    @Autowired
    private TechRelationService techRelationService;

    @GetMapping("/list")
    public Result<List<TechRelation>> list() {
        return Result.ok(techRelationService.findAll());
    }

    @PostMapping("/save")
    public Result<?> save(@RequestBody Map<String, Object> body) {
        try {
            Integer source = (Integer) body.get("sourceSkillId");
            Integer target = (Integer) body.get("targetSkillId");
            String type = (String) body.get("relationType");
            return techRelationService.save(source, target, type)
                    ? Result.ok() : Result.error("保存失败");
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        }
    }
}
