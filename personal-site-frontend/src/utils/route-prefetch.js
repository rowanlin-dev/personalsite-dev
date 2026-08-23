/**
 * route-prefetch.js —— 路由 chunk 悬停预取（P1-6）
 * ===========================================================================
 *
 * 仅在用户**悬停 / 聚焦**导航链接时，触发对应路由的懒加载 chunk（`import()`），
 * 使站内跳转时目标页面 JS 已被预热，体验近乎瞬时。
 *
 * 刻意**不做无差别 prefetch**（页面挂载即预取全部路由），避免移动端在无意图
 * 跳转时白白消耗流量与带宽。
 *
 * 注意：这里的 `import()` 路径与 `src/router/index.js` 中路由懒加载使用的是
 * 同一批模块文件，Vite 会按「已解析模块路径」去重到同一个 chunk，
 * 因此预取的正是真实导航会加载的 chunk，不会重复打包。
 * ===========================================================================
 */

/**
 * 路由前缀 → 懒加载器映射。
 * 键用路由前缀（而非完整路径），便于 header 的 `/articles` 与首页文章卡片的
 * `/article` 共享同一份加载器。
 * @type {Record<string, () => Promise<unknown>>}
 */
const routeLoaders = {
  '/': () => import('../views/Home.vue'),
  '/articles': () => import('../views/Articles.vue'),
  '/projects': () => import('../views/Projects.vue'),
  '/article': () => import('../views/ArticleDetail.vue')
}

/** 已触发（或正在触发）预取的路由，保证幂等 */
const prefetched = Object.create(null)

/**
 * 预取指定路由的 chunk。幂等：同一路由只触发一次；失败静默降级。
 *
 * @param {string} path 路由前缀（'/' | '/articles' | '/projects' | '/article'）
 * @returns {void}
 */
export function prefetchRoute(path) {
  const loader = routeLoaders[path]
  if (!loader) return
  if (prefetched[path]) return
  prefetched[path] = true
  loader().catch((err) => {
    // 预取失败（如离线 / 弱网）不应影响正常交互，仅清空标记允许后续重试
    console.debug(`[prefetch] 预取 ${path} 失败`, err)
    prefetched[path] = false
  })
}

export default { prefetchRoute }
