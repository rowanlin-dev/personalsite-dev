package com.ims.interceptor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ims.entity.Admin;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;
import java.util.Set;

/**
 * 强制改密拦截器（fail-closed）。
 *
 * <p>映射 {@code /api/admin/**}：对已登录且 {@code force_change=1} 的请求，
 * 除登录 / 登出 / 改密三个「逃生口」外，一律返回 HTTP 403 与
 * {@code {"code":"MUST_CHANGE_CREDENTIALS","msg":"请先修改账号密码"}}，
 * 在改密成功前【禁止访问任何后台功能】，兜底开源暴露导致的默认口令风险。
 *
 * <p>与 {@link LoginInterceptor}（fail-closed，映射 /api/**）共存，不改动其排除规则。
 * 本拦截器在 LoginInterceptor 之后执行，仅对 /api/admin/** 生效，不会波及公开读接口。
 */
public class AdminForceChangeInterceptor implements HandlerInterceptor {

    /** 即使 force_change=1 也必须放行的逃生口（否则改密入口被自身拦截 → 死锁） */
    private static final Set<String> ALLOWED_PATHS = Set.of(
            "/api/admin/login",
            "/api/admin/logout",
            "/api/admin/change-credentials"
    );

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 取去除了上下文路径的 servlet path，与 spring-mvc.xml 的 mapping 保持一致
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (ALLOWED_PATHS.contains(path)) {
            return true;
        }
        HttpSession session = request.getSession(false);
        if (session == null) {
            // 未建立会话：fail-closed 拒绝（LoginInterceptor 通常已先返回 401）
            return deny(response);
        }
        Admin admin = (Admin) session.getAttribute("admin");
        if (admin == null) {
            // 会话状态不一致（例如升级后旧会话）：fail-closed 拒绝，要求重新登录
            return deny(response);
        }
        if (Boolean.TRUE.equals(admin.getForceChange())) {
            return deny(response);
        }
        return true;
    }

    /** 统一返回 403 + MUST_CHANGE_CREDENTIALS（code 为字符串，便于前端精确匹配） */
    private boolean deny(HttpServletResponse response) throws Exception {
        response.setContentType("application/json;charset=utf-8");
        response.setStatus(403);
        response.getWriter().write(new ObjectMapper().writeValueAsString(
                Map.of("code", "MUST_CHANGE_CREDENTIALS", "msg", "请先修改账号密码")));
        return false;
    }
}
