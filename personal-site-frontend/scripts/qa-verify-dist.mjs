/**
 * qa-verify-dist.mjs —— 构建产物验收脚本
 * ===========================================================================
 * 校验项：
 *   1. 入口 JS <= 350 KiB、入口 CSS <= 80 KiB（首屏预算）
 *   2. index.html 无 __COS_DOMAIN__ / __SITE_ORIGIN__ 占位符残留
 *   3. robots.txt / favicon.svg 已产出到产物根目录
 *   4. 无全量 element-plus CSS 残留（以「入口 CSS 是否包含大量 el-* 组件类」判定）
 *   5. 首屏关键样式（el-message / el-message-box / el-loading）确实落在入口 CSS
 *   6. 显式 import 的渲染型组件（ElCheckbox）样式是否存在于产物
 *
 * 用法：node scripts/qa-verify-dist.mjs [产物目录，默认 dist-verify-qa]
 * ===========================================================================
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, process.argv[2] || 'dist-verify-qa')

const KIB = 1024
const LIMIT_ENTRY_JS = 350 * KIB
const LIMIT_ENTRY_CSS = 80 * KIB

let failures = 0
let warnings = 0

const ok = (label, extra = '') => console.log(`  PASS  ${label}${extra ? '  ' + extra : ''}`)
const bad = (label, extra = '') => { failures += 1; console.log(`  FAIL  ${label}${extra ? '  ' + extra : ''}`) }
const warn = (label, extra = '') => { warnings += 1; console.log(`  WARN  ${label}${extra ? '  ' + extra : ''}`) }

if (!fs.existsSync(DIST)) {
  console.error(`产物目录不存在: ${DIST}`)
  process.exit(2)
}

console.log(`=== 构建产物验收: ${path.relative(ROOT, DIST)} ===\n`)

/* -------------------------------------------------------------------------- */
/* 解析 index.html，定位入口 JS / CSS                                           */
/* -------------------------------------------------------------------------- */

const htmlPath = path.join(DIST, 'index.html')
if (!fs.existsSync(htmlPath)) {
  console.error('index.html 缺失')
  process.exit(2)
}
const html = fs.readFileSync(htmlPath, 'utf8')

const entryJsHref = (html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/) || [])[1]
const entryCssHrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1])
const modulepreloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1])

