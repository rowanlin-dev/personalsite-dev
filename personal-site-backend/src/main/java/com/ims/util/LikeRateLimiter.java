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
 * 匿名点赞防刷限流器（纯内存，单机部署够用）。
 *
 * 三层防线：
 * 1) 会话去重（controller 现有 session Set，本类不涉及）；
 * 2) IP + 文章冷却：同一 IP 对同一文章在冷却期内（默认 10 分钟）只能成功点赞一次，
 *    防止「清 cookie / 换浏览器 / 无痕」重刷同一篇文章；
 * 3) IP 全局频率：同一 IP 在滑动窗口（默认 1 分钟）内最多允许 N 次点赞（默认 30 次），
 *    防脚本对多篇文章连续轰炸。
 *
 * 并发安全：ConcurrentHashMap + 每 key 同步块；定时任务周期清理过期条目防内存泄漏。
 */
@Component
public class LikeRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(LikeRateLimiter.class);

    /** 同一 IP 对同一文章的点赞冷却时长（毫秒） */
    private static final long ARTICLE_COOLDOWN_MS = 10 * 60 * 1000L;

    /** IP 全局滑动窗口时长（毫秒） */
    private static final long IP_WINDOW_MS = 60 * 1000L;

    /** IP 窗口内最大点赞次数 */
    private static final int IP_MAX_PER_WINDOW = 30;

    /** 清理周期（毫秒） */
    private static final long CLEANUP_INTERVAL_MS = 10 * 60 * 1000L;

    /** key = ip + ":" + articleId -> 最近一次成功点赞时间戳 */
    private final Map<String, Long> articleCooldown = new ConcurrentHashMap<>();

    /** key = ip -> 窗口内点赞时间戳队列（队首最旧） */
    private final Map<String, Deque<Long>> ipWindow = new ConcurrentHashMap<>();

    private final ScheduledExecutorService cleaner = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "like-rate-limiter-cleaner");
        t.setDaemon(true);
        return t;
    });

    public LikeRateLimiter() {
        cleaner.scheduleWithFixedDelay(this::cleanup, CLEANUP_INTERVAL_MS, CLEANUP_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    /**
     * 检查并记录一次点赞。通过返回 null；被限流返回用户可读提示文案。
     *
     * @param ip        客户端真实 IP（由 controller 解析 X-Forwarded-For 等后传入）
     * @param articleId 文章 id
     */
    public String checkAndRecord(String ip, Integer articleId) {
        if (ip == null || ip.isBlank() || articleId == null) {
            return "参数不合法";
        }
        long now = System.currentTimeMillis();

        // 防线 2：IP + 文章冷却
        String key = ip + ":" + articleId;
        Long last = articleCooldown.get(key);
        if (last != null && now - last < ARTICLE_COOLDOWN_MS) {
            long remainMs = ARTICLE_COOLDOWN_MS - (now - last);
            long remainMin = Math.max(1, (remainMs + 59_999L) / 60_000L);
            return "点赞太频繁，请 " + remainMin + " 分钟后再试";
        }

        // 防线 3：IP 全局滑动窗口频率
        Deque<Long> window = ipWindow.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (window) {
            while (!window.isEmpty() && now - window.peekFirst() > IP_WINDOW_MS) {
                window.pollFirst();
            }
            if (window.size() >= IP_MAX_PER_WINDOW) {
                return "操作太频繁，请稍后再试";
            }
            window.addLast(now);
        }

        // 记录冷却时间戳，放行
        articleCooldown.put(key, now);
        return null;
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
            log.warn("点赞限流清理失败（不影响功能）", ex);
        }
    }
}
