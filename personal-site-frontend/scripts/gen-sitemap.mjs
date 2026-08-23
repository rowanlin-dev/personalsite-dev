#!/usr/bin/env node
/**
 * gen-sitemap.mjs —— 构建期生成 sitemap.xml（P1-3）
 * ===========================================================================
 *
 * 读取后端公开接口 `/api/article/list`、`/api/project/list` 的公开 ID，
 * 拼接出站点全部可被收录的 URL，写入 `dist/sitemap.xml`。
 *
 * 【健壮性设计（来自 p1-optimization-tasklist.md §2 P1-3）】
 *   - 后端不可达时**不崩溃、不产出空壳**：回退到「仅静态路由」的最小可用
 *     sitemap（`/`、`/articles`、`/projects`），并在文件头用 XML 注释标注
 *     动态 URL 缺失，同时向 stdout 打印醒目 PARTIAL 警告，交由真机
 *     `npm run build:full` 补全。
 *   - 支持本地 fixture（`SITEMAP_FIXTURE` 指向 JSON 文件），用于在沙箱/CI 中
 *     独立验证脚本结构与产出，无需连后端。
 *   - 异常信息清晰：仅在「连静态路由都无法产出」的极端情形才非零退出。
 *
 * 【用法】
 *   node scripts/gen-sitemap.mjs
 *   SITEMAP_API_BASE=http://localhost:8080 SITEMAP_SITE_ORIGIN=https://minipluto.cn node scripts/gen-sitemap.mjs
 *   SITEMAP_FIXTURE=./scripts/sitemap-fixture.json node scripts/gen-sitemap.mjs
 *
 * 【接入】package.json 的 `sitemap` 与 `build:full`（`build:clean` 后串联本脚本）。
 * ===========================================================================
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const DIST_DIR = path.resolve(REPO_ROOT, 'dist')

const API_BASE = (process.env.SITEMAP_API_BASE || 'http://localhost:8080').replace(/\/+$/, '')
const SITE_ORIGIN = (process.env.SITEMAP_SITE_ORIGIN || 'https://minipluto.cn').replace(/\/+$/, '')
const FIXTURE_PATH = process.env.SITEMAP_FIXTURE || null

/** 站点静态路由（始终收录） */
const STATIC_ROUTES = ['/', '/articles', '/projects']

/** 统一超时（ms），避免后端挂起 */
const FETCH_TIMEOUT_MS = 8000

/**
 * XML 文本转义（loc 里的 id 通常为数字，但保持通用）。
 * @param {string} s
 * @returns {string}
 */
function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * 从一个（可能多层包裹的）后端响应里尽力抽取 id 数组。
 * 兼容多种返回结构：
 *   {data:{list:[...]}} / {data:{data:{list}}} / {data:{records}} /
 *   {list:[...]} / {data:[...]} / [...] 。
 * @param {any} payload
 * @returns {Array<string|number>}
 */
function extractIds(payload) {
  if (!payload || typeof payload !== 'object') return []
  const candidates = [
    payload?.data?.list,
    payload?.data?.data?.list,
    payload?.data?.records,
    Array.isArray(payload?.data) ? payload.data : null,
    payload?.list,
    Array.isArray(payload) ? payload : null
  ].filter(Boolean)

  for (const coll of candidates) {
    if (Array.isArray(coll)) {
      const ids = coll
        .map((item) => (item && (item.id ?? item.articleId ?? item.projectId)))
        .filter((id) => id !== undefined && id !== null)
      if (ids.length) return ids
    }
  }
  return []
}

/**
 * 带超时与错误的 fetch JSON（Node 18+ 全局 fetch）。
 * @param {string} url
 * @returns {Promise<any>}
 */
async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 取得文章 ID 列表：优先 fixture，其次后端。
 * @returns {Promise<{ids:Array, source:string}>}
 */
