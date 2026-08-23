/**
 * seo.js —— 站点 SEO 元数据统一封装
 * ===========================================================================
 *
 * 【职责】
 * 集中管理 document.head 里所有与 SEO / 社交分享相关的标签：
 *   <title> / <meta name="description"> / <meta name="robots">
 *   Open Graph（微信、QQ、微博）/ Twitter Card / <link rel="canonical">
 *   <script type="application/ld+json"> 结构化数据
 *
 * 【为什么必须走路由钩子而不是组件 onMounted】
 * src/App.vue 对 Home / Articles / Projects / ArticleDetail 开启了 keep-alive
 * （App.vue:16）。keep-alive 命中缓存时组件被激活而非重新挂载，onMounted 不会
 * 再次触发，meta 就会停留在上一个页面的值。因此统一在 router.afterEach 中调用
 * applyRouteSeo()（见 src/router/index.js）。
 *
 * 【关于 CSP】
 * 生产 nginx 配置了 `script-src 'self'`（deploy/nginx-minipluto.conf）。
 * 本文件注入的 JSON-LD 使用 <script type="application/ld+json">，
 * 属于「数据块」而非可执行脚本，浏览器不会按 script-src 校验，不会被拦截。
 * 切勿改成 <script>window.__X__=...</script> 这类可执行内联脚本。
 *
 * 【局限（架构评审 §2.1 已明示）】
 * 本模块的所有写入都发生在 JS 执行之后。百度、微信/QQ/微博的抓取器不执行 JS，
 * 只能读到 index.html 里的静态默认值。因此本模块是「必要非充分条件」，
 * 真正让爬虫看到内容需要 P1 的预渲染或 P2 的服务端注入。
 * ===========================================================================
 */

/* global __SITE_ORIGIN__ */

/**
 * 站点主域。由 vite.config.js 的 define 注入（默认 https://minipluto.cn，
 * 可用环境变量 VITE_SITE_ORIGIN 覆盖）。
 *
 * 必须是「固定主域」而不是 window.location.origin：
 * minipluto.cn 与 www.minipluto.cn 若各自指向自己，canonical 就失去了
 * 把权重收敛到同一 URL 的作用。
 *
 * @type {string}
 */
export const SITE_ORIGIN =
  typeof __SITE_ORIGIN__ === 'string' && __SITE_ORIGIN__
    ? __SITE_ORIGIN__.replace(/\/+$/, '')
    : 'https://minipluto.cn'

/** 站点名称，用于 <title> 后缀与 og:site_name。 */
export const SITE_NAME = '蜂潮网络科技工作室'

/** 站点默认描述，与 index.html 中的静态 description 保持一致。 */
export const SITE_DEFAULT_DESCRIPTION =
  '蜂潮网络科技工作室 —— 全栈开发者的技术博客与项目作品集，分享 Java、Vue、前后端工程实践与架构思考。'

/** 社交分享默认缩略图（相对站点根目录，需为可公开访问的静态资源）。
 *  注：必须为 PNG（LEG-2 修复）。社交抓取器（微信/QQ/微博/Twitter）多不渲染 SVG，
 *  故 og:image / twitter:image 默认图由 P0 的 /favicon.svg 改为 /og-default.png。 */
export const SITE_DEFAULT_IMAGE = '/og-default.png'

/** 由本模块创建的标签统一打这个标记，便于识别与清理，避免误删手写标签。 */
const MANAGED_ATTR = 'data-seo-managed'

/** JSON-LD script 节点的固定 id，保证每次覆盖而不是不断追加。 */
const JSON_LD_ID = 'seo-json-ld'

/* -------------------------------------------------------------------------- */
/* 内部工具                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 判断当前是否处于可操作 DOM 的浏览器环境。
 * 预渲染 / 单测等非浏览器环境下所有写入应静默跳过。
 *
 * @returns {boolean}
 */
function canUseDom() {
  return typeof document !== 'undefined' && !!document.head
}

/**
 * 按选择器查找 head 中的标签，不存在则按给定属性创建并插入。
 *
 * @param {string} selector CSS 选择器，例如 'meta[property="og:title"]'
 * @param {string} tagName  标签名，例如 'meta'
 * @param {Record<string, string>} attrs 创建时写入的属性
 * @returns {HTMLElement | null} 目标元素；非浏览器环境返回 null
 */
