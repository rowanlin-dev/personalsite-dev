import request from './request'

export const adminLogin = (username, password) => request.post('/admin/login', { username, password })
export const login = adminLogin
export const logout = () => request.get('/admin/logout')
export const adminLogout = logout
export const adminInfo = () => request.get('/admin/info')
export const getDashboardStats = () => request.get('/admin/dashboard')
// 修改账号密码（强制改密门逃生口）：payload = { oldUsername?, oldPassword, newUsername?, newPassword }
export const changeCredentials = (payload) => request.post('/admin/change-credentials', payload)
