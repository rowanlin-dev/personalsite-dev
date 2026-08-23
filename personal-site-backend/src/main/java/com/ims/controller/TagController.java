package com.ims.controller;

import com.ims.entity.Result;
import com.ims.entity.Tag;
import com.ims.entity.TagAlias;
import com.ims.service.TagService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tag")
public class TagController {

    @Autowired
    private TagService tagService;

    @GetMapping("/list")
    public Result<List<Tag>> list() {
        return Result.ok(tagService.findAll());
    }

    @GetMapping("/list-with-aliases")
    public Result<List<Tag>> listWithAliases() {
        return Result.ok(tagService.findAllWithAliases());
    }

    @GetMapping("/tree")
    public Result<List<Tag>> tree() {
        return Result.ok(tagService.findTree());
    }

    @GetMapping("/search")
    public Result<List<Tag>> search(@RequestParam String keyword) {
        return Result.ok(tagService.searchByName(keyword));
    }

    @PostMapping("/save")
    public Result<?> save(@RequestBody Tag tag) {
        return tagService.saveTag(tag) ? Result.ok() : Result.error("保存失败，名称可能已存在或父标签设置错误");
    }

    @PostMapping("/delete")
    public Result<?> delete(@RequestParam Integer id) {
        return tagService.deleteTag(id) ? Result.ok() : Result.error("删除失败，该标签存在子标签或仍被引用");
    }

    @GetMapping("/alias")
    public Result<List<TagAlias>> aliases(@RequestParam Integer tagId) {
        return Result.ok(tagService.findAliasesByTagId(tagId));
    }

    @PostMapping("/alias/save")
    public Result<?> saveAlias(@RequestBody TagAlias alias) {
        return tagService.saveAlias(alias) ? Result.ok() : Result.error("保存失败，别名可能已存在或与标签名冲突");
    }

    @PostMapping("/alias/delete")
    public Result<?> deleteAlias(@RequestParam Integer id) {
        return tagService.deleteAlias(id) ? Result.ok() : Result.error("删除失败");
    }

    @GetMapping("/cloud")
    public Result<List<Map<String, Object>>> cloud() {
        return Result.ok(tagService.findTagCloud());
    }

    @GetMapping("/tech-map")
    public Result<List<Map<String, Object>>> techMap() {
        return Result.ok(tagService.findTechMapData());
    }
}