function ensureHeadTag(selector, tagName, attrs) {
  if (!canUseDom()) return null
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement(tagName)
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value)
    }
    el.setAttribute(MANAGED_ATTR, 'true')
    document.head.appendChild(el)
  }
  return el
}

/**
 * 设置（或移除）一个 <meta name="..."> 标签的 content。
 *
 * @param {string} name  meta 的 name 属性
 * @param {string} content 内容；传空字符串表示移除该标签
 * @returns {void}
 */
function setMetaByName(name, content) {
  if (!canUseDom()) return
  const selector = `meta[name="${name}"]`
  if (!content) {
    const existing = document.head.querySelector(selector)
    if (existing && existing.getAttribute(MANAGED_ATTR) === 'true') existing.remove()
    return
  }
  const el = ensureHeadTag(selector, 'meta', { name })
  if (el) el.setAttribute('content', content)
}

/**
 * 设置一个 <meta property="..."> 标签的 content（Open Graph 用 property）。
 *
 * @param {string} property meta 的 property 属性
 * @param {string} content  内容；传空字符串表示移除该标签
 * @returns {void}
 */
function setMetaByProperty(property, content) {
  if (!canUseDom()) return
  const selector = `meta[property="${property}"]`
  if (!content) {
    const existing = document.head.querySelector(selector)
    if (existing && existing.getAttribute(MANAGED_ATTR) === 'true') existing.remove()
    return
  }
  const el = ensureHeadTag(selector, 'meta', { property })
  if (el) el.setAttribute('content', content)
}

/**
 * 把任意路径 / 相对地址补全为基于站点主域的绝对 URL。
 *
 * @param {string} pathOrUrl 绝对 URL、以 / 开头的路径，或相对路径
 * @returns {string} 绝对 URL
 */
export function toAbsoluteUrl(pathOrUrl) {
  const value = (pathOrUrl || '').trim()
  if (!value) return SITE_ORIGIN + '/'
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return 'https:' + value
  return SITE_ORIGIN + (value.startsWith('/') ? value : '/' + value)
}

/**
 * 把富文本 / Markdown 压成适合做 description 的纯文本摘要。
 *
 * @param {string} raw       原始文本
 * @param {number} [maxLen=150] 最大长度（含省略号）
 * @returns {string} 纯文本摘要
 */
