import { createRouter, createWebHistory } from 'vue-router'
import { useAdminStore } from '../store/admin'
import { applyRouteSeo } from '../utils/seo'

/**
 * 路由表。
 *
 * meta 字段约定：
 *   theme       - 页面主题 class，由 App.vue 挂到 body 上（既有能力，不变）
 *   title       - 页面标题，不含 ` | 站点名` 后缀，由 utils/seo.js 统一拼接
 *   description - 页面描述，用于 <meta name="description"> 与社交分享卡片
 *   noindex     - 是否禁止搜索引擎索引（后台全部为 true）
 *
 * 注意：/article/:id 是动态路由，afterEach 执行时文章数据还没到，
 * 这里只能给占位文案，真实标题/摘要由 ArticleDetail.vue 在数据返回后
 * 调用 setArticleSeo() 覆盖。
 */
const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: {
      theme: 'theme-dark',
      title: '全栈开发者的技术博客与作品集',
      description:
        '蜂潮网络科技工作室 —— 全栈开发者的技术博客与项目作品集，分享 Java、Vue、前后端工程实践与架构思考。'
    }
  },
  {
    path: '/articles',
    name: 'Articles',
    component: () => import('../views/Articles.vue'),
    meta: {
      theme: 'theme-light',
      title: '技术博客',
      description:
        '技术文章归档：Java 后端、Vue 前端、工程化与架构设计实践笔记，支持按标签与合集检索。'
    }
  },
  {
    path: '/article/:id',
    name: 'ArticleDetail',
    component: () => import('../views/ArticleDetail.vue'),
    meta: {
      theme: 'theme-light',
      title: '文章详情',
      description: '阅读蜂潮网络科技工作室的技术文章全文。'
    }
  },
  {
    path: '/projects',
    name: 'Projects',
    component: () => import('../views/Projects.vue'),
    meta: {
      theme: 'theme-light',
      title: '项目作品',
      description:
        '项目作品集：全栈项目、开源实践与工具作品，含技术选型说明、在线预览与源码入口。'
    }
  },
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: () => import('../views/admin/Login.vue'),
    meta: { title: '后台登录', noindex: true }
  },
  {
    path: '/admin',
    component: () => import('../views/admin/Layout.vue'),
    redirect: '/admin/dashboard',
    meta: { title: '后台管理', noindex: true },
    children: [
      { path: 'dashboard', component: () => import('../views/admin/Dashboard.vue'), meta: { title: '控制台', noindex: true } },
      { path: 'articles', component: () => import('../views/admin/Articles.vue'), meta: { title: '文章管理', noindex: true } },
      { path: 'article-edit', component: () => import('../views/admin/ArticleEdit.vue'), meta: { title: '编辑文章', noindex: true } },
      { path: 'projects', component: () => import('../views/admin/Projects.vue'), meta: { title: '项目管理', noindex: true } },
      { path: 'project-edit', component: () => import('../views/admin/ProjectEdit.vue'), meta: { title: '编辑项目', noindex: true } },
      { path: 'skills', component: () => import('../views/admin/Skills.vue'), meta: { title: '技能管理', noindex: true } },
      { path: 'skill-edit', component: () => import('../views/admin/SkillEdit.vue'), meta: { title: '编辑技能', noindex: true } },
      { path: 'tags', component: () => import('../views/admin/TagManagement.vue'), meta: { title: '标签管理', noindex: true } },
      { path: 'collections', component: () => import('../views/admin/CollectionManagement.vue'), meta: { title: '合集管理', noindex: true } },
      { path: 'config', component: () => import('../views/admin/Config.vue'), meta: { title: '站点配置', noindex: true } },
      { path: 'assets', component: () => import('../views/admin/AssetLibrary.vue'), meta: { title: '素材库', noindex: true } }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const adminStore = useAdminStore()
  if (to.path.startsWith('/admin') && to.path !== '/admin/login' && !adminStore.username) {
    next('/admin/login')
  } else {
    next()
  }
})

/**
 * 统一在导航完成后应用 SEO 元数据。
 *
 * 【为什么是 afterEach 而不是组件 onMounted】
 * App.vue 对 Home / Articles / Projects / ArticleDetail 开启了 keep-alive，
 * 二次进入这些页面时组件走 activated 而非 mounted，onMounted 不再触发，
 * meta 会停留在上一个页面的值。afterEach 每次导航都执行，不受缓存影响。
 *
 * 嵌套路由（/admin/*）取匹配链最后一段的 meta，即真正渲染的子路由。
 */
router.afterEach((to) => {
  const matchedLeaf = to.matched.length ? to.matched[to.matched.length - 1] : null
  // 合并父级 meta（如 /admin 的 noindex）与叶子 meta，叶子优先
  const mergedMeta = to.matched.reduce((acc, record) => Object.assign(acc, record.meta || {}), {})
  applyRouteSeo({
    path: to.path,
    meta: matchedLeaf ? mergedMeta : to.meta || {}
  })
})

export default router
