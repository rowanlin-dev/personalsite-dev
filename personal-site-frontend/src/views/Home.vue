<template>
  <div class="home">
    <AppHeader />

    <!-- Hero -->
    <section class="hero">
      <div class="hero-content fade-up">
        <div v-if="siteStore.avatar.show" class="hero-avatar-wrap">
          <el-avatar
            :size="104"
            :src="siteStore.avatar.url || undefined"
            class="hero-avatar"
          >
            {{ avatarInitial }}
          </el-avatar>
        </div>
        <p class="hero-tag">&lt;hello world /&gt;</p>
        <h1>{{ siteStore.about.title || '你好，我是开发者' }}</h1>
        <p class="hero-subtitle">{{ siteStore.about.content || '热爱技术，记录成长，分享经验。' }}</p>
        <div class="hero-actions">
          <el-button type="primary" size="large" @click="$router.push('/articles')" @mouseenter="prefetchRoute('/articles')">
            阅读博客
          </el-button>
          <el-button size="large" class="ghost-btn" @click="$router.push('/projects')" @mouseenter="prefetchRoute('/projects')">
            查看作品
          </el-button>
          <el-button v-if="siteStore.resume.enable && siteStore.resume.pdf" type="success" size="large" tag="a" :href="siteStore.resume.pdf" target="_blank" download>
            <el-icon><Document /></el-icon> 下载简历
          </el-button>
        </div>
        <div class="hero-contact">
          <el-link v-if="siteStore.contact.email" :href="'mailto:' + siteStore.contact.email" type="info">
            <el-icon><Message /></el-icon> {{ siteStore.contact.email }}
          </el-link>
          <el-link v-if="siteStore.contact.github" :href="siteStore.contact.github" target="_blank" type="info">
            <el-icon><Link /></el-icon> GitHub
          </el-link>
          <el-popover v-if="siteStore.contact.wechat" placement="bottom" trigger="hover" width="200">
            <template #reference>
              <el-link type="info">
                <el-icon><ChatDotRound /></el-icon> 微信
              </el-link>
            </template>
            <el-image :src="siteStore.contact.wechat" style="width: 180px" />
          </el-popover>
        </div>
      </div>
    </section>

    <el-main class="main">
      <!-- 技术栈图谱（进入视口才加载 d3-force，P1-4） -->
      <section class="section fade-up" ref="techMapSection">
        <h2 class="section-title">技术栈图谱</h2>
        <TechMap v-if="techMapVisible" :skills="siteStore.skills" :relations="siteStore.techRelations" />
        <div v-else class="tech-map-skeleton">技术栈图谱加载中…</div>
      </section>

      <!-- 精选项目 -->
      <section class="section fade-up delay-1">
        <div class="section-header">
          <h2 class="section-title">精选项目</h2>
          <el-button text type="primary" @click="$router.push('/projects')">
            查看更多 <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
        <div v-if="siteStore.projects.length === 0" class="empty-state">
          <el-icon class="empty-icon"><FolderOpened /></el-icon>
          <p>暂无项目，敬请期待</p>
        </div>
        <el-row v-else :gutter="24">
          <el-col :xs="24" :sm="12" :lg="8" v-for="item in siteStore.projects.slice(0, 3)" :key="item.id">
            <el-card class="project-card" shadow="never" @click="$router.push('/projects')" @mouseenter="prefetchRoute('/projects')">
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
                <h3>{{ item.title }}</h3>
                <p>{{ item.descript }}</p>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </section>

      <!-- 最新技术博客 -->
      <section class="section fade-up delay-2">
        <div class="section-header">
          <h2 class="section-title">最新技术博客</h2>
          <el-button text type="primary" @click="$router.push('/articles')">
            查看更多 <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
        <el-card class="article-list" shadow="never">
          <div v-if="articles.length === 0" class="empty-state">
            <el-icon class="empty-icon"><EditPen /></el-icon>
            <p>暂无文章，去写下第一篇吧</p>
          </div>
          <div
            v-for="item in articles"
            :key="item.id"
            class="article-item"
            @click="goDetail(item.id)"
            @mouseenter="prefetchRoute('/article')"
          >
            <div class="article-info">
              <h3>{{ item.title }}</h3>
              <p class="article-summary">{{ summary(item.mdContent) }}</p>
              <div class="article-meta">
                <el-tag size="small" effect="plain">{{ item.tagNames?.join(', ') || '' }}</el-tag>
                <span class="meta-item">
                  <el-icon><View /></el-icon> {{ item.viewCount }}
                </span>
                <span class="meta-item">
                  <el-icon><Pointer /></el-icon> {{ item.likeCount }}
                </span>
                <span class="meta-item mono">{{ formatDate(item.createTime) }}</span>
              </div>
            </div>
            <el-icon class="article-arrow"><ArrowRight /></el-icon>
          </div>
        </el-card>
      </section>
    </el-main>

    <footer class="footer">
      <p>© {{ new Date().getFullYear() }} 蜂潮网络科技工作室 · Powered by SSM + Vue 3</p>
      <p><a href="https://beian.miit.gov.cn" target="_blank" rel="noopener">粤ICP备2022081892号</a></p>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, defineAsyncComponent, reactive } from 'vue'
