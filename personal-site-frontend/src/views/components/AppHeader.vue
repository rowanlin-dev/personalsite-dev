<template>
  <el-header class="app-header">
    <div class="header-inner">
      <span class="logo" @click="$router.push('/')">
        <el-icon><Sunny /></el-icon>
        <span class="logo-full">蜂潮网络科技工作室</span>
        <span class="logo-short">蜂潮网络</span>
      </span>
      <el-menu
        :default-active="activeRoute"
        mode="horizontal"
        :router="true"
        class="nav-menu"
      >
        <el-menu-item index="/" @mouseenter="onNavHover('/')">首页</el-menu-item>
        <el-menu-item index="/articles" @mouseenter="onNavHover('/articles')">技术博客</el-menu-item>
        <el-menu-item index="/projects" @mouseenter="onNavHover('/projects')">项目作品</el-menu-item>
      </el-menu>
      <div class="header-actions">
        <el-button
          v-if="resumeUrl"
          type="primary"
          :href="resumeUrl"
          tag="a"
          target="_blank"
          class="resume-btn"
        >
          <el-icon><Download /></el-icon>
          下载简历
        </el-button>
      </div>
      <button
        ref="hamburgerRef"
        class="hamburger-btn"
        type="button"
        :aria-expanded="drawerOpen"
        aria-controls="app-header-drawer"
        aria-label="打开导航菜单"
        @click="openDrawer"
      >
        <el-icon><Menu /></el-icon>
      </button>
    </div>

    <el-drawer
      id="app-header-drawer"
      v-model="drawerOpen"
      title="导航"
      direction="rtl"
      size="260px"
      :with-header="true"
      @open="onDrawerOpen"
      @closed="onDrawerClosed"
    >
      <el-menu
        :default-active="activeRoute"
        :router="true"
        class="drawer-menu"
        @click="closeDrawer"
      >
        <el-menu-item index="/" @mouseenter="onNavHover('/')">首页</el-menu-item>
        <el-menu-item index="/articles" @mouseenter="onNavHover('/articles')">技术博客</el-menu-item>
        <el-menu-item index="/projects" @mouseenter="onNavHover('/projects')">项目作品</el-menu-item>
      </el-menu>
      <el-button
        v-if="resumeUrl"
        type="primary"
        :href="resumeUrl"
        tag="a"
        target="_blank"
        class="drawer-resume-btn"
      >
        <el-icon><Download /></el-icon>
        下载简历
      </el-button>
    </el-drawer>
  </el-header>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Sunny, Download, Menu } from '@element-plus/icons-vue'
import { getResume } from '../../api/config'
import { prefetchRoute } from '../../utils/route-prefetch'

const route = useRoute()
const activeRoute = computed(() => route.path)
const resumeUrl = ref('')

const drawerOpen = ref(false)
const hamburgerRef = ref(null)

function openDrawer() {
  drawerOpen.value = true
}
function closeDrawer() {
  drawerOpen.value = false
}
function onDrawerOpen() {
  // 打开抽屉：记录并把焦点移入抽屉内首个菜单项
  nextTick(() => {
    const firstItem = document.querySelector('#app-header-drawer .el-menu-item')
    if (firstItem && typeof firstItem.focus === 'function') {
      firstItem.focus()
    }
  })
}
function onDrawerClosed() {
  // 关闭抽屉：清理并把焦点归还汉堡按钮
  if (hamburgerRef.value && typeof hamburgerRef.value.focus === 'function') {
    hamburgerRef.value.focus()
  }
}

// 路由切换自动关闭抽屉（点遮罩/Esc 由 el-drawer 原生处理）
watch(
  () => route.path,
  () => {
    drawerOpen.value = false
  }
)

onMounted(async () => {
  try {
    const res = await getResume()
    if (res.data?.enable && res.data?.url) {
      resumeUrl.value = res.data.url
    }
  } catch (e) {
    console.error('加载简历配置失败', e)
  }
})

