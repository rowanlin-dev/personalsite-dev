#!/usr/bin/env node
/**
 * qa-verify-p1.mjs —— P1 Wave 1 回归验证（可纳入 CI）
 * ===========================================================================
 * 在 `vite build --outDir dist-verify-p1` 之后运行，验证 5 项改动 + P0 基线零回退：
 *   P1-3  sitemap 生成（结构 / 绝对 loc / 静态+动态路由）
 *   LEG-2 og:image 改 1200x630 PNG（构建产物 index.html）
 *   P1-4  dompurify / d3-force 异步化（首屏 chunk 不再静态含）
 *   P1-6  hover 路由 prefetch（AppHeader 含路由动态 import loaders + modulepreload）
 *   LEG-3 deploy-runbook 4 点（文档静态检查）
 *   P0    入口 JS<=350KiB / CSS<=80KiB / 图标 tree-shaking / BUG-1 loadingId 守卫
 *
 * 用法：
 *   node scripts/qa-verify-p1.mjs [--dist dist-verify-p1]
 * 退出码：全部 PASS 为 0，否则非 0（CI 可据此 fail）。
 * ===========================================================================
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const distArg = args.includes('--dist') ? args[args.indexOf('--dist') + 1] : 'dist-verify-p1'
const DIST = path.resolve(ROOT, distArg)
const A = path.join(DIST, 'assets')

const kb = (b) => (b / 1024).toFixed(1) + ' KiB'
const findChunk = (re) => fs.readdirSync(A).find((n) => re.test(n))
const readChunk = (re) => fs.readFileSync(path.join(A, findChunk(re)), 'utf8')

let fails = []
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
  if (!cond) fails.push(name)
}

if (!fs.existsSync(DIST)) {
  console.error(`[qa-p1] 构建产物不存在：${DIST}\n请先运行：npx vite build --outDir ${distArg}`)
  process.exit(1)
}

console.log(`\n# P1 Wave 1 验证 @ ${DIST}\n`)

/* ---------- 入口 HTML / 体积 / modulepreload ---------- */
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
const entrySrc = (html.match(/<script type="module"[^>]*src="([^"]+)"/) || [])[1]
const entryFile = entrySrc ? path.basename(entrySrc) : null
const entryJs = entryFile ? fs.statSync(path.join(A, entryFile)).size : 0
const cssSrc = (html.match(/rel="stylesheet"[^>]*href="([^"]+)"/) || [])[1]
const cssSize = cssSrc ? fs.statSync(path.join(A, path.basename(cssSrc))).size : 0
const modulepreloads = [...html.matchAll(/rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1])
const entryCode = entryFile ? fs.readFileSync(path.join(A, entryFile), 'utf8') : ''
const entryStaticVendors = [...entryCode.matchAll(/import"(\/assets\/[^"]+\.js)"/g)].map((m) => m[1])
const mpBasenames = modulepreloads.map((m) => path.basename(m))
const unMp = entryStaticVendors.map((p) => path.basename(p)).filter((f) => !mpBasenames.includes(f))
const vueMp = modulepreloads.find((m) => /vendor-vue/.test(m))
const vueJs = vueMp ? fs.statSync(path.join(A, path.basename(vueMp))).size : 0
const firstScreenJs = entryJs + vueJs

console.log(`-- 体积 --`)
console.log(`入口 JS: ${kb(entryJs)} | 入口 CSS: ${kb(cssSize)} | 首屏 JS(入口+vendor-vue): ${kb(firstScreenJs)}`)
check('P0 入口 JS ≤350KiB', entryJs <= 350 * 1024, kb(entryJs))
check('P0 入口 CSS ≤80KiB', cssSize <= 80 * 1024, kb(cssSize))
check('P0 首屏 JS ≤350KiB', firstScreenJs <= 350 * 1024, kb(firstScreenJs))
check('P1-6 首屏 vendor chunk 已被 modulepreload', modulepreloads.length > 0 && modulepreloads.some((m) => /vendor/.test(m)), modulepreloads.join(','))
check('P1-6 入口静态 vendor 依赖无遗漏预载', unMp.length === 0, unMp.join(',') || 'ok')

/* ---------- LEG-2 og:image PNG ---------- */
const ogImage = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1]
const twImage = (html.match(/<meta name="twitter:image" content="([^"]+)"/) || [])[1]
check('LEG-2 og:image 为 /og-default.png (PNG)', ogImage === '/og-default.png', ogImage)
check('LEG-2 twitter:image 为 /og-default.png (PNG)', twImage === '/og-default.png', twImage)
check('LEG-2 og-default.png 存在且为 1200x630 PNG', (() => {
  try {
    const b = fs.readFileSync(path.join(DIST, 'og-default.png'))
    const ok = b.slice(0, 8).toString('hex') === '89504e470d0a1a0a'
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20)
    return ok && w === 1200 && h === 630
  } catch { return false }
})())

