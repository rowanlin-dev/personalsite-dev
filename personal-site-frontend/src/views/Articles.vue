<template>
  <div class="articles-page">
    <AppHeader />

    <div class="page-banner">
      <div class="banner-content fade-up">
        <p class="banner-eyebrow">BLOG</p>
        <h1>技术博客</h1>
        <p class="banner-sub">记录学习过程中的点滴收获</p>
      </div>
    </div>

    <el-main class="main">
      <el-row :gutter="24">
        <el-col :xs="24" :lg="17">
          <el-card class="article-list" shadow="never">
            <div class="search-bar">
              <el-input
                v-model="query.titleKey"
                placeholder="搜索文章标题"
                clearable
                @keyup.enter="handleSearch"
              >
                <template #append>
                  <el-button @click="handleSearch">
                    <el-icon><Search /></el-icon>
                  </el-button>
                </template>
              </el-input>
            </div>

            <div v-if="list.length === 0" class="empty-state">
              <el-icon class="empty-icon"><EditPen /></el-icon>
              <p>暂无文章</p>
            </div>

            <div
              v-for="item in list"
              :key="item.id"
              class="article-card"
              @click="goDetail(item.id)"
            >
              <div class="article-cover" v-if="item.coverImage">
                <el-image :src="item.coverImage" fit="cover" />
              </div>
              <div class="article-body">
                <h2>{{ item.title }}</h2>
                <p class="article-summary">{{ summary(item.mdContent) }}</p>
                <div class="article-meta">
                  <el-tag size="small" effect="plain" type="primary">{{ item.tagNames?.join(', ') }}</el-tag>
                  <span class="meta-item">
                    <el-icon><View /></el-icon> {{ item.viewCount }}
                  </span>
                  <span class="meta-item">
                    <el-icon><Pointer /></el-icon> {{ item.likeCount }}
                  </span>
                  <span class="meta-item mono">{{ formatDate(item.createTime) }}</span>
                </div>
              </div>
            </div>

            <el-pagination
              v-model:current-page="query.page"
              v-model:page-size="query.size"
              :total="total"
              layout="prev, pager, next"
              @change="loadData"
              class="pagination"
            />
          </el-card>
        </el-col>

        <el-col :xs="24" :lg="7">
          <el-card class="sidebar-card" shadow="never">
            <template #header>
              <span>热门标签</span>
            </template>
            <div v-if="siteStore.tags.length === 0" class="empty-state compact">
              <p>暂无标签</p>
            </div>
            <div v-else class="tag-list">
              <el-tag
                v-for="tag in siteStore.tags"
                :key="tag.name"
                class="sidebar-tag"
                effect="plain"
                @click="searchTag(tag.name)"
              >
                {{ tag.name }} <span class="tag-count">{{ tag.count }}</span>
              </el-tag>
            </div>
          </el-card>

          <el-card class="sidebar-card" shadow="never">
            <template #header>
              <span>关于我</span>
            </template>
            <p class="about-text">{{ siteStore.about.content || '热爱技术，记录成长。' }}</p>
            <el-button type="primary" text @click="$router.push('/')">
              返回首页
            </el-button>
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
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, View, Pointer, EditPen } from '@element-plus/icons-vue'
import AppHeader from './components/AppHeader.vue'
import { useSiteStore } from '../store/site'
import { getArticleList } from '../api/article'

const route = useRoute()
const router = useRouter()
const siteStore = useSiteStore()

const list = ref([])
const total = ref(0)
const query = ref({
  page: 1,
  size: 8,
  titleKey: '',
  tagKey: route.query.tagKey || ''
})

onMounted(async () => {
  await Promise.all([
    siteStore.loadConfig(),
    siteStore.loadTags()
  ])
  const articleRes = await getArticleList(query.value)
  list.value = articleRes.data.list
  total.value = articleRes.data.total
})

watch(() => route.query.tagKey, (val) => {
  query.value.tagKey = val || ''
  query.value.page = 1
  loadData()
})

const loadData = async () => {
  const res = await getArticleList(query.value)
  list.value = res.data.list
  total.value = res.data.total
}

const handleSearch = () => {
  query.value.page = 1
  loadData()
}

const searchTag = (tag) => {
  query.value.tagKey = tag
  query.value.page = 1
  loadData()
}

const goDetail = (id) => router.push(`/article/${id}`)

const summary = (md) => {
  if (!md) return ''
  return md.replace(/[#*\`\[\]\(\)]/g, ' ').slice(0, 160) + '...'
}

const formatDate = (time) => {
  if (!time) return ''
  return new Date(time).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.articles-page {
  min-height: 100vh;
  background: var(--bg);
}

/* ---------- 杂志风页头 ---------- */
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

/* ---------- 文章列表 ---------- */
.article-list {
  border-radius: var(--radius-card);
  background: var(--bg-card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
}
.article-list :deep(.el-card__body) {
  padding: 20px 12px;
}
.search-bar {
  margin: 0 12px 20px;
}
.article-card {
  display: flex;
  gap: 20px;
  padding: 20px 16px;
  border-radius: var(--radius-inner);
  cursor: pointer;
  transition: background 0.2s ease;
}
.article-card + .article-card {
  border-top: 1px solid var(--border);
}
.article-card:hover {
  background: var(--hover-bg);
}
.article-cover {
  width: 200px;
  height: 130px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-soft);
}
.article-cover .el-image {
  width: 100%;
  height: 100%;
}
.article-body {
  flex: 1;
  min-width: 0;
}
.article-body h2 {
  font-family: var(--font-serif);
  font-size: 21px;
  color: var(--text);
  margin: 0 0 10px;
  transition: color 0.2s ease;
}
.article-card:hover .article-body h2 {
  color: var(--accent);
}
.article-summary {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
  margin: 0 0 14px;
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
.pagination {
  justify-content: center;
  margin-top: 24px;
}

/* ---------- 侧栏 ---------- */
.sidebar-card {
  border-radius: var(--radius-card);
  margin-bottom: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
}
.sidebar-card :deep(.el-card__header) {
  font-family: var(--font-serif);
  font-weight: 700;
  color: var(--text);
  border-bottom: 1px solid var(--border);
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sidebar-tag {
  cursor: pointer;
}
.tag-count {
  color: var(--text-muted);
  margin-left: 4px;
}
.about-text {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
  margin: 0 0 12px;
}
.empty-state.compact {
  padding: 20px 12px;
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
  .article-card {
    flex-direction: column;
  }
  .article-cover {
    width: 100%;
    height: 160px;
  }
  .banner-content h1 {
    font-size: 30px;
  }
}
</style>
