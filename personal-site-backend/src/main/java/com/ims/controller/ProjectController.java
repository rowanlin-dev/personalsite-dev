package com.ims.controller;

import com.ims.entity.PageBean;
import com.ims.entity.PageQuery;
import com.ims.entity.Project;
import com.ims.entity.Result;
import com.ims.service.ProjectService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/project")
public class ProjectController {

    @Autowired
    private ProjectService projectService;

    @GetMapping("/list")
    public Result<PageBean<Project>> list(PageQuery query) {
        return Result.ok(projectService.findPage(query));
    }

    @GetMapping("/all")
    public Result<List<Project>> all() {
        return Result.ok(projectService.findAll());
    }

    @GetMapping("/detail")
    public Result<Project> detail(@RequestParam Integer id) {
        return Result.ok(projectService.findById(id));
    }

    @PostMapping("/save")
    public Result<?> save(@RequestBody Project project) {
        return projectService.save(project) ? Result.ok() : Result.error("保存失败");
    }

    @PostMapping("/delete")
    public Result<?> delete(@RequestParam Integer id) {
        return projectService.delete(id) ? Result.ok() : Result.error("删除失败");
    }
}
