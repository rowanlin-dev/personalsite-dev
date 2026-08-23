package com.ims.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 匿名阅读量防刷限流器（纯内存，单机部署够用）。
 *
 * 与点赞防刷（LikeRateLimiter）共享设计，但语义更宽松：本类只用于「决定是否给某次
 * 文章访问计一次阅读量」，命中限流时调用方应「静默不计数、仍正常返回文章」，
 * 而不是返回错误——阅读量计数失败绝不能影响文章正常展示。
 *
 * 两层防线（会话级去重在 ArticleController 用 HttpSession 实现，本类负责 IP 级）：
 * 1) IP + 文章冷却：同一 IP 对同一文章在冷却期内（默认 30 分钟）只放行计数一次，
 *    防止「清 cookie / 换浏览器 / 无痕」重刷同一篇文章刷高阅读量；
 * 2) IP 全局频率：同一 IP 在滑动窗口（默认 1 分钟）内最多允许 N 次阅读计数
 *    （默认 60 次），防脚本对多篇文章连续轰炸。
 *
 * 并发安全：ConcurrentHashMap + 每 key 同步块；定时任务周期清理过期条目防内存泄漏。
 */
@Component
public class ViewRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(ViewRateLimiter.class);

    /** 同一 IP 对同一文章的计数冷却时长（毫秒） */
    private static final long ARTICLE_COOLDOWN_MS = 30 * 60 * 1000L;

    /** IP 全局滑动窗口时长（毫秒） */
    private static final long IP_WINDOW_MS = 60 * 1000L;

    /** IP 窗口内最大计数次数 */
    private static final int IP_MAX_PER_WINDOW = 60;

    /** 清理周期（毫秒） */
    private static final long CLEANUP_INTERVAL_MS = 10 * 60 * 1000L;

    /** key = ip + ":" + articleId -> 最近一次放行计数时间戳 */
    private final Map<String, Long> articleCooldown = new ConcurrentHashMap<>();

    /** key = ip -> 窗口内计数时间戳队列（队首最旧） */
    private final Map<String, Deque<Long>> ipWindow = new ConcurrentHashMap<>();

    private final ScheduledExecutorService cleaner = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "view-rate-limiter-cleaner");
        t.setDaemon(true);
        return t;
    });

    public ViewRateLimiter() {
        cleaner.scheduleWithFixedDelay(this::cleanup, CLEANUP_INTERVAL_MS, CLEANUP_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    /**
     * 检查并记录一次阅读计数。放行返回 true（调用方应执行 +1）；被限流返回 false
     * （调用方应静默跳过计数，但文章照常返回）。
     *
     * @param ip        客户端真实 IP（由 controller 解析 X-Forwarded-For 等后传入）
     * @param articleId 文章 id
     */
    public boolean allowAndRecord(String ip, Integer articleId) {
        if (ip == null || ip.isBlank() || articleId == null) {
            // 参数缺失无法防护，放行（宁可多计也不挡内容）
            return true;
        }
        long now = System.currentTimeMillis();

        // 防线 1：IP + 文章冷却
        String key = ip + ":" + articleId;
        Long last = articleCooldown.get(key);
        if (last != null && now - last < ARTICLE_COOLDOWN_MS) {
            return false;
        }

        // 防线 2：IP 全局滑动窗口频率
        Deque<Long> window = ipWindow.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (window) {
            while (!window.isEmpty() && now - window.peekFirst() > IP_WINDOW_MS) {
                window.pollFirst();
            }
            if (window.size() >= IP_MAX_PER_WINDOW) {
                return false;
            }
            window.addLast(now);
        }

        // 记录冷却时间戳，放行计数
        articleCooldown.put(key, now);
        return true;
    }

    /**
     * 周期清理过期条目：冷却失效的 IP+文章 记录、窗口已空的 IP 队列。
     */
    private void cleanup() {
        try {
            long now = System.currentTimeMillis();
            articleCooldown.entrySet().removeIf(e -> now - e.getValue() > ARTICLE_COOLDOWN_MS);
            ipWindow.entrySet().removeIf(e -> {
                Deque<Long> q = e.getValue();
                synchronized (q) {
                    while (!q.isEmpty() && now - q.peekFirst() > IP_WINDOW_MS) {
                        q.pollFirst();
                    }
                    return q.isEmpty();
                }
            });
        } catch (Exception ex) {
            log.warn("阅读限流清理失败（不影响功能）", ex);
        }
    }
}
