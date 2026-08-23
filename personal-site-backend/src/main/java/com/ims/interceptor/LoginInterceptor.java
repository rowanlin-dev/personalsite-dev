package com.ims.interceptor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ims.entity.Result;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 管理员登录拦截器
 */
public class LoginInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("loginUser") == null) {
            response.setContentType("application/json;charset=utf-8");
            response.setStatus(401);
            response.getWriter().write(new ObjectMapper().writeValueAsString(Result.error("未登录")));
            return false;
        }
        return true;
    }
}