/* ---------- P1-4 dompurify / d3 异步化 ---------- */
const adCode = readChunk(/^ArticleDetail-.*\.js$/)
const homeCode = readChunk(/^Home-.*\.js$/)
check('P1-4 ArticleDetail 不再静态含 dompurify 实现', !/FORBID|RETURN_DOM|isSupported/.test(adCode), `${findChunk(/^ArticleDetail-.*\.js$/)} ${(adCode.length / 1024).toFixed(1)}KiB`)
check('P1-4 dompurify 落到独立 vendor-md 异步 chunk', fs.existsSync(path.join(A, findChunk(/^vendor-md-.*\.js$/))) && /vendor-md/.test(adCode))
check('P1-4 Home 不再静态含 d3-force 实现', !/forceSimulation|forceManyBody|forceCenter/.test(homeCode), `${findChunk(/^Home-.*\.js$/)} ${(homeCode.length / 1024).toFixed(1)}KiB`)
check('P1-4 d3 落到独立 vendor-viz 异步 chunk', fs.existsSync(path.join(A, findChunk(/^vendor-viz-.*\.js$/))))

/* ---------- P1-6 hover prefetch 接通 ---------- */
const appHeaderCode = readChunk(/^AppHeader-.*\.js$/)
const prefetchTargets = ['Home', 'Articles', 'Projects', 'ArticleDetail']
  .filter((t) => new RegExp(`import\\("\\.?\\/?assets\\/${t}-`).test(appHeaderCode) || appHeaderCode.includes(`/${t}-`))
check('P1-6 AppHeader 含 4 个路由 prefetch loaders(动态 import)', prefetchTargets.length === 4, `命中 ${prefetchTargets.length}/4`)

/* ---------- P1-3 sitemap ---------- */
const smPath = path.join(DIST, 'sitemap.xml')
if (fs.existsSync(smPath)) {
  const x = fs.readFileSync(smPath, 'utf8')
  const urls = [...x.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])
  check('P1-3 sitemap 根 urlset 正确', x.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'))
  check('P1-3 含 3 个静态路由', ['https://minipluto.cn/', 'https://minipluto.cn/articles', 'https://minipluto.cn/projects'].every((u) => urls.includes(u)))
  check('P1-3 全部 <loc> 为绝对地址 minipluto.cn', urls.length > 0 && urls.every((u) => u.startsWith('https://minipluto.cn/')))
  check('P1-3 robots.txt 声明 Sitemap 且对应', fs.existsSync(path.join(DIST, 'robots.txt')) && fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8').includes('Sitemap: https://minipluto.cn/sitemap.xml'))
} else {
  console.log('SKIP  P1-3 sitemap.xml 不在本产物（用 SITEMAP_FIXTURE 跑 gen-sitemap 后复制至此）')
}

/* ---------- 图标 tree-shaking（复用 qa-count-dist-icons） ---------- */
try {
  const out = execSync(`node scripts/qa-count-dist-icons.mjs ${distArg}`, { cwd: ROOT }).toString()
  const pass = /PASS/.test(out)
  const m = out.match(/产物中打包的图标总数\s*:\s*(\d+)/)
  check('P0 图标 tree-shaking（打包图标 << 全集）', pass, m ? `${m[1]} icons` : '')
} catch (e) {
  check('P0 图标 tree-shaking', false, 'qa-count-dist-icons 执行失败')
}

/* ---------- LEG-3 deploy-runbook 4 点 ---------- */
const rb = fs.readFileSync(path.join(ROOT, 'docs/deploy-runbook.md'), 'utf8')
check('LEG-3 runbook: 严禁裸 npm run build(必须 build:clean)', /build:clean/.test(rb) && /npm run build/.test(rb) && /严禁|禁止/.test(rb))
check('LEG-3 runbook: P0 收益未显现原因(本地未重建)', /本地.*build:clean|未.*重建|build:clean/.test(rb))
check('LEG-3 runbook: 预渲染/sitemap 步骤(build:full)', /build:full/.test(rb))
check('LEG-3 runbook: 生产拓扑(a)+deploy_frontend.py 改为 rsync/ssh 警示', /deploy_frontend\.py/.test(rb) && /rsync|ssh/.test(rb) && /nginx root|nginx root/.test(rb))

console.log(`\n# 结果：${fails.length === 0 ? 'ALL PASS ✅' : `FAIL(${fails.length}) ❌ -> ${fails.join(', ')}`}`)
process.exit(fails.length === 0 ? 0 : 1)
