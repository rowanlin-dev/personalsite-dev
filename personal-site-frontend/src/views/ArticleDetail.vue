<template>
  <div class="detail-page">
    <AppHeader />

    <el-main class="main">
      <el-row :gutter="24" v-if="article">
        <!-- 目录窗：桌面端（≥1200px）固定在正文左侧、不随页面滚动移动，
             标题可点击展开/收起；移动端改用右下角浮动图标打开抽屉 -->
        <el-col v-if="isDesktop" ref="tocColRef" :lg="5">
          <div
            v-if="hasToc"
            class="toc-card"
            :class="{ 'toc-collapsed': tocCollapsed }"
            :style="{ left: tocLeft + 'px', width: tocWidth + 'px' }"
          >
            <div class="toc-header" @click="tocCollapsed = !tocCollapsed">
              <span>目录</span>
              <el-icon class="toc-chevron" :class="{ 'is-up': tocCollapsed }"><ArrowDown /></el-icon>
            </div>
            <div v-show="!tocCollapsed" class="toc-body">
              <MdCatalog :editorId="previewId" :scrollElement="scrollElement" :scrollElementOffsetTop="80" />
            </div>
          </div>
        </el-col>

        <el-col :xs="24" :lg="13">
          <el-card class="article-card" shadow="never">
            <div class="article-cover" v-if="article.coverImage">
              <el-image :src="article.coverImage" fit="cover" />
            </div>
            <div class="article-column">
              <h1 class="article-title">{{ article.title }}</h1>
              <div v-if="article.collections && article.collections.length" class="article-collections">
                <span class="ac-label">本文收录于：</span>
                <el-tag
                  v-for="col in article.collections"
                  :key="col.id"
                  class="ac-chip"
                  size="small"
                  effect="light"
                  type="success"
                  @click="openCollection(col)"
                >{{ col.name }}</el-tag>
              </div>
              <div class="article-meta">
                <el-tag
                  v-for="tag in article.tagNames"
                  :key="tag"
                  size="small"
                  effect="plain"
                  type="primary"
                  style="margin-right: 8px"
                >
                  {{ tag }}
                </el-tag>
                <span class="meta-item">
                  <el-icon><View /></el-icon> {{ article.viewCount }}
                </span>
                <span class="meta-item">
                  <el-icon><Pointer /></el-icon> {{ article.likeCount }}
                </span>
                <span class="meta-item mono">{{ formatDate(article.createTime) }}</span>
              </div>
              <div class="article-content">
                <MdPreview :editorId="previewId" :modelValue="article.mdContent" :sanitize="sanitizeHtml" />
              </div>
              <div class="article-actions">
                <el-button
                  type="primary"
                  :icon="Pointer"
                  :disabled="hasLiked"
                  @click="handleLike"
                >
                  {{ hasLiked ? '已赞' : '点赞' }} {{ article.likeCount }}
                </el-button>
                <el-button text @click="router.push('/articles')">
                  <el-icon><Back /></el-icon> 返回列表
                </el-button>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :xs="24" :lg="6">
          <el-card class="sidebar-card" shadow="never">
            <template #header>
              <span>关于作者</span>
            </template>
            <div class="author-info">
              <el-avatar :size="64" :src="avatar.url || undefined" class="author-avatar">
                {{ avatarInitial }}
              </el-avatar>
              <h4>{{ about.title || '开发者' }}</h4>
              <p>{{ about.content || '热爱技术，记录成长。' }}</p>
            </div>
          </el-card>

          <el-card class="sidebar-card" shadow="never">
            <template #header>
              <span>热门文章</span>
            </template>
            <div v-if="hotArticles.length === 0" class="empty-state compact">
              <p>暂无更多文章</p>
            </div>
            <div
              v-for="item in hotArticles"
              :key="item.id"
              class="hot-article"
              @click="goDetail(item.id)"
            >
              {{ item.title }}
            </div>
          </el-card>
        </el-col>
      </el-row>
    </el-main>

    <footer class="footer">
      <p>© {{ new Date().getFullYear() }} 蜂潮网络科技工作室 · Powered by SSM + Vue 3</p>
      <p><a href="https://beian.miit.gov.cn" target="_blank" rel="noopener">粤ICP备2022081892号</a></p>
    </footer>

    <!-- 合集详情弹窗（不新增路由，关闭不丢阅读态） -->
    <el-dialog v-model="collectionDialogVisible" :title="collectionTitle" width="480px">
      <div v-if="collectionArticles">
        <div v-if="collectionArticles.description" class="cd-desc">{{ collectionArticles.description }}</div>
        <div v-if="collectionArticles.articles.length === 0" class="cd-empty">该合集暂无文章</div>
        <div
          v-for="a in collectionArticles.articles"
          :key="a.id"
          class="cd-item"
          @click="openArticle(a.id)"
        >{{ a.title }}</div>
      </div>
      <div v-else class="cd-empty">加载中…</div>
    </el-dialog>

    <!-- 移动端目录：右下角浮动小图标，点击展开抽屉 -->
    <el-button
      v-if="hasToc && !isDesktop"
      class="toc-fab"
      circle
      :icon="List"
      @click="tocDrawerVisible = true"
      aria-label="打开目录"
    />
    <el-drawer
      v-model="tocDrawerVisible"
      title="目录"
      direction="rtl"
      size="72%"
      :with-header="true"
      class="toc-drawer"
    >
      <div v-if="hasToc" class="toc-drawer-body">
        <MdCatalog :editorId="previewId" :scrollElement="scrollElement" :scrollElementOffsetTop="80" :onClick="onMobileTocClick" />
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, onActivated, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MdPreview, MdCatalog } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
import { View, Pointer, Back, ArrowDown, List } from '@element-plus/icons-vue'
import AppHeader from './components/AppHeader.vue'
import { getArticleDetail, likeArticle, getArticleLiked, getArticleList } from '../api/article'
import { getCollectionArticles } from '../api/collection'
import { getAbout, getAvatar } from '../api/config'
import { setArticleSeo } from '../utils/seo'
import { ElMessage } from 'element-plus'

