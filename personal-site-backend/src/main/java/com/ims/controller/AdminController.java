package com.ims.controller;

import com.ims.entity.Admin;
import com.ims.entity.Result;
import com.ims.service.AdminService;
import com.ims.service.DashboardService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @Autowired
    private DashboardService dashboardService;

    @PostMapping("/login")
    public Result<?> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String username = body.get("username");
        String password = body.get("password");
        Admin admin = adminService.login(username, password);
        if (admin != null) {
            // 会话固定防护：登录成功后使旧会话失效，再创建全新会话写入属性（防会话固定攻击）
            HttpSession oldSession = request.getSession(false);
            if (oldSession != null) {
                oldSession.invalidate();
            }
            HttpSession session = request.getSession(true);
            // loginUser 供 LoginInterceptor（fail-closed）鉴权使用
            session.setAttribute("loginUser", admin.getUsername());
            // admin 供强制改密拦截器读取 forceChange，并供 change-credentials 校验旧口令
            session.setAttribute("admin", admin);
            return Result.ok(Map.of(
                    "username", admin.getUsername(),
                    "forceChange", Boolean.TRUE.equals(admin.getForceChange())
            ));
        }
        return Result.error("用户名或密码错误");
    }

    @GetMapping("/logout")
    public Result<?> logout(HttpSession session) {
        session.invalidate();
        return Result.ok();
    }

    /**
     * 修改账号密码（强制改密门的逃生口，不受 AdminForceChangeInterceptor 拦截）。
     * 请求体 JSON：{ oldUsername?, oldPassword, newUsername?, newPassword }
     */
    @PostMapping("/change-credentials")
    public Result<?> changeCredentials(@RequestBody Map<String, String> body, HttpSession session) {
        Admin admin = (Admin) session.getAttribute("admin");
        if (admin == null) {
            return Result.error("未登录");
        }
        String oldUsername = body.get("oldUsername");
        String oldPassword = body.get("oldPassword");
        String newUsername = body.get("newUsername");
        String newPassword = body.get("newPassword");
        boolean ok = adminService.changeCredentials(admin, oldPassword, newUsername, newPassword, oldUsername);
        if (ok) {
            // 更新会话中的 admin（用户名可能已变、forceChange 已置 0），并同步 loginUser
            session.setAttribute("admin", admin);
            session.setAttribute("loginUser", admin.getUsername());
            return Result.ok(Map.of("forceChange", false));
        }
        return Result.error("原密码错误或操作失败");
    }

    @GetMapping("/info")
    public Result<?> info(HttpSession session) {
        String username = (String) session.getAttribute("loginUser");
        if (username == null) {
            return Result.error("未登录");
        }
        return Result.ok(Map.of("username", username));
    }

    @GetMapping("/dashboard")
    public Result<Map<String, Object>> dashboard(HttpSession session) {
        if (session.getAttribute("loginUser") == null) {
            return Result.error("未登录");
        }
        return Result.ok(dashboardService.stats());
    }
}
