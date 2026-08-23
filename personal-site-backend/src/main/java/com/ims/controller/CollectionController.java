package com.ims.controller;

import com.ims.entity.ArticleCollection;
import com.ims.entity.CollectionArticlesBody;
import com.ims.entity.CollectionSortBody;
import com.ims.entity.Result;
import com.ims.service.CollectionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 合集后台管理 REST API（位于 /api/admin/collections/**，
 * 自动受 LoginInterceptor + AdminForceChangeInterceptor 保护，无需额外安全代码）。
 */
@RestController
@RequestMapping("/api/admin/collections")
public class CollectionController {

    @Autowired
    private CollectionService collectionService;

    /** 合集列表，每项含实时 articleCount */
    @GetMapping
    public Result<List<ArticleCollection>> list() {
        return Result.ok(collectionService.findAllWithCount());
    }

    /** 新建合集（body 无 id）；name 重复捕获唯一键异常，禁止 500 */
    @PostMapping
    public Result<ArticleCollection> create(@RequestBody ArticleCollection collection) {
        try {
            ArticleCollection saved = collectionService.create(collection);
            return saved != null ? Result.ok(saved) : Result.error("创建失败");
        } catch (DuplicateKeyException e) {
            return Result.error("合集名已存在");
        }
    }

    /** upsert（body 含 id 即重命名/改元数据），镜像 ArticleController.save */
    @PostMapping("/save")
    public Result<ArticleCollection> save(@RequestBody ArticleCollection collection) {
        try {
            ArticleCollection saved = collectionService.save(collection);
            return saved != null ? Result.ok(saved) : Result.error("保存失败");
        } catch (DuplicateKeyException e) {
            return Result.error("合集名已存在");
        }
    }

    @DeleteMapping("/{id}")
    public Result<?> delete(@PathVariable Integer id) {
        return collectionService.delete(id) ? Result.ok() : Result.error("删除失败");
    }

    /** 批量加入文章：幂等（已存在跳过），新项追加到末尾 */
    @PostMapping("/{collectionId}/articles")
    public Result<?> addArticles(@PathVariable Integer collectionId,
                                 @RequestBody CollectionArticlesBody body) {
        collectionService.addArticles(collectionId, body.getArticleIds());
        return Result.ok();
    }

    /** 移除单篇：幂等 */
    @DeleteMapping("/{id}/articles/{articleId}")
    public Result<?> removeArticle(@PathVariable Integer id,
                                   @PathVariable Integer articleId) {
        collectionService.removeArticle(id, articleId);
        return Result.ok();
    }

    /** 按传入顺序重写 sort_order（事务内，PUT 契约） */
    @PutMapping("/{id}/articles/sort")
    public Result<?> sortArticles(@PathVariable Integer id,
                                  @RequestBody CollectionSortBody body) {
        collectionService.sortArticles(id, body.getOrderedArticleIds());
        return Result.ok();
    }
}