// 目录窗（MdCatalog）必须与预览共用同一 editorId 才能抽取标题树；
// scrollElement 用 document.documentElement（整页 window 滚动），
// scrollElementOffsetTop=80 预留 sticky 顶栏(64px)+间距，避免锚点被顶栏遮挡。
const previewId = 'article-detail-md'
const scrollElement = document.documentElement

// 桌面端（≥1200px）目录固定左侧；移动端浮动图标 + 抽屉
const isDesktop = ref(false)
const tocCollapsed = ref(false)
const tocDrawerVisible = ref(false)
const tocColRef = ref(null)
const tocLeft = ref(0)
const tocWidth = ref(0)

const updateIsDesktop = () => {
  isDesktop.value = window.matchMedia('(min-width: 1200px)').matches
}

// 目录卡片 position:fixed 后脱离文档流，需按左侧列实际位置对齐（含 gutter 内边距）
const updateTocPosition = () => {
  const el = tocColRef.value?.$el || tocColRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0) return
  tocLeft.value = rect.left + 12
  tocWidth.value = rect.width - 24
}

// 移动端抽屉内点击目录项：MdCatalog 内部已完成锚点滚动，这里仅关闭抽屉
const onMobileTocClick = () => {
  tocDrawerVisible.value = false
}

// XSS 兜底：md-editor-v3 v4 已移除内置 XSS 过滤，渲染前用 DOMPurify 净化 Markdown 产出的 HTML。
// DOMPurify 改为「数据到达后动态 import」（P1-4），从首屏剥离约 224 KiB；
// 动态 import 与网络请求在 loadArticle 内并行，进入正文渲染前必已就绪。
let domPurifyInstance = null
const sanitizeHtml = (html) => {
  if (!domPurifyInstance) return html
  return domPurifyInstance.sanitize(html)
}

const route = useRoute()
const router = useRouter()
const article = ref(null)
const hotArticles = ref([])
const about = ref({ title: '', content: '' })
const avatar = ref({ url: '', show: true })
const hasLiked = ref(false)

