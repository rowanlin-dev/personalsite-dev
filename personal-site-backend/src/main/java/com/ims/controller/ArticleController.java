package com.ims.controller;

import com.ims.entity.Article;
import com.ims.entity.PageBean;
import com.ims.entity.PageQuery;
import com.ims.entity.Result;
import com.ims.service.ArticleService;
import com.ims.util.LikeRateLimiter;
import com.ims.util.ViewRateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/article")
public class ArticleController {

    private static final String LIKED_ARTICLE_IDS = "likedArticleIds";
    private static final String VIEWED_ARTICLE_IDS = "viewedArticleIds";

    @Autowired
    private ArticleService articleService;

    @Autowired
    private LikeRateLimiter likeRateLimiter;

    @Autowired
    private ViewRateLimiter viewRateLimiter;

    @GetMapping("/list")
    public Result<PageBean<Article>> list(PageQuery query,
                                          @RequestParam(required = false, name = "titleKey") String titleKey,
                                          @RequestParam(required = false, name = "tagKey") String tagKey) {
        return Result.ok(articleService.findPage(query, titleKey, tagKey));
    }

    @GetMapping("/detail")
    public Result<Article> detail(@RequestParam("id") Integer id, HttpServletRequest request, HttpSession session) {
        // 阅读量防刷：同一会话对同一文章只计一次；跨会话时再叠加 IP 级冷却，
        // 防止任意刷新/无痕/爬虫无限刷高阅读量。命中限流时静默不计数，但文章照常返回。
        Set<Integer> viewed = getViewedIds(session);
        boolean shouldCount = false;
        if (!viewed.contains(id)) {
            String ip = clientIp(request);
            if (viewRateLimiter.allowAndRecord(ip, id)) {
                shouldCount = true;
            }
        }
        if (shouldCount) {
            articleService.increaseViewCount(id);
            viewed.add(id);
            session.setAttribute(VIEWED_ARTICLE_IDS, viewed);
        }
        return Result.ok(articleService.getDetail(id));
    }

    @GetMapping("/info")
    public Result<Article> info(@RequestParam("id") Integer id) {
        return Result.ok(articleService.findById(id));
    }

    @PostMapping("/save")
    public Result<?> save(@RequestBody Article article) {
        Article saved = articleService.save(article);
        return saved != null ? Result.ok(saved) : Result.error("保存失败");
    }

    @PostMapping("/delete")
    public Result<?> delete(@RequestParam("id") Integer id) {
        return articleService.delete(id) ? Result.ok() : Result.error("删除失败");
    }

    @GetMapping("/liked")
    public Result<Boolean> liked(@RequestParam("id") Integer id, HttpSession session) {
        Set<Integer> liked = getLikedIds(session);
        return Result.ok(liked.contains(id));
    }

    @PostMapping("/like")
    public Result<?> like(@RequestParam("id") Integer id, HttpServletRequest request, HttpSession session) {
        Set<Integer> liked = getLikedIds(session);
        if (liked.contains(id)) {
            return Result.error("已赞");
        }
        // 匿名点赞防刷：IP + 文章 10 分钟冷却 + IP 全局 1 分钟频率限制
        String ip = clientIp(request);
        String blocked = likeRateLimiter.checkAndRecord(ip, id);
        if (blocked != null) {
            return Result.error(blocked);
        }
        boolean ok = articleService.like(id);
        if (!ok) {
            return Result.error("点赞失败");
        }
        liked.add(id);
        session.setAttribute(LIKED_ARTICLE_IDS, liked);
        return Result.ok();
    }

    /**
     * 解析客户端真实 IP：nginx 已透传 X-Forwarded-For / X-Real-IP，
     * 取 X-Forwarded-For 最左非 unknown 值，回退 X-Real-IP，最后回退 remoteAddr。
     */
    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String first = forwarded.split(",")[0].trim();
            if (!first.isEmpty() && !"unknown".equalsIgnoreCase(first)) {
                return first;
            }
        }
        String real = request.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) {
            return real.trim();
        }
        return request.getRemoteAddr();
    }

    @SuppressWarnings("unchecked")
    private Set<Integer> getLikedIds(HttpSession session) {
        Set<Integer> liked = (Set<Integer>) session.getAttribute(LIKED_ARTICLE_IDS);
        if (liked == null) {
            liked = new HashSet<>();
        }
        return liked;
    }

    @SuppressWarnings("unchecked")
    private Set<Integer> getViewedIds(HttpSession session) {
        Set<Integer> viewed = (Set<Integer>) session.getAttribute(VIEWED_ARTICLE_IDS);
        if (viewed == null) {
            viewed = new HashSet<>();
        }
        return viewed;
    }
}