import { SITE_ORIGIN } from '../utils/seo'
import { useRouter } from 'vue-router'
import { View, Pointer, ArrowRight, Message, Link, Document, FolderOpened, EditPen } from '@element-plus/icons-vue'
import AppHeader from './components/AppHeader.vue'
import { useSiteStore } from '../store/site'
import { getArticleList } from '../api/article'
import { prefetchRoute } from '../utils/route-prefetch'

// TechMap（含 d3-force）改为异步组件：进入视口后才加载对应 chunk，
// 剥离首屏对 d3-force 的静态依赖（P1-4）。
const TechMap = defineAsyncComponent(() => import('../components/TechMap.vue'))

const router = useRouter()
const siteStore = useSiteStore()

const articles = ref([])

// 项目默认封面（public 下的杂志风 SVG）。用绝对站点域名引用，避免本地以 file://
// 或非根路径方式打开时根相对路径解析不到资源（已实测相对路径在部分场景下加载失败）。
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

// 头像加载失败或无头像时的首字母占位
const avatarInitial = computed(() => {
  const t = (siteStore.about.title || 'M').trim()
  return t ? t[0].toUpperCase() : 'M'
})

onMounted(async () => {
  // 各加载相互独立：即便 loadConfig（公开配置分片）异常，也不应连累
  // 项目 / 文章等公开数据的加载，避免首页「既报错又没数据」。
  // 技术栈（TechMap / d3-force）延迟到图谱区块进入视口再加载（P1-4）。
  await Promise.allSettled([
    siteStore.loadConfig(),
    siteStore.loadProjects()
  ])
  try {
    const articleRes = await getArticleList({ page: 1, size: 5 })
    articles.value = articleRes.data.list
  } catch (e) {
    console.error('[Home] 加载文章列表失败', e)
  }
  setupTechMapObserver()
})

// ---- TechMap 视口懒加载（P1-4） ----
const techMapSection = ref(null)
const techMapVisible = ref(false)
let techMapObserver = null

/** 进入视口后加载技术栈数据并渲染 TechMap 异步 chunk */
async function revealTechMap() {
  try {
    await siteStore.loadSkills()
  } catch (e) {
    console.error('[Home] 加载技术栈失败', e)
  } finally {
    techMapVisible.value = true
  }
}

/** 监听技术栈图谱区块是否进入视口（含 200px 提前量），进入后才加载 d3-force */
function setupTechMapObserver() {
  if (techMapVisible.value) return
  if (!techMapSection.value) return
  // 不支持 IntersectionObserver 的环境直接渲染，保证功能可用
  if (typeof IntersectionObserver === 'undefined') {
    revealTechMap()
    return
  }
  techMapObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          revealTechMap()
          techMapObserver.disconnect()
          techMapObserver = null
          break
        }
      }
    },
    { rootMargin: '200px' }
  )
  techMapObserver.observe(techMapSection.value)
}

onBeforeUnmount(() => {
  if (techMapObserver) {
    techMapObserver.disconnect()
    techMapObserver = null
  }
})

const goDetail = (id) => router.push(`/article/${id}`)

const coverInitial = (title) => {
  const t = (title || 'P').trim()
  return t ? t[0].toUpperCase() : 'P'
}