const sizeOf = (href) => {
  const p = path.join(DIST, href.replace(/^\//, ''))
  return fs.existsSync(p) ? fs.statSync(p).size : 0
}

console.log('[1] 首屏体积预算')
const entryJsSize = entryJsHref ? sizeOf(entryJsHref) : 0
const preloadSize = modulepreloads.reduce((sum, h) => sum + sizeOf(h), 0)
const totalFirstScreenJs = entryJsSize + preloadSize
const entryCssSize = entryCssHrefs.reduce((sum, h) => sum + sizeOf(h), 0)

console.log(`      入口 JS            : ${entryJsHref || '(未找到)'} = ${entryJsSize} B`)
console.log(`      modulepreload 合计 : ${modulepreloads.length} 个 = ${preloadSize} B`)
console.log(`      首屏 JS 总计       : ${totalFirstScreenJs} B (${(totalFirstScreenJs / KIB).toFixed(1)} KiB)`)
console.log(`      入口 CSS           : ${entryCssHrefs.join(', ') || '(未找到)'} = ${entryCssSize} B (${(entryCssSize / KIB).toFixed(1)} KiB)`)

if (entryJsSize && entryJsSize <= LIMIT_ENTRY_JS) ok(`入口 JS <= 350 KiB`, `(${(entryJsSize / KIB).toFixed(1)} KiB)`)
else bad(`入口 JS 超出 350 KiB`, `(${(entryJsSize / KIB).toFixed(1)} KiB)`)

if (totalFirstScreenJs <= LIMIT_ENTRY_JS) ok(`首屏 JS 总计（入口+modulepreload） <= 350 KiB`, `(${(totalFirstScreenJs / KIB).toFixed(1)} KiB)`)
else bad(`首屏 JS 总计超出 350 KiB`, `(${(totalFirstScreenJs / KIB).toFixed(1)} KiB) —— 注意 modulepreload 是首屏必下载资源`)

if (entryCssSize && entryCssSize <= LIMIT_ENTRY_CSS) ok(`入口 CSS <= 80 KiB`, `(${(entryCssSize / KIB).toFixed(1)} KiB)`)
else bad(`入口 CSS 超出 80 KiB`, `(${(entryCssSize / KIB).toFixed(1)} KiB)`)

/* -------------------------------------------------------------------------- */

console.log('\n[2] index.html 占位符替换')
for (const token of ['__COS_DOMAIN__', '__SITE_ORIGIN__']) {
  if (html.includes(token)) bad(`占位符未替换: ${token}`)
  else ok(`占位符已替换: ${token}`)
}
const canonical = (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/) || [])[1]
const preconnect = (html.match(/<link[^>]+rel="preconnect"[^>]+href="([^"]+)"/) || [])[1]
console.log(`      canonical  = ${canonical}`)
console.log(`      preconnect = ${preconnect}`)
if (canonical && /^https:\/\/[^_]+/.test(canonical)) ok('canonical 为合法绝对地址')
else bad('canonical 非法', String(canonical))

/* -------------------------------------------------------------------------- */

console.log('\n[3] public 静态资源产出到根目录')
for (const f of ['robots.txt', 'favicon.svg']) {
  const p = path.join(DIST, f)
  if (fs.existsSync(p)) ok(`${f} 已产出`, `(${fs.statSync(p).size} B)`)
  else bad(`${f} 缺失`)
}
// robots.txt 声明的 sitemap 是否真实存在
const robotsPath = path.join(DIST, 'robots.txt')
if (fs.existsSync(robotsPath)) {
  const robots = fs.readFileSync(robotsPath, 'utf8')
  const sitemap = (robots.match(/^\s*Sitemap:\s*(\S+)/mi) || [])[1]
  if (sitemap) {
    const name = sitemap.split('/').pop()
    if (fs.existsSync(path.join(DIST, name))) ok(`robots 声明的 ${name} 存在`)
    else warn(`robots.txt 声明了 Sitemap: ${sitemap}，但产物中无 ${name}（抓取会 404）`)
  }
}

/* -------------------------------------------------------------------------- */

console.log('\n[4] element-plus 全量 CSS 残留检查')
const cssFiles = fs
  .readdirSync(path.join(DIST, 'assets'))
  .filter((f) => f.endsWith('.css'))
  .map((f) => ({ name: f, full: path.join(DIST, 'assets', f) }))

const entryCssNames = entryCssHrefs.map((h) => h.split('/').pop())
let entryCssText = ''
for (const f of cssFiles) if (entryCssNames.includes(f.name)) entryCssText += fs.readFileSync(f.full, 'utf8')

// 后台独占的重型组件类名不应出现在入口 CSS 中
const adminOnlySelectors = ['.el-table', '.el-tree', '.el-date-picker', '.el-upload', '.el-select-dropdown', '.el-form-item']
const leaked = adminOnlySelectors.filter((s) => entryCssText.includes(s))
if (leaked.length) bad(`入口 CSS 混入后台独占组件样式: ${leaked.join(', ')}`)
else ok('入口 CSS 未混入后台独占组件样式（el-table/el-tree/el-upload/el-date-picker 等）')

console.log('\n[5] 首屏必需的函数式组件样式是否在入口 CSS')
for (const [label, sel] of [['ElMessage', '.el-message'], ['ElMessageBox', '.el-message-box'], ['v-loading', '.el-loading'], ['base 变量', '--el-color-primary']]) {
  if (entryCssText.includes(sel)) ok(`${label} 样式在入口 CSS (${sel})`)
  else bad(`${label} 样式缺失于入口 CSS (${sel})`)
}

console.log('\n[6] 显式 import 的渲染型组件样式（ElCheckbox，见 admin/AssetLibrary.vue）')
const allCssText = cssFiles.map((f) => fs.readFileSync(f.full, 'utf8')).join('\n')
if (allCssText.includes('.el-checkbox')) ok('产物中存在 .el-checkbox 样式')
else bad('产物中不存在 .el-checkbox 样式 —— AssetLibrary 的 h(ElCheckbox) 会无样式渲染')

/* -------------------------------------------------------------------------- */

console.log(`\n=== 结论: 失败 ${failures}，警告 ${warnings} ===`)
process.exit(failures ? 1 : 0)
