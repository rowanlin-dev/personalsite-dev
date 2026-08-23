package com.ims.controller;

import com.ims.entity.ArticleCollection;
import com.ims.entity.CollectionArticlesVO;
import com.ims.entity.Result;
import com.ims.service.CollectionService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 合集公开读 REST API（位于 /api/collections/**，已在 spring-mvc.xml 放开 LoginInterceptor）。
 * 私有合集（is_public=0）仅对管理员可见，非 admin 调用返回「无权访问」。
 */
@RestController
@RequestMapping("/api/collections")
public class CollectionViewController {

    @Autowired
    private CollectionService collectionService;

    /**
     * 公开合集详情：合集元信息 + 按 sort_order 排序的标题列表。
     * 鉴权：已登录（session 含 loginUser）视为管理员，可查看私有合集；否则私有合集返回「无权访问」。
     */
    @GetMapping("/{id}/articles")
    public Result<CollectionArticlesVO> articles(@PathVariable Integer id, HttpSession session) {
        boolean isAdmin = session.getAttribute("loginUser") != null;
        ArticleCollection col = collectionService.findById(id);
        if (col == null) {
            return Result.error("合集不存在");
        }
        if (Boolean.FALSE.equals(col.getIsPublic()) && !isAdmin) {
            return Result.error("无权访问");
        }
        return Result.ok(collectionService.buildArticles(id));
    }
}
