/**
 * qa-count-dist-icons.mjs —— 统计构建产物中实际打包的 element-plus 图标数量
 * ===========================================================================
 * 判定思路：
 *   element-plus 的图标组件在产物里保留 `name:"icon-name"`（kebab-case）字段，
 *   据此统计产物中出现了图标库 293 个图标中的哪些。
 *   若仍接近 293，说明 tree-shaking 失效（即 `import *` 残留）；
 *   预期应远小于 293（白名单 17 + element-plus 组件内部依赖若干）。
 *
 * 用法：node scripts/qa-count-dist-icons.mjs [产物目录，默认 dist-verify-qa]
 * ===========================================================================
 */

import fs from 'node:fs'
import path from 'node:path'
import url, { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, process.argv[2] || 'dist-verify-qa')

// 图标库全集（PascalCase -> kebab-case）
const entry = path.join(ROOT, 'node_modules', '@element-plus', 'icons-vue', 'dist', 'index.js')
const mod = await import(url.pathToFileURL(entry).href)
const pascalNames = Object.keys(mod).filter((n) => /^[A-Z]\w*$/.test(n))
const toKebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

const assetsDir = path.join(DIST, 'assets')
const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'))

/** kebab 名 -> 出现该图标的产物文件集合 */
const found = new Map()
const entryFileName = (() => {
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
  const m = html.match(/<script[^>]+type="module"[^>]+src="\/assets\/([^"]+)"/)
  return m ? m[1] : null
})()

for (const f of jsFiles) {
  const text = fs.readFileSync(path.join(assetsDir, f), 'utf8')
  for (const pascal of pascalNames) {
    const kebab = toKebab(pascal)
    // 产物中图标组件形如  name:"arrow-down"
    if (text.includes(`name:"${kebab}"`) || text.includes(`name:'${kebab}'`)) {
      if (!found.has(pascal)) found.set(pascal, new Set())
      found.get(pascal).add(f)
    }
  }
}

const all = [...found.keys()].sort()
const inEntry = all.filter((n) => entryFileName && found.get(n).has(entryFileName))

console.log(`图标库全集              : ${pascalNames.length}`)
console.log(`产物中打包的图标总数    : ${all.length}`)
console.log(`其中落在入口 chunk 的   : ${inEntry.length}  (${entryFileName})`)
console.log('')
console.log('入口 chunk 内的图标:')
console.log('  ' + (inEntry.join(', ') || '(无)'))
console.log('')
console.log('全部打包图标:')
console.log('  ' + all.join(', '))

// 判定：远小于 293 即视为 tree-shaking 生效
const PASS_THRESHOLD = 120
console.log('')
if (all.length >= 250) {
  console.log(`FAIL  打包图标数 ${all.length} 接近全集 ${pascalNames.length}，tree-shaking 疑似失效`)
  process.exit(1)
} else if (all.length > PASS_THRESHOLD) {
  console.log(`WARN  打包图标数 ${all.length} 偏多（阈值 ${PASS_THRESHOLD}），建议排查`)
  process.exit(0)
} else {
  console.log(`PASS  打包图标数 ${all.length} << 全集 ${pascalNames.length}，tree-shaking 生效`)
  process.exit(0)
}