// 仅当正文含 Markdown 标题时才展示目录窗，避免无标题文章出现空卡片
const hasToc = computed(() => {
  const md = article.value?.mdContent
  return !!md && /^#{1,6}\s/m.test(md)
})

// 合集详情弹窗状态（关闭不丢阅读态）
const collectionDialogVisible = ref(false)
const collectionArticles = ref(null)
const collectionTitle = ref('')

// 点击文章标题下方的合集 chip：打开弹窗加载该合集的排序文章列表
const openCollection = async (col) => {
  collectionTitle.value = col.name
  collectionArticles.value = null
  collectionDialogVisible.value = true
  try {
    collectionArticles.value = await getCollectionArticles(col.id)
  } catch (e) {
    collectionArticles.value = { articles: [] }
    ElMessage.error('加载合集失败')
  }
}

// 点击合集内文章项：新标签页打开（不跳转当前页，保持阅读态）
const openArticle = (id) => {
  window.open('/article/' + id, '_blank')
}

const avatarInitial = computed(() => {
  const t = (about.value.title || 'M').trim()
  return t ? t[0].toUpperCase() : 'M'
})

// 当前「已加载完成」的文章 id。本页被 App.vue 的 keep-alive 缓存（cachedViews 含
// 'ArticleDetail'），从 /article/1 跳到 /article/2 时组件实例被复用、
// onMounted 不会再触发，因此需要记录已加载 id，在 onActivated 中比对后按需重载。
const loadedId = ref(null)

/**
 * 当前「正在加载中」的文章 id，用于防止并发重入。
 *
 * 【为什么必须有它，且必须是同步写入的普通变量】
 * keep-alive 内的组件首次挂载时，Vue 会在同一次 post-flush 中先后同步调用
 * mounted 与 activated。由于 onMounted 回调是 async，它在 loadArticle 的
 * 第一个 await（Promise.all）处让出执行权后，activated 会立刻执行 ——
 * 此时 loadedId 尚未被赋值（仍为 null），仅凭 loadedId 做守卫会判定
 * 「还没加载过」从而触发第二次加载。后果不只是请求翻倍（5 -> 10 个），
 * 更严重的是后端 ArticleService.getDetail() 带 @Transactional 且每次调用都会
 * 执行 increaseViewCount(id)，**会导致线上浏览量被永久按 2 倍统计**。
 *
 * 因此这里用一个在「任何 await 之前」就同步写入的标记来关闭这个竞态窗口。
 * 它不参与渲染，故刻意用普通变量而非 ref —— 无需响应式，也避免无谓的依赖收集。
 *
 * @type {string | null}
 */
let loadingId = null

/**
 * 加载文章详情及页面配套数据，并在数据到达后写入文章级 SEO 元数据。
 *
 * 对同一 id 的并发调用是幂等的：后到的调用会直接返回，不会重复发起请求。
 *
 * @param {string|number} id 文章 id
 * @returns {Promise<void>}
 */
const loadArticle = async (id) => {
  const key = String(id)

  // 同步守卫：必须位于第一个 await 之前，否则挡不住 mounted/activated 的重入
  if (loadingId === key) return
  loadingId = key

  try {
    // 业务数据请求与 DOMPurify 动态加载并行（P1-4）：DOMPurify 不再静态进入首屏 chunk
    const [detailRes, listRes, aboutRes, likedRes, avatarRes, domPurifyMod] = await Promise.all([
      getArticleDetail(id),
      getArticleList({ page: 1, size: 5 }),
      getAbout(),
      getArticleLiked(id),
      getAvatar(),
      import('dompurify')
    ])
    domPurifyInstance = domPurifyMod.default
    article.value = detailRes.data
    hotArticles.value = listRes.data.list.filter(item => item.id != id).slice(0, 4)
    about.value = aboutRes.data
    hasLiked.value = likedRes.data
    if (avatarRes.data) {
      avatar.value = {
        url: avatarRes.data.url || '',
        show: avatarRes.data.show !== false
      }
    }
    loadedId.value = key

    // router.afterEach 只能写入路由表里的占位标题（此时文章还没加载完），
    // 这里用真实数据覆盖 title / description / OG / canonical / Article JSON-LD。
    setArticleSeo(article.value)

    // 文章数据到位、目录窗渲染后，重算固定定位（首屏图片加载可能改变布局）
    await nextTick()
    updateTocPosition()
  } finally {
    // 成功时 loadedId 已置位，后续由 loadedId 守卫去重；
    // 失败时清空标记，使得下次进入本页可以重试。
    if (loadingId === key) loadingId = null
  }
}

