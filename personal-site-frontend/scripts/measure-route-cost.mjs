#!/usr/bin/env node
/**
 * measure-route-cost.mjs —— 统计「打开某个页面实际要下载多少字节」
 * ---------------------------------------------------------------------------
 *
 * 【为什么需要它】
 * `vite build` 打印的是「每个 chunk 各自多大」，看不出「一个页面要下载几个 chunk」。
 * 只看入口 chunk 体积极易得出错误结论 —— 本次优化中就出现过：
 * 入口 chunk 仅 17 KiB 看似达标，但 index.html 通过 modulepreload 额外拉取了
 * 一个 928 KiB 的 vendor-element，真实首屏其实是 1058 KiB。
 *
 * 本脚本沿着 chunk 之间的「静态 import 依赖图」做闭包展开，
 * 算出打开一个路由真正需要的 JS + CSS 总字节，这才是可用于验收的数字。
 *
 * 用法：
 *   node scripts/measure-route-cost.mjs [outDir]
 *   node scripts/measure-route-cost.mjs dist
 * ---------------------------------------------------------------------------
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', process.argv[2] || 'dist')
const ASSETS_DIR = path.join(OUT_DIR, 'assets')

/**
 * 读取文件字节数，文件不存在返回 0。
 *
 * @param {string} file 绝对路径
 * @returns {number} 字节数
 */
function sizeOf(file) {
  try {
    return fs.statSync(file).size
  } catch {
    return 0
  }
}

/**
 * 从一个 JS chunk 中解析出它「静态 import」的其它 chunk 文件名。
 *
 * 只匹配 `from "./xxx.js"` / `import "./xxx.js"` 形式的静态导入，
 * 刻意忽略 `import("./xxx.js")` 动态导入 —— 动态导入是懒加载，
 * 不属于当前页面的首屏成本。
 *
 * @param {string} file chunk 绝对路径
 * @returns {string[]} 依赖的 chunk 文件名（不含目录）
 */
function staticImportsOf(file) {
  let code = ''
  try {
    code = fs.readFileSync(file, 'utf8')
  } catch {
    return []
  }

  const deps = new Set()
  // 静态 import：import ... from "./x.js" / import "./x.js" / export ... from "./x.js"
  const staticRe = /(?:^|[;\s}])(?:import|export)\s*(?:[\w*{},\s$]*?\s*from\s*)?["'](\.\/[^"']+\.js)["']/g
  let m
  while ((m = staticRe.exec(code)) !== null) {
    deps.add(path.basename(m[1]))
  }
  return [...deps]
}

/**
 * 从 index.html 中提取入口 JS、modulepreload 的 JS 与首屏 CSS。
 *
 * @returns {{entryJs: string[], preloadJs: string[], css: string[]}}
 */
function parseIndexHtml() {
  const html = fs.readFileSync(path.join(OUT_DIR, 'index.html'), 'utf8')
  const entryJs = [...html.matchAll(/<script[^>]+src="\/assets\/([^"]+\.js)"/g)].map((x) => x[1])
  const preloadJs = [...html.matchAll(/rel="modulepreload"[^>]+href="\/assets\/([^"]+\.js)"/g)].map((x) => x[1])
  const css = [...html.matchAll(/rel="stylesheet"[^>]+href="\/assets\/([^"]+\.css)"/g)].map((x) => x[1])
  return { entryJs, preloadJs, css }
}

/**
 * 对一组起始 chunk 做静态依赖闭包展开。
 *
 * @param {string[]} seeds 起始 chunk 文件名
 * @returns {Set<string>} 闭包内全部 chunk 文件名
 */
function closure(seeds) {
  const seen = new Set()
  const queue = [...seeds]
  while (queue.length) {
    const name = queue.pop()
    if (!name || seen.has(name)) continue
    seen.add(name)
    for (const dep of staticImportsOf(path.join(ASSETS_DIR, name))) {
      if (!seen.has(dep)) queue.push(dep)
    }
  }
  return seen
}