const summary = (md) => {
  if (!md) return ''
  return md.replace(/[#*\`\[\]\(\)]/g, ' ').slice(0, 120) + '...'
}

const formatDate = (time) => {
  if (!time) return ''
  return new Date(time).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: var(--bg);
}

/* ---------- Hero ---------- */
.hero {
  position: relative;
  color: var(--text);
  padding: 88px 20px 96px;
  text-align: center;
  background:
    radial-gradient(circle at 18% 20%, rgba(34, 211, 238, 0.07) 0%, transparent 42%),
    radial-gradient(circle at 82% 78%, rgba(167, 139, 250, 0.07) 0%, transparent 42%),
    linear-gradient(180deg, var(--bg-soft) 0%, var(--bg) 100%);
  overflow: hidden;
}
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
  pointer-events: none;
}
.hero-content {
  position: relative;
  max-width: 800px;
  margin: 0 auto;
}
.hero-avatar-wrap {
  margin-bottom: 20px;
  display: inline-block;
  border-radius: 50%;
  padding: 4px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 0 24px rgba(34, 211, 238, 0.35);
}
.hero-avatar {
  display: block;
  border: 3px solid var(--bg);
  background: linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%);
  color: #0a0e17;
  font-size: 40px;
  font-weight: 700;
}
.hero-tag {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--accent);
  letter-spacing: 2px;
  margin: 0 0 12px;
}
.hero h1 {
  font-size: 42px;
  font-weight: 700;
  margin: 0 0 16px;
  background: linear-gradient(120deg, #e6ecf5 30%, var(--accent) 70%, var(--accent-2));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-subtitle {
  font-size: 17px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0 0 32px;
}
.hero-actions {
  margin-bottom: 24px;
}
.hero-actions .el-button {
  margin: 0 8px 8px;
}
.ghost-btn {
  background: transparent;
  border-color: var(--border);
  color: var(--text);
}
.ghost-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.hero-contact {
  display: flex;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
}
.hero-contact .el-link {
  color: var(--text-muted);
  font-size: 14px;
}
.hero-contact .el-link .el-icon {
  margin-right: 5px;
}
.hero-contact .el-link:hover {
  color: var(--accent);
}

/* ---------- 主体 ---------- */
.main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px 48px;
}
.section {
  margin-bottom: var(--space-section);
}
.section:last-child {
  margin-bottom: 0;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.section-title {
  font-size: 24px;
  color: var(--text);
  margin: 0;
  position: relative;
  padding-left: 14px;
}
/* 未包裹在 .section-header 中的独立标题（如技术栈图谱），补下间距 */
.section > .section-title {
  margin-bottom: 20px;
}

/* 技术栈图谱视口外占位骨架：保持与 TechMap 一致的最小高度，避免布局抖动 */
.tech-map-skeleton {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: var(--text-muted);
  font-size: 14px;
  background:
    radial-gradient(ellipse at center, #1e293b 0%, #0f172a 100%);
}

.section-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 5px;
  bottom: 5px;
  width: 4px;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--accent), var(--accent-2));
  box-shadow: 0 0 8px rgba(34, 211, 238, 0.5);
}

/* ---------- 项目卡片（同排等高） ---------- */
.main :deep(.el-col) {
  display: flex;
}
.project-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-card);
  overflow: hidden;
  cursor: pointer;
  margin-bottom: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  transition: transform 0.25s ease, border-color 0.25s ease;
}
.project-card:hover {
  transform: translateY(-4px);
  border-color: rgba(34, 211, 238, 0.35);
}
.project-card :deep(.el-card__body) {
  padding: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.project-cover {
  height: 180px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}
.project-cover .cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: brightness(0.92);
  transition: filter 0.25s ease;
}
.project-card:hover .project-cover .cover-img {
  filter: brightness(1);
}
.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.18) 0%, rgba(167, 139, 250, 0.22) 100%);
}
.cover-placeholder span {
  font-family: var(--font-mono);
  font-size: 44px;
  font-weight: 700;
  color: rgba(230, 236, 245, 0.55);
}
.project-body {
  padding: 16px 20px 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.project-body h3 {
  font-size: 17px;
  color: var(--text);
  margin: 0 0 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.project-body p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ---------- 文章列表 ---------- */
.article-list {
  border-radius: var(--radius-card);
  background: var(--bg-card);
  border: 1px solid var(--border);
}
.article-list :deep(.el-card__body) {
  padding: 8px;
}
.article-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-radius: var(--radius-inner);
  cursor: pointer;
  transition: background 0.2s ease;
}
.article-item + .article-item {
  border-top: 1px solid var(--border);
}
.article-item:hover {
  background: var(--hover-bg);
}
.article-item:hover .article-info h3 {
  color: var(--accent);
}
.article-info {
  flex: 1;
  min-width: 0;
}
.article-info h3 {
  font-size: 17px;
  color: var(--text);
  margin: 0 0 8px;
  transition: color 0.2s ease;
}
.article-summary {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.article-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 13px;
}
.meta-item .el-icon {
  margin-right: 2px;
  font-size: 14px;
}
.meta-item.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}
.article-arrow {
  color: var(--text-muted);
  font-size: 18px;
  margin-left: 16px;
  flex-shrink: 0;
}
.article-item:hover .article-arrow {
  color: var(--accent);
}

/* ---------- Footer ---------- */
.footer {
  background: var(--footer-bg);
  border-top: 1px solid var(--border);
  color: var(--footer-text);
  text-align: center;
  padding: 28px 20px;
  margin-top: 32px;
}
.footer p {
  margin: 0;
  font-size: 14px;
}
</style>