async function getArticleIds() {
  if (FIXTURE_PATH) {
    try {
      const data = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'))
      const ids = Array.isArray(data.articleIds)
        ? data.articleIds
        : extractIds(data.articleList ?? data.articles ?? data)
      return { ids, source: `fixture:${FIXTURE_PATH}` }
    } catch (e) {
      console.warn(`[sitemap] 读取 fixture ${FIXTURE_PATH} 失败：${e.message}`)
    }
  }
  try {
    const payload = await fetchJson(`${API_BASE}/api/article/list?page=1&size=1000`)
    return { ids: extractIds(payload), source: 'backend /api/article/list' }
  } catch (e) {
    console.warn(`[sitemap] 获取文章列表失败：${e.message}`)
    return { ids: [], source: 'backend-unreachable' }
  }
}

/**
 * 取得项目 ID 列表：优先 fixture，其次后端。
 * @returns {Promise<{ids:Array, source:string}>}
 */
async function getProjectIds() {
  if (FIXTURE_PATH) {
    try {
      const data = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'))
      const ids = Array.isArray(data.projectIds)
        ? data.projectIds
        : extractIds(data.projectList ?? data.projects ?? data)
      return { ids, source: `fixture:${FIXTURE_PATH}` }
    } catch (e) {
      console.warn(`[sitemap] 读取 fixture ${FIXTURE_PATH} 失败：${e.message}`)
    }
  }
  try {
    const payload = await fetchJson(`${API_BASE}/api/project/list?page=1&size=1000`)
    return { ids: extractIds(payload), source: 'backend /api/project/list' }
  } catch (e) {
    console.warn(`[sitemap] 获取项目列表失败：${e.message}`)
    return { ids: [], source: 'backend-unreachable' }
  }
}

/**
 * 拼接绝对 loc。
 * @param {string} route
 * @returns {string}
 */
function buildLoc(route) {
  return SITE_ORIGIN + (route.startsWith('/') ? route : '/' + route)
}

async function run() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`[sitemap] dist 目录不存在（${DIST_DIR}）。请先执行构建（npm run build:clean）。`)
    process.exit(1)
  }

  const [articles, projects] = await Promise.all([getArticleIds(), getProjectIds()])

  const urls = []
  for (const r of STATIC_ROUTES) urls.push(buildLoc(r))
  for (const id of articles.ids) urls.push(buildLoc(`/article/${id}`))
  for (const id of projects.ids) urls.push(buildLoc(`/project/${id}`))

  const hasDynamic = articles.ids.length > 0 || projects.ids.length > 0
  const comments = []
  if (!hasDynamic) {
    comments.push('后端不可达或返回空数据：以下仅含静态路由。')
    comments.push('文章/项目动态 URL 需在真机（后端可达）执行 npm run build:full 补全。')
  }
  if (FIXTURE_PATH) comments.push(`使用本地 fixture 生成（${FIXTURE_PATH}）。`)

  const commentBlock = comments.length ? '  <!-- ' + comments.join(' ') + ' -->\n' : ''

  const urlEntries = urls
    .map((loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`)
    .join('\n')

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    commentBlock +
    urlEntries +
    `\n</urlset>\n`

  const outPath = path.join(DIST_DIR, 'sitemap.xml')
  fs.writeFileSync(outPath, xml, 'utf8')

  console.log(
    `[sitemap] 已生成 ${outPath}\n` +
      `          静态路由 ${STATIC_ROUTES.length} 条，` +
      `文章 ${articles.ids.length} 条（来源：${articles.source}），` +
      `项目 ${projects.ids.length} 条（来源：${projects.source}）`
  )

  if (!hasDynamic) {
    console.warn(
      '[sitemap] ⚠️ PARTIAL：未包含文章/项目动态 URL。' +
        '上线前请在后端可达的机器执行 `npm run build:full` 重新生成。'
    )
  }
  process.exit(0)
}

run().catch((err) => {
  console.error('[sitemap] 生成失败：', err)
  process.exit(1)
})
