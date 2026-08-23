/**
 * qa-test-seo.mjs —— src/utils/seo.js 行为单测
 * ===========================================================================
 * 沙箱无 jsdom/vitest，这里用一个「最小 DOM 桩」驱动 seo.js 的真实实现，
 * 校验 SEO 元数据的实际写入结果（而非只读代码判断）。
 *
 * 覆盖：
 *   - setTitle 站点名后缀拼接
 *   - setCanonical 去 query/hash、去结尾斜杠
 *   - applySeo(noindex) 是否正确跳过 canonical/OG/JSON-LD 并写 robots
 *   - applyRouteSeo 对 /admin/** 的 noindex 处理
 *   - toPlainSummary 的 Markdown 清洗
 *   - setArticleSeo 生成的 Article JSON-LD 结构
 *
 * 用法：node scripts/qa-test-seo.mjs
 * ===========================================================================
 */

/* -------------------------------------------------------------------------- */
/* 最小 DOM 桩                                                                  */
/* -------------------------------------------------------------------------- */

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName).toLowerCase()
    this.attributes = new Map()
    this.textContent = ''
    this.parent = null
  }
  setAttribute(k, v) { this.attributes.set(k, String(v)) }
  getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null }
  hasAttribute(k) { return this.attributes.has(k) }
  remove() {
    if (this.parent) {
      const arr = this.parent.children
      const i = arr.indexOf(this)
      if (i >= 0) arr.splice(i, 1)
      this.parent = null
    }
  }
  get id() { return this.attributes.get('id') || '' }
  set id(v) { this.attributes.set('id', v) }
  get type() { return this.attributes.get('type') || '' }
  set type(v) { this.attributes.set('type', v) }
}

class FakeHead {
  constructor() { this.children = [] }
  appendChild(el) { el.parent = this; this.children.push(el); return el }
  /** 支持 tag[attr="value"] 与 tag 两种选择器 */
  querySelector(selector) {
    const m = selector.match(/^(\w+)(?:\[([\w:-]+)="([^"]*)"\])?$/)
    if (!m) return null
    const [, tag, attr, value] = m
    return (
      this.children.find(
        (el) => el.tagName === tag.toLowerCase() && (!attr || el.getAttribute(attr) === value)
      ) || null
    )
  }
}

const head = new FakeHead()
globalThis.document = {
  head,
  title: '',
  createElement: (tag) => new FakeElement(tag),
  getElementById: (id) => head.children.find((el) => el.getAttribute('id') === id) || null
}

function resetDom() {
  head.children.length = 0
  globalThis.document.title = ''
}

const metaByName = (name) => {
  const el = head.querySelector(`meta[name="${name}"]`)
  return el ? el.getAttribute('content') : null
}
const metaByProp = (p) => {
  const el = head.querySelector(`meta[property="${p}"]`)
  return el ? el.getAttribute('content') : null
}
const canonicalHref = () => {
  const el = head.querySelector('link[rel="canonical"]')
  return el ? el.getAttribute('href') : null
}
const jsonLd = () => {
  const el = document.getElementById('seo-json-ld')
  return el ? JSON.parse(el.textContent) : null
}

/* -------------------------------------------------------------------------- */
/* 断言                                                                         */
/* -------------------------------------------------------------------------- */

let pass = 0
let fail = 0
const eq = (actual, expected, label) => {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) { pass += 1; console.log(`  PASS  ${label}`) }
  else { fail += 1; console.log(`  FAIL  ${label}\n          期望 ${e}\n          实际 ${a}`) }
}
const truthy = (v, label) => eq(!!v, true, label)

/* -------------------------------------------------------------------------- */

const seo = await import('../src/utils/seo.js')

console.log('=== src/utils/seo.js 单测 ===')

console.log('\n[A] setTitle')
resetDom()
eq(seo.setTitle('技术博客'), '技术博客 | 蜂潮网络科技工作室', '普通标题拼接站点名后缀')
eq(seo.setTitle(''), '蜂潮网络科技工作室', '空标题只显示站点名')
eq(seo.setTitle('蜂潮网络科技工作室'), '蜂潮网络科技工作室', '标题等于站点名时不重复拼接')
eq(seo.setTitle('技术博客', false), '技术博客', 'withSuffix=false 不拼后缀')

console.log('\n[B] setCanonical 归一化')
resetDom()
eq(seo.setCanonical('/articles?utm_source=x#top'), 'https://minipluto.cn/articles', '去掉 query 与 hash')
eq(seo.setCanonical('/articles/'), 'https://minipluto.cn/articles', '去掉非根路径结尾斜杠')
eq(seo.setCanonical('/'), 'https://minipluto.cn/', '根路径保留斜杠')

console.log('\n[C] applySeo —— 公开页')
// 注意契约：applySeo 的 jsonLd 参数默认为 null，本身不注入结构化数据；
// 注入 WebSite JSON-LD 是 applyRouteSeo 的职责（它显式传 buildWebSiteJsonLd()）。
// 首轮此处误按「applySeo 应自动注入」断言，属测试用例写错，已修正。
resetDom()
seo.applySeo({ title: '项目作品', description: '项目描述', path: '/projects' })
eq(document.title, '项目作品 | 蜂潮网络科技工作室', 'document.title 已写入')
eq(metaByName('description'), '项目描述', 'meta description 已写入')
eq(canonicalHref(), 'https://minipluto.cn/projects', 'canonical 已写入')
eq(metaByProp('og:url'), 'https://minipluto.cn/projects', 'og:url 已写入')
eq(metaByProp('og:type'), 'website', 'og:type = website')
eq(metaByName('twitter:card'), 'summary_large_image', 'twitter:card 已写入')
eq(metaByName('robots'), null, '公开页不应有 robots 标签')
eq(jsonLd(), null, 'applySeo 未传 jsonLd 时不注入结构化数据（契约如此）')