/**
 * 找出某个路由页面对应的全部候选 chunk 文件（按文件名前缀匹配）。
 *
 * 【注意：前缀会撞名】前台 src/views/Articles.vue 与后台 src/views/admin/Articles.vue
 * 都会产出 `Articles-<hash>.js`，Projects / ArticleDetail 等同理。
 * 早期版本只取 readdir 的第一个匹配项，而 readdir 的顺序会随 hash 变化，
 * 导致同一份代码两次构建量出不同的数字（实测 /articles 曾在 523.5 与 446.6 KiB
 * 之间跳变，实为一次量到了后台页、一次量到了前台页）。
 * 因此这里返回全部候选并在上层显式标注，绝不静默挑一个。
 *
 * @param {string} prefix 组件名前缀，如 'Home'
 * @returns {string[]} 全部匹配的 chunk 文件名，按体积降序
 */
function findChunks(prefix) {
  const re = new RegExp(`^${prefix}-[A-Za-z0-9_-]+\\.js$`)
  return fs
    .readdirSync(ASSETS_DIR)
    .filter((f) => f.endsWith('.js') && re.test(f))
    .sort((a, b) => sizeOf(path.join(ASSETS_DIR, b)) - sizeOf(path.join(ASSETS_DIR, a)))
}

/**
 * 格式化字节为 KiB 字符串。
 *
 * @param {number} bytes 字节数
 * @returns {string}
 */
function kib(bytes) {
  return (bytes / 1024).toFixed(1).padStart(8) + ' KiB'
}

function main() {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error(`[measure] 未找到 ${ASSETS_DIR}，请先执行构建`)
    process.exit(1)
  }

  const { entryJs, preloadJs, css } = parseIndexHtml()
  const shellSeeds = [...entryJs, ...preloadJs]
  const shellChunks = closure(shellSeeds)
  const shellJsBytes = [...shellChunks].reduce((sum, f) => sum + sizeOf(path.join(ASSETS_DIR, f)), 0)
  const shellCssBytes = css.reduce((sum, f) => sum + sizeOf(path.join(ASSETS_DIR, f)), 0)

  console.log('==========================================================')
  console.log(' 应用外壳（index.html 直接引用 + modulepreload 的闭包）')
  console.log('==========================================================')
  console.log(`  入口 JS        : ${entryJs.join(', ')}`)
  console.log(`  预加载 JS      : ${preloadJs.join(', ') || '(无)'}`)
  console.log(`  外壳 chunk 数  : ${shellChunks.size}`)
  console.log(`  外壳 JS 合计   : ${kib(shellJsBytes)}`)
  console.log(`  外壳 CSS 合计  : ${kib(shellCssBytes)}`)
  console.log('')

  const routes = [
    ['/', 'Home'],
    ['/articles', 'Articles'],
    ['/article/:id', 'ArticleDetail'],
    ['/projects', 'Projects'],
    ['/admin/article-edit', 'ArticleEdit']
  ]

  console.log('==========================================================')
  console.log(' 各路由首次打开的 JS 总成本（外壳 + 该路由静态依赖闭包）')
  console.log('==========================================================')
  for (const [routePath, prefix] of routes) {
    const chunks = findChunks(prefix)
    if (chunks.length === 0) {
      console.log(`  ${routePath.padEnd(20)} 未找到 ${prefix}-*.js`)
      continue
    }
    for (const chunk of chunks) {
      const all = closure([...shellSeeds, chunk])
      const bytes = [...all].reduce((sum, f) => sum + sizeOf(path.join(ASSETS_DIR, f)), 0)
      const extra = bytes - shellJsBytes
      const tag = chunks.length > 1 ? `  <= 前缀撞名，候选 ${chunk}` : ''
      console.log(
        `  ${routePath.padEnd(20)} ${kib(bytes)}   (外壳外新增 ${kib(extra)}, ${all.size} 个 chunk)${tag}`
      )
    }
    if (chunks.length > 1) {
      console.log(
        `  ${''.padEnd(20)} ↑ ${prefix}-*.js 有 ${chunks.length} 个同名前缀产物（前台/后台同名组件），` +
          '请按体积与依赖自行判断哪个是公开页'
      )
    }
  }
  console.log('')
}

main()
