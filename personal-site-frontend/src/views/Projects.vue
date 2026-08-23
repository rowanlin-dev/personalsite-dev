<template>
  <div class="projects-page">
    <AppHeader />

    <div class="page-banner">
      <div class="banner-content fade-up">
        <p class="banner-eyebrow">PROJECTS</p>
        <h1>项目作品</h1>
        <p class="banner-sub">一些我做过或正在做的项目</p>
      </div>
    </div>

    <el-main class="main">
      <div v-if="siteStore.projects.length === 0" class="empty-state">
        <el-icon class="empty-icon"><FolderOpened /></el-icon>
        <p>暂无项目，敬请期待</p>
      </div>

      <el-row v-else :gutter="24">
        <el-col :xs="24" :sm="12" :lg="8" v-for="item in siteStore.projects" :key="item.id">
          <el-card class="project-card" shadow="never">
            <div class="project-cover">
              <img
                v-show="!brokenCovers[item.id]"
                class="cover-img"
                :src="coverFailed[item.id] ? defaultProjectCover : (item.coverImage || defaultProjectCover)"
                :alt="item.title"
                @error="onCoverError(item)"
              />
              <div v-if="brokenCovers[item.id]" class="cover-placeholder">
                <span>{{ coverInitial(item.title) }}</span>
              </div>
            </div>
            <div class="project-body">
              <h3 class="project-title">{{ item.title }}</h3>
              <p class="project-desc">{{ item.descript }}</p>
              <div class="project-tech">
                <el-tag v-for="name in item.tagNames || parseTech(item.techStack)" :key="name" size="small" effect="plain">
                  {{ name }}
                </el-tag>
              </div>
              <div class="project-links">
                <el-link v-if="item.github" :href="item.github" target="_blank" type="primary">
                  <el-icon><Link /></el-icon> GitHub
                </el-link>
                <el-link v-if="item.demoUrl" :href="item.demoUrl" target="_blank" type="success">
                  <el-icon><View /></el-icon> 在线演示
                </el-link>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </el-main>

    <footer class="footer">
      <p>© {{ new Date().getFullYear() }} 蜂潮网络科技工作室 · Powered by SSM + Vue 3</p>
      <p><a href="https://beian.miit.gov.cn" target="_blank" rel="noopener">粤ICP备2022081892号</a></p>
    </footer>
  </div>
</template>

<script setup>
import { onMounted, reactive } from 'vue'
import { Link, View, FolderOpened } from '@element-plus/icons-vue'
import { SITE_ORIGIN } from '../utils/seo'
import AppHeader from './components/AppHeader.vue'
import { useSiteStore } from '../store/site'

const siteStore = useSiteStore()

// 项目默认封面（public 下的杂志风 SVG）。绝对站点域名引用，原因同 Home.vue。
const defaultProjectCover = SITE_ORIGIN + '/project-cover-default.svg'

// 封面坏链回退：自定义封面失败时回退到默认封面；默认封面也失败才走首字母占位。
const coverFailed = reactive({})    // { [id]: true } 表示该项目的自定义封面已坏，应使用默认封面
const brokenCovers = reactive({})   // { [id]: true } 表示默认封面也失败，显示首字母占位
const onCoverError = (item) => {
  if (item.coverImage && !coverFailed[item.id]) {
    coverFailed[item.id] = true     // 自定义封面失败，回退默认封面
  } else {
    brokenCovers[item.id] = true    // 默认封面失败，显示占位符
  }
}

onMounted(() => {
  siteStore.loadProjects()
})

const coverInitial = (title) => {
  const t = (title || 'P').trim()
  return t ? t[0].toUpperCase() : 'P'
}

const parseTech = (techStack) => {
  if (!techStack) return []
  return techStack.split(/[,，]/).map(t => t.trim()).filter(Boolean)
}
</script>

<style scoped>
.projects-page {
  min-height: 100vh;
  background: var(--bg);
}

/* ---------- 杂志风页头（与博客页一致） ---------- */
.page-banner {
  background:
    radial-gradient(circle at 85% 15%, rgba(124, 107, 214, 0.07) 0%, transparent 40%),
    linear-gradient(180deg, var(--bg-soft) 0%, var(--bg) 100%);
  border-bottom: 1px solid var(--border);
  color: var(--text);
  padding: 64px 20px 56px;
  text-align: center;
}
.banner-eyebrow {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 4px;
  color: var(--accent);
  margin: 0 0 12px;
}
.banner-content h1 {
  font-family: var(--font-serif);
  font-size: 40px;
  font-weight: 700;
  margin: 0 0 12px;
}
.banner-sub {
  color: var(--text-secondary);
  font-size: 15px;
  margin: 0;
}

.main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 20px 56px;
}

/* ---------- 项目卡片（同排等高） ---------- */
.main :deep(.el-col) {
  display: flex;
}
.project-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
  border-radius: var(--radius-card);
  overflow: hidden;
  background: var(--bg-card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.project-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
}
.project-card :deep(.el-card__body) {
  padding: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.project-cover {
  height: 180px;
  background: var(--bg-soft);
  border-bottom: 1px solid var(--border);
}
.project-cover .cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(14, 138, 168, 0.12) 0%, rgba(124, 107, 214, 0.14) 100%);
}
.cover-placeholder span {
  font-family: var(--font-mono);
  font-size: 44px;
  font-weight: 700;
  color: var(--text-muted);
  opacity: 0.55;
}
.project-body {
  padding: 16px 20px 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.project-title {
  font-family: var(--font-serif);
  font-size: 18px;
  color: var(--text);
  margin: 0 0 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.project-desc {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
  margin: 0 0 12px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
/* 标签行：正常文档流，固定卡片底部，单行不溢出 */
.project-tech {
  margin-top: auto;
  padding-top: 4px;
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow: hidden;
  max-width: 100%;
}
.project-tech .el-tag {
  flex-shrink: 0;
  max-width: 100%;
}
.project-links {
  margin-top: 12px;
}
.project-links .el-link {
  margin-right: 16px;
}
.project-links .el-link .el-icon {
  margin-right: 4px;
}

.footer {
  background: var(--footer-bg);
  border-top: 1px solid var(--border);
  color: var(--footer-text);
  text-align: center;
  padding: 28px 20px;
}
.footer p {
  margin: 0;
  font-size: 14px;
}

@media (max-width: 768px) {
  .banner-content h1 {
    font-size: 30px;
  }
}
</style>