console.log('\n[C2] applyRouteSeo —— 公开页应注入 WebSite JSON-LD')
resetDom()
seo.applyRouteSeo({ path: '/projects', meta: { title: '项目作品', description: '项目描述' } })
truthy(jsonLd(), '公开页经 applyRouteSeo 注入 WebSite JSON-LD')
eq(jsonLd() && jsonLd()['@type'], 'WebSite', 'JSON-LD 类型为 WebSite')
eq(jsonLd() && jsonLd().url, 'https://minipluto.cn/', 'JSON-LD url 为站点主域')

console.log('\n[D] applyRouteSeo —— /admin/** 后台页 noindex')
resetDom()
seo.applyRouteSeo({ path: '/admin/dashboard', meta: { title: '控制台', noindex: true } })
eq(metaByName('robots'), 'noindex, nofollow', '后台页写入 noindex, nofollow')
eq(canonicalHref(), null, '后台页不应写 canonical')
eq(metaByProp('og:url'), null, '后台页不应写 og:url')
eq(jsonLd(), null, '后台页不应注入 JSON-LD')

console.log('\n[E] 公开页 -> 后台页 -> 公开页 的标签清理（keep-alive 场景关键）')
resetDom()
seo.applyRouteSeo({ path: '/articles', meta: { title: '技术博客', description: '文章归档' } })
eq(metaByName('robots'), null, '第一步：公开页无 robots')
seo.applyRouteSeo({ path: '/admin/dashboard', meta: { title: '控制台', noindex: true } })
eq(metaByName('robots'), 'noindex, nofollow', '第二步：进后台写 noindex')
eq(jsonLd(), null, '第二步：JSON-LD 已被移除')
seo.applyRouteSeo({ path: '/articles', meta: { title: '技术博客', description: '文章归档' } })
eq(metaByName('robots'), null, '第三步：回到公开页，robots 必须被移除（否则整站被 noindex）')
truthy(jsonLd(), '第三步：JSON-LD 重新注入')
eq(canonicalHref(), 'https://minipluto.cn/articles', '第三步：canonical 更新为当前页')

console.log('\n[F] toPlainSummary Markdown 清洗')
eq(seo.toPlainSummary('# 标题\n\n正文**加粗**内容'), '标题 正文 加粗 内容', '去掉标题与加粗记号')
eq(seo.toPlainSummary('见 [链接](https://a.com) 结束'), '见 链接 结束', '链接保留文字')
eq(seo.toPlainSummary('```js\nconst a=1\n```\n正文'), '正文', '去掉代码块')
eq(seo.toPlainSummary('![图](a.png) 正文'), '正文', '去掉图片')
eq(seo.toPlainSummary('a'.repeat(200)).length, 150, '超长文本截断到 150')

console.log('\n[G] setArticleSeo 与 Article JSON-LD')
resetDom()
seo.setArticleSeo({
  id: 42,
  title: 'Vue 性能优化实践',
  summary: '本文介绍首屏优化',
  coverImage: 'https://cdn.example.com/c.png',
  createTime: '2024-05-01T10:00:00Z',
  updateTime: '2024-06-01T10:00:00Z',
  tagNames: ['Vue', '性能']
})
eq(document.title, 'Vue 性能优化实践 | 蜂潮网络科技工作室', '文章标题已写入')
eq(metaByName('description'), '本文介绍首屏优化', '文章描述取 summary')
eq(canonicalHref(), 'https://minipluto.cn/article/42', '文章 canonical 正确')
eq(metaByProp('og:type'), 'article', 'og:type = article')
eq(metaByProp('og:image'), 'https://cdn.example.com/c.png', 'og:image 用文章封面绝对地址')
const ld = jsonLd()
eq(ld['@type'], 'Article', 'JSON-LD 类型为 Article')
eq(ld.headline, 'Vue 性能优化实践', 'JSON-LD headline')
eq(ld.keywords, 'Vue, 性能', 'JSON-LD keywords')
eq(ld.datePublished, '2024-05-01T10:00:00.000Z', 'JSON-LD datePublished')
eq(ld.dateModified, '2024-06-01T10:00:00.000Z', 'JSON-LD dateModified')
eq(ld.mainEntityOfPage['@id'], 'https://minipluto.cn/article/42', 'JSON-LD mainEntityOfPage')

console.log('\n[H] setArticleSeo 无 summary 时回退正文摘要')
resetDom()
seo.setArticleSeo({ id: 7, title: 'T', mdContent: '# H\n\n正文内容在此' })
eq(metaByName('description'), 'H 正文内容在此', '无 summary 时用 mdContent 截取')

console.log(`\n=== 合计: 通过 ${pass}，失败 ${fail} ===`)
process.exit(fail ? 1 : 0)