/**
 * 加载文章并吞掉异常，仅用于生命周期钩子。
 *
 * 钩子里直接 await 一个会 reject 的 Promise 会产生 unhandled rejection；
 * 用户可见的错误提示已由 src/api/request.js 的响应拦截器统一弹出，
 * 这里只需记录日志，避免污染控制台的未捕获异常。
 *
 * @param {string|number} id 文章 id
 * @returns {Promise<void>}
 */
const loadArticleSafely = async (id) => {
  try {
    await loadArticle(id)
  } catch (err) {
    console.error(`[ArticleDetail] 加载文章 ${id} 失败`, err)
  }
}

onMounted(async () => {
  updateIsDesktop()
  window.addEventListener('resize', onViewportChange)
  await loadArticleSafely(route.params.id)
  await nextTick()
  updateTocPosition()
})

// 视口变化（含横竖屏切换）：刷新桌面判断并重算固定目录位置
const onViewportChange = () => {
  updateIsDesktop()
  updateTocPosition()
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportChange)
})

// keep-alive 复用实例时补一次：id 变了就重新加载并刷新 SEO。
onActivated(async () => {
  const id = route.params.id
  if (!id) return
  const key = String(id)

  // 情况一：正是当前已加载的文章（例如从其他页面返回本页）。
  // 不重新请求，只补写 SEO —— 因为 router.afterEach 刚刚把 meta
  // 重置成了路由表里的占位值（「文章详情」），需要用真实数据覆盖回来。
  if (key === loadedId.value) {
    if (article.value) setArticleSeo(article.value)
    updateTocPosition()
    return
  }

  // 情况二：同一篇文章正在加载中（首次挂载时 mounted 已经发起请求，
  // 本钩子是在它的 await 让出窗口中被调用的）。直接返回，交给那次加载收尾。
  if (key === loadingId) return

  // 情况三：切换到了另一篇文章，清空旧内容后重新加载。
  article.value = null
  await loadArticleSafely(id)
})

const handleLike = async () => {
  if (hasLiked.value) return
  try {
    await likeArticle(article.value.id)
    article.value.likeCount++
    hasLiked.value = true
    ElMessage.success('点赞成功')
  } catch (e) {
    // 拦截器已弹出后端 msg（已赞/点赞太频繁等）；这里只做状态兜底，不重复弹错
    if (e?.msg === '已赞') {
      hasLiked.value = true
      ElMessage.warning('你已经赞过这篇文章了')
    } else if (e?.msg) {
      // 后端有明确提示（如限流文案），拦截器已 toast，这里保持静默
    } else {
      ElMessage.error('点赞失败')
    }
  }
}

const goDetail = (id) => {
  router.push(`/article/${id}`)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const formatDate = (time) => {
  if (!time) return ''
  return new Date(time).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: var(--bg);
}
.main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px 56px;
}
.article-card {
  border-radius: var(--radius-card);
  background: var(--bg-card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
}
.article-card :deep(.el-card__body) {
  padding: 24px 24px 32px;
}
.article-cover {
  height: 300px;
  border-radius: var(--radius-inner);
  overflow: hidden;
  margin-bottom: 28px;
  background: var(--bg-soft);
}
.article-cover .el-image {
  width: 100%;
  height: 100%;
}

/* 正文窄栏（约 720px 居中） */
.article-column {
  max-width: 720px;
  margin: 0 auto;
}
.article-title {
  font-family: var(--font-serif);
  font-size: 32px;
  color: var(--text);
  margin: 0 0 16px;
  line-height: 1.35;
}
.article-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

/* 文章所属合集 chip 行 */
.article-collections {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.ac-label {
  color: var(--text-muted);
  font-size: 13px;
}
.ac-chip {
  cursor: pointer;
}

/* 合集详情弹窗内文章列表 */
.cd-desc {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 16px;
}
.cd-item {
  padding: 12px 10px;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  transition: color 0.2s ease, background 0.2s ease;
}
.cd-item + .cd-item {
  border-top: 1px solid var(--border);
}
.cd-item:hover {
  color: var(--accent);
  background: var(--hover-bg);
}
.cd-empty {
  color: var(--text-muted);
  text-align: center;
  padding: 24px 0;
}
.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 14px;
}
.meta-item .el-icon {
  margin-right: 2px;
}
.meta-item.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}
.article-content {
  color: var(--text);
  line-height: 1.8;
  font-size: 16px;
}
.article-content :deep(.md-editor-preview) {
  --md-color: var(--text);
  --md-bk-color: transparent;
  font-size: 16px;
  line-height: 1.8;
}
.article-actions {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}

