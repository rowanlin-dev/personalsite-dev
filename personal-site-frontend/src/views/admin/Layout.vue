<template>
  <ForceChange v-if="adminStore.forceChange" />
  <el-container v-else class="admin-layout">
    <el-aside width="200px">
      <div class="admin-title">后台管理</div>
      <el-menu :default-active="$route.path" :router="true" background-color="#304156" text-color="#fff" active-text-color="#409eff">
        <el-menu-item index="/admin/dashboard">仪表盘</el-menu-item>
        <el-menu-item index="/admin/articles">文章管理</el-menu-item>
        <el-menu-item index="/admin/projects">项目管理</el-menu-item>
        <el-menu-item index="/admin/skills">技能管理</el-menu-item>
        <el-menu-item index="/admin/tags">标签管理</el-menu-item>
        <el-menu-item index="/admin/collections">合集管理</el-menu-item>
        <el-menu-item index="/admin/config">网站配置</el-menu-item>
        <el-menu-item index="/admin/assets">素材库</el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="admin-header">
        <span>{{ adminStore.username }}</span>
        <el-button text @click="handleLogout">退出</el-button>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAdminStore } from '../../store/admin'
import { logout } from '../../api/admin'
import ForceChange from './ChangeCredentials.vue'

const router = useRouter()
const adminStore = useAdminStore()

const handleLogout = async () => {
  await logout()
  adminStore.clear()
  router.push('/admin/login')
}
</script>

<style scoped>
.admin-layout {
  height: 100vh;
}
.el-aside {
  background: #304156;
}
.admin-title {
  color: #fff;
  font-size: 18px;
  text-align: center;
  padding: 20px 0;
}
.admin-header {
  background: #fff;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #e4e7ed;
}
</style>