/** 悬停/聚焦导航项时预取对应路由 chunk（P1-6，非无差别 prefetch，避免浪费移动端流量） */
function onNavHover(index) {
  prefetchRoute(index)
}
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--header-bg, rgba(255, 255, 255, 0.78));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--header-border, rgba(15, 23, 42, 0.08));
  height: 64px;
  line-height: 64px;
  padding: 0;
  transition: background 0.25s ease;
}
.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}
.logo {
  font-size: 20px;
  font-weight: 700;
  color: var(--text, #20242c);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: 0.5px;
}
.logo .el-icon {
  color: var(--accent, #0e8aa8);
  font-size: 22px;
}
.logo-short {
  display: none;
}
@media (max-width: 768px) {
  .logo-full {
    display: none;
  }
  .logo-short {
    display: inline;
  }
  .nav-menu {
    display: none;
  }
  .header-actions {
    display: none;
  }
  .hamburger-btn {
    display: flex;
  }
}
.nav-menu {
  border-bottom: none;
  flex: 1;
  justify-content: center;
  background: transparent;
  --el-menu-text-color: var(--menu-text, #5b6472);
  --el-menu-hover-text-color: var(--accent, #0e8aa8);
  --el-menu-active-color: var(--accent, #0e8aa8);
  --el-menu-bg-color: transparent;
  --el-menu-hover-bg-color: var(--hover-bg, rgba(14, 138, 168, 0.05));
  --el-menu-item-height: 64px;
  --el-menu-border-color: transparent;
}
.nav-menu :deep(.el-menu-item) {
  font-size: 15px;
  font-weight: 500;
  background: transparent;
}
.nav-menu :deep(.el-menu-item.is-active) {
  border-bottom-color: var(--accent, #0e8aa8);
}
.header-actions {
  display: flex;
  align-items: center;
}
.resume-btn {
  text-decoration: none;
}
.resume-btn .el-icon {
  margin-right: 4px;
}
.hamburger-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  margin-left: 8px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text, #20242c);
  transition: background 0.2s ease;
}
.hamburger-btn .el-icon {
  font-size: 24px;
  color: var(--accent, #0e8aa8);
}
.hamburger-btn:hover {
  background: var(--hover-bg, rgba(14, 138, 168, 0.08));
}
.hamburger-btn:focus-visible {
  outline: 2px solid var(--accent, #0e8aa8);
  outline-offset: 2px;
}
.drawer-menu {
  border-right: none;
  background: transparent;
  --el-menu-text-color: var(--menu-text, #5b6472);
  --el-menu-hover-text-color: var(--accent, #0e8aa8);
  --el-menu-active-color: var(--accent, #0e8aa8);
  --el-menu-bg-color: transparent;
  --el-menu-hover-bg-color: var(--hover-bg, rgba(14, 138, 168, 0.05));
  --el-menu-item-height: 48px;
  --el-menu-border-color: transparent;
}
.drawer-menu :deep(.el-menu-item) {
  font-size: 15px;
  font-weight: 500;
  background: transparent;
  border-radius: 8px;
  margin: 4px 0;
}
.drawer-menu :deep(.el-menu-item.is-active) {
  color: var(--accent, #0e8aa8);
  background: var(--hover-bg, rgba(14, 138, 168, 0.08));
}
.drawer-menu :deep(.el-menu-item:focus-visible) {
  outline: 2px solid var(--accent, #0e8aa8);
  outline-offset: 2px;
}
.drawer-resume-btn {
  margin-top: 16px;
  width: 100%;
  text-decoration: none;
  justify-content: center;
}
.drawer-resume-btn .el-icon {
  margin-right: 4px;
}
@media (prefers-reduced-motion: reduce) {
  .app-header,
  .app-header * {
    transition: none !important;
    animation: none !important;
  }
  :deep(.el-drawer),
  :deep(.el-overlay) {
    transition: none !important;
    animation: none !important;
  }
}
</style>
