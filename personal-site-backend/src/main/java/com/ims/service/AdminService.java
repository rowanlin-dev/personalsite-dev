package com.ims.service;

import com.ims.entity.Admin;
import com.ims.mapper.AdminMapper;
import at.favre.lib.crypto.bcrypt.BCrypt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class AdminService {

    @Autowired
    private AdminMapper adminMapper;

    public Admin findByUsername(String username) {
        return adminMapper.findByUsername(username);
    }

    /**
     * 登录校验。成功返回完整的 Admin 对象（含 forceChange），失败返回 null。
     */
    public Admin login(String username, String password) {
        Admin admin = adminMapper.findByUsername(username);
        if (admin == null) {
            return null;
        }
        String stored = admin.getPwd();
        if (stored == null || stored.isEmpty()) {
            return null;
        }
        // bcrypt 校验（salt 列已弃用，不再参与校验）
        // 任何异常（如遗留 MD5 哈希非 bcrypt 格式）均视为校验失败，避免 500
        try {
            BCrypt.Result result = BCrypt.verifyer().verify(password.toCharArray(), stored.toCharArray());
            return result.verified ? admin : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * 修改账号密码（强制改密门的「逃生口」，即使 force_change=1 也必须可用）。
     *
     * @param currentAdmin 当前会话中的 Admin（含 pwd 用于校验旧口令）
     * @param oldPassword  原口令（必填）
     * @param newUsername  新用户名（可选，留空则沿用当前用户名）
     * @param newPassword  新口令（必填，bcrypt cost=12 哈希后落库）
     * @param oldUsername  原用户名（可选，若提供则需与当前一致）
     * @return 成功返回 true，旧口令错误或参数非法返回 false
     */
    public boolean changeCredentials(Admin currentAdmin, String oldPassword, String newUsername,
                                      String newPassword, String oldUsername) {
        if (currentAdmin == null || currentAdmin.getPwd() == null) {
            return false;
        }
        if (oldPassword == null || oldPassword.isEmpty() || newPassword == null || newPassword.isEmpty()) {
            return false;
        }
        // 校验旧口令（bcrypt）
        BCrypt.Result result;
        try {
            result = BCrypt.verifyer().verify(oldPassword.toCharArray(), currentAdmin.getPwd().toCharArray());
        } catch (IllegalArgumentException e) {
            return false;
        }
        if (!result.verified) {
            return false;
        }
        // 若提供了 oldUsername，必须与当前一致（可选校验，防止误改他人）
        if (oldUsername != null && !oldUsername.isEmpty() && !oldUsername.equals(currentAdmin.getUsername())) {
            return false;
        }
        // 计算新口令 bcrypt 哈希（cost=12，符合 OWASP 对 bcrypt 强度的建议）
        String newHash = BCrypt.withDefaults().hashToString(12, newPassword.toCharArray());
        String finalUsername = (newUsername != null && !newUsername.isEmpty())
                ? newUsername : currentAdmin.getUsername();
        currentAdmin.setUsername(finalUsername);
        currentAdmin.setPwd(newHash);
        currentAdmin.setSalt("");
        currentAdmin.setForceChange(false);
        adminMapper.updateCredentials(currentAdmin);
        return true;
    }
}