/* 侧栏 */
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
.author-info {
  text-align: center;
}
.author-avatar {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
  color: #fff;
  font-size: 24px;
  font-weight: 700;
}
.author-info h4 {
  margin: 12px 0 8px;
  color: var(--text);
}
.author-info p {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
}
.hot-article {
  padding: 12px 8px;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  transition: color 0.2s ease, background 0.2s ease;
}
.hot-article + .hot-article {
  border-top: 1px solid var(--border);
}
.hot-article:hover {
  color: var(--accent);
  background: var(--hover-bg);
}
.empty-state.compact {
  padding: 20px 12px;
}

/* 目录窗（MdCatalog）：桌面端固定于左侧、不随页面滚动移动，标题可展开/收起 */
.toc-card {
  position: fixed;
  top: 88px;
  z-index: 20;
  max-height: calc(100vh - 110px);
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-card);
  background: var(--bg-card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
}
.toc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px;
  font-family: var(--font-serif);
  font-weight: 700;
  color: var(--text);
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--border);
  transition: color 0.2s ease;
}
.toc-header:hover {
  color: var(--accent);
}
.toc-chevron {
  font-size: 13px;
  color: var(--text-muted);
  transition: transform 0.25s ease;
}
.toc-chevron.is-up {
  transform: rotate(180deg);
}
.toc-card.toc-collapsed .toc-body {
  display: none;
}
.toc-body {
  padding: 8px 10px 12px;
  overflow: hidden;
}
.toc-body :deep(.md-editor-catalog) {
  max-height: calc(100vh - 168px);
  overflow-y: auto;
}
.toc-body :deep(.md-editor-catalog-link) {
  border-radius: 6px;
  border-left: 2px solid transparent;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}
.toc-body :deep(.md-editor-catalog-link span) {
  color: var(--text-muted);
  white-space: normal;
  word-break: break-word;
  line-height: 1.4;
}
.toc-body :deep(.md-editor-catalog-link span:hover) {
  color: var(--accent);
}
.toc-body :deep(.md-editor-catalog-active > span) {
  color: var(--accent);
  font-weight: 600;
}
.toc-body :deep(.md-editor-catalog-active) {
  border-left-color: var(--accent);
  background: var(--hover-bg);
}

/* 移动端目录：右下角浮动小图标 + 抽屉 */
.toc-fab {
  position: fixed;
  right: 18px;
  bottom: 30px;
  z-index: 100;
  width: 48px;
  height: 48px;
  font-size: 20px;
  background: var(--accent);
  color: #fff;
  border: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.toc-fab:hover,
.toc-fab:focus {
  background: var(--accent-2);
  color: #fff;
}
.toc-drawer :deep(.toc-drawer-body) {
  padding: 4px 6px;
}
.toc-drawer :deep(.md-editor-catalog-link span) {
  color: var(--text-muted);
}
.toc-drawer :deep(.md-editor-catalog-link span:hover) {
  color: var(--accent);
}
.toc-drawer :deep(.md-editor-catalog-active > span) {
  color: var(--accent);
  font-weight: 600;
}
.toc-drawer :deep(.md-editor-catalog-active) {
  background: var(--hover-bg);
  border-radius: 6px;
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
  .article-cover {
    height: 180px;
  }
  .article-title {
    font-size: 24px;
  }
}
</style>