export function toPlainSummary(raw, maxLen = 150) {
  if (!raw) return ''
  const text = String(raw)
    .replace(/```[\s\S]*?```/g, ' ')      // 去代码块
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 去图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保留文字
    .replace(/<[^>]+>/g, ' ')              // 去 HTML 标签
    .replace(/[#>*_`~|-]+/g, ' ')          // 去 Markdown 记号
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1).trimEnd() + '…'
}

/* -------------------------------------------------------------------------- */
/* 对外原子能力                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 设置页面标题。
 *
 * @param {string}  title 页面标题；为空时只显示站点名
 * @param {boolean} [withSuffix=true] 是否拼接 ` | 站点名` 后缀
 * @returns {string} 最终写入的标题
 */
export function setTitle(title, withSuffix = true) {
  const finalTitle = !title
    ? SITE_NAME
    : withSuffix && title !== SITE_NAME
      ? `${title} | ${SITE_NAME}`
      : title
  if (canUseDom()) document.title = finalTitle
  return finalTitle
}

/**
 * 设置页面描述（同时同步 og:description 与 twitter:description）。
 *
 * @param {string} description 描述文本
 * @returns {void}
 */
export function setDescription(description) {
  const text = description || SITE_DEFAULT_DESCRIPTION
  setMetaByName('description', text)
  setMetaByProperty('og:description', text)
  setMetaByName('twitter:description', text)
}

/**
 * 设置 Open Graph 标签（微信 / QQ / 微博 / Facebook 分享卡片）。
 *
 * @param {object} og
 * @param {string} [og.title]     og:title
 * @param {string} [og.description] og:description
 * @param {string} [og.url]       og:url，相对路径会自动补全为绝对地址
 * @param {string} [og.image]     og:image，相对路径会自动补全为绝对地址
 * @param {string} [og.type]      og:type，默认 website
 * @returns {void}
 */
export function setOG({ title, description, url, image, type } = {}) {
  setMetaByProperty('og:site_name', SITE_NAME)
  setMetaByProperty('og:locale', 'zh_CN')
  setMetaByProperty('og:type', type || 'website')
  if (title) setMetaByProperty('og:title', title)
  if (description) setMetaByProperty('og:description', description)
  setMetaByProperty('og:url', toAbsoluteUrl(url || '/'))
  setMetaByProperty('og:image', toAbsoluteUrl(image || SITE_DEFAULT_IMAGE))
}

/**
 * 设置 Twitter Card 标签。
 *
 * @param {object} twitter
 * @param {string} [twitter.title]       twitter:title
 * @param {string} [twitter.description] twitter:description
 * @param {string} [twitter.image]       twitter:image
 * @param {string} [twitter.card]        卡片类型，默认 summary_large_image
 * @returns {void}
 */
export function setTwitter({ title, description, image, card } = {}) {
  setMetaByName('twitter:card', card || 'summary_large_image')
  if (title) setMetaByName('twitter:title', title)
  if (description) setMetaByName('twitter:description', description)
  setMetaByName('twitter:image', toAbsoluteUrl(image || SITE_DEFAULT_IMAGE))
}

/**
 * 设置 <link rel="canonical">。
 *
 * 刻意只取 path（丢弃 query 与 hash）：`?from=xxx`、`?utm_source=xxx` 这类
 * 追踪参数会被搜索引擎当成不同 URL，导致同一篇内容权重被分散。
 *
 * @param {string} pathOrUrl 路径或绝对 URL
 * @returns {string} 最终写入的 canonical 地址
 */
export function setCanonical(pathOrUrl) {
  const absolute = toAbsoluteUrl(pathOrUrl || '/')
  let clean = absolute
  try {
    const parsed = new URL(absolute)
    clean = parsed.origin + parsed.pathname
  } catch {
    clean = absolute.split('?')[0].split('#')[0]
  }
  // 统一去掉非根路径的结尾斜杠，避免 /articles 与 /articles/ 双份
  if (clean.length > SITE_ORIGIN.length + 1 && clean.endsWith('/')) {
    clean = clean.replace(/\/+$/, '')
  }
  const el = ensureHeadTag('link[rel="canonical"]', 'link', { rel: 'canonical' })
  if (el) el.setAttribute('href', clean)
  return clean
}

/**
 * 设置 <meta name="robots">，用于把后台等页面排除出索引。
 *
 * @param {boolean} noindex true 写入 noindex,nofollow；false 移除该标签
 * @returns {void}
 */
export function setRobots(noindex) {
  setMetaByName('robots', noindex ? 'noindex, nofollow' : '')
}

/**
 * 注入 / 覆盖 JSON-LD 结构化数据。
 *
 * @param {object | null} data JSON-LD 对象；传 null 表示移除
 * @returns {void}
 */
export function setJsonLd(data) {
  if (!canUseDom()) return
  const existing = document.getElementById(JSON_LD_ID)
  if (!data) {
    if (existing) existing.remove()
    return
  }
  const el =
    existing ||
    (() => {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.id = JSON_LD_ID
      script.setAttribute(MANAGED_ATTR, 'true')
      document.head.appendChild(script)
      return script
    })()
  el.textContent = JSON.stringify(data)
}

/* -------------------------------------------------------------------------- */
/* 组合能力                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 一次性应用一组 SEO 元数据。所有页面级入口最终都收敛到这里。
 *
 * @param {object} meta
 * @param {string} [meta.title]       页面标题（不含站点名后缀）
 * @param {string} [meta.description] 页面描述
 * @param {string} [meta.path]        页面路径（用于 canonical 与 og:url）
 * @param {string} [meta.image]       分享缩略图
 * @param {string} [meta.type]        og:type，文章页用 'article'
 * @param {boolean} [meta.noindex]    是否禁止索引
 * @param {object | null} [meta.jsonLd] JSON-LD 数据
 * @returns {void}
 */
export function applySeo({
  title = '',
  description = '',
  path = '/',
  image = SITE_DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
  jsonLd = null
} = {}) {
  const finalTitle = setTitle(title)
  const finalDescription = description || SITE_DEFAULT_DESCRIPTION

  setDescription(finalDescription)
  setRobots(noindex)

  // 后台等 noindex 页面不需要社交分享卡片与 canonical，直接跳过，
  // 避免把 /admin/* 的 URL 暴露进分享元数据。
  if (noindex) {
    setJsonLd(null)
    return
  }

  const canonical = setCanonical(path)
  setOG({ title: finalTitle, description: finalDescription, url: canonical, image, type })
  setTwitter({ title: finalTitle, description: finalDescription, image })
  setJsonLd(jsonLd)
}

/**
 * 依据路由对象应用 SEO。由 router.afterEach 调用。
 *
 * 说明：route.meta.title / route.meta.description 在 src/router/index.js 中定义。
 * 动态路由（如 /article/:id）此时还没有业务数据，只能先用占位文案，
 * 待数据返回后由页面调用 setArticleSeo() 覆盖。
 *
 * @param {import('vue-router').RouteLocationNormalized} route 目标路由
 * @returns {void}
 */
export function applyRouteSeo(route) {
  if (!route) return
  const meta = route.meta || {}
  applySeo({
    title: meta.title || '',
    description: meta.description || '',
    path: route.path,
    noindex: meta.noindex === true,
    jsonLd: meta.noindex === true ? null : buildWebSiteJsonLd()
  })
}

/**
 * 文章详情页专用：数据返回后用真实文章信息覆盖 SEO 元数据。
 *
 * 必须在接口数据到达后调用 —— router.afterEach 执行时文章还没加载，
 * 只能写入占位标题。
 *
 * @param {object} article 文章对象
 * @param {number|string} article.id 文章 id
 * @param {string} article.title 标题
 * @param {string} [article.summary] 摘要
 * @param {string} [article.mdContent] 正文 Markdown，无摘要时用于截取
 * @param {string} [article.coverImage] 封面图 URL
 * @param {string} [article.createTime] 发布时间
 * @param {string} [article.updateTime] 更新时间
 * @param {string[]} [article.tagNames] 标签
 * @returns {void}
 */
export function setArticleSeo(article) {
  if (!article) return
  const path = `/article/${article.id}`
  const description =
    toPlainSummary(article.summary, 150) || toPlainSummary(article.mdContent, 150) || SITE_DEFAULT_DESCRIPTION
  const image = article.coverImage || SITE_DEFAULT_IMAGE

  applySeo({
    title: article.title || '',
    description,
    path,
    image,
    type: 'article',
    noindex: false,
    jsonLd: buildArticleJsonLd(article, description)
  })
}

/* -------------------------------------------------------------------------- */
/* JSON-LD 构造                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 构造站点级 WebSite 结构化数据。
 *
 * @returns {object} JSON-LD 对象
 */
export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_ORIGIN + '/',
    inLanguage: 'zh-CN',
    description: SITE_DEFAULT_DESCRIPTION
  }
}

