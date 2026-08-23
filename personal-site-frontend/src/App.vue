<template>
  <router-view v-slot="{ Component }">
    <keep-alive :include="cachedViews">
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// 缓存前台页面，切换回来后不再重新请求数据
const cachedViews = ref(['Home', 'Articles', 'Projects', 'ArticleDetail'])

// 根据路由 meta.theme 在 body 上挂载主题 class
watch(
  () => route.meta.theme,
  (theme) => {
    document.body.classList.remove('theme-dark', 'theme-light')
    if (theme) document.body.classList.add(theme)
  },
  { immediate: true }
)
</script>

<style>
/* 全局基础样式在 src/styles/theme.css 中维护 */
</style>
