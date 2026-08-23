<template>
  <div class="login-page">
    <el-card class="login-card">
      <h2>管理员登录</h2>
      <el-form :model="form" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleLogin" style="width: 100%">登录</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../../store/admin'
import { login } from '../../api/admin'

const router = useRouter()
const adminStore = useAdminStore()
const form = reactive({ username: '', password: '' })

const handleLogin = async () => {
  const res = await login(form.username, form.password)
  adminStore.setUsername(res.data.username)
  // 记录是否需要强制改密；进入 /admin 后由 Layout 决定是否展示改密遮罩
  adminStore.setForceChange(res.data.forceChange)
  router.push('/admin')
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f5f7fa;
}
.login-card {
  width: 400px;
}
.login-card h2 {
  text-align: center;
  margin-bottom: 24px;
}
</style>