/**
 * 构造文章级 Article 结构化数据。
 *
 * @param {object} article     文章对象，字段同 setArticleSeo
 * @param {string} description 已算好的纯文本摘要
 * @returns {object} JSON-LD 对象
 */
export function buildArticleJsonLd(article, description) {
  const url = toAbsoluteUrl(`/article/${article.id}`)
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title || '',
    description: description || '',
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'zh-CN',
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_ORIGIN + '/' },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_ORIGIN + '/' }
  }
  if (article.coverImage) data.image = [toAbsoluteUrl(article.coverImage)]
  if (article.createTime) data.datePublished = new Date(article.createTime).toISOString()
  if (article.updateTime || article.createTime) {
    data.dateModified = new Date(article.updateTime || article.createTime).toISOString()
  }
  if (Array.isArray(article.tagNames) && article.tagNames.length) {
    data.keywords = article.tagNames.join(', ')
  }
  return data
}

export default {
  SITE_ORIGIN,
  SITE_NAME,
  SITE_DEFAULT_DESCRIPTION,
  setTitle,
  setDescription,
  setOG,
  setTwitter,
  setCanonical,
  setRobots,
  setJsonLd,
  applySeo,
  applyRouteSeo,
  setArticleSeo,
  buildWebSiteJsonLd,
  buildArticleJsonLd,
  toAbsoluteUrl,
  toPlainSummary
}
