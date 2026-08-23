/**
 * qa-compare-builds.mjs —— 修复前后构建产物对比（体积回退守门）
 * ===========================================================================
 * 用途：BUG-1 修复只改了 src/views/ArticleDetail.vue 的组件内部逻辑，
 *       理论上不应影响入口 JS/CSS 与各 vendor 分包。本脚本做量化确认，
 *       防止「修 Bug 顺手把体积搞回退」。
 *
 * 用法：node scripts/qa-compare-builds.mjs <修复前目录> <修复后目录>
 *       例：node scripts/qa-compare-builds.mjs dist-verify-qa dist-verify3
 * ===========================================================================
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const before = path.join(ROOT, process.argv[2] || 'dist-verify-qa')
const after = path.join(ROOT, process.argv[3] || 'dist-verify3')

/**
 * 汇总一个产物目录的关键指标。
 * @param {string} dist 产物目录绝对路径
 * @returns {{entryJs:number, entryCss:number, preload:number, total:number, chunks:Map<string,number>}}
 */
function summarize(dist) {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
  const sizeOf = (href) => {
    const p = path.join(dist, href.replace(/^\//, ''))
    return fs.existsSync(p) ? fs.statSync(p).size : 0
  }
  const entryJs = sizeOf((html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/) || [])[1] || '')
  const entryCss = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .reduce((s, m) => s + sizeOf(m[1]), 0)
  const preload = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]*href="([^"]+)"/g)]
    .reduce((s, m) => s + sizeOf(m[1]), 0)

  // 按「去掉 hash 的逻辑名」归并，便于跨构建对比
  const chunks = new Map()
  for (const f of fs.readdirSync(path.join(dist, 'assets'))) {
    const logical = f.replace(/-[A-Za-z0-9_-]{8}\.(js|css)$/, '.$1')
    const size = fs.statSync(path.join(dist, 'assets', f)).size
    chunks.set(logical, (chunks.get(logical) || 0) + size)
  }
  return { entryJs, entryCss, preload, total: entryJs + preload, chunks }
}

const a = summarize(before)
const b = summarize(after)

const fmt = (n) => `${n} B (${(n / 1024).toFixed(1)} KiB)`
const delta = (x, y) => {
  const d = y - x
  return d === 0 ? '持平' : (d > 0 ? `+${d} B` : `${d} B`)
}

console.log(`=== 产物对比: ${path.basename(before)} (修复前) -> ${path.basename(after)} (修复后) ===\n`)
console.log(`入口 JS        : ${fmt(a.entryJs)}  ->  ${fmt(b.entryJs)}   [${delta(a.entryJs, b.entryJs)}]`)
console.log(`入口 CSS       : ${fmt(a.entryCss)}  ->  ${fmt(b.entryCss)}   [${delta(a.entryCss, b.entryCss)}]`)
console.log(`modulepreload  : ${fmt(a.preload)}  ->  ${fmt(b.preload)}   [${delta(a.preload, b.preload)}]`)
console.log(`首屏 JS 总计   : ${fmt(a.total)}  ->  ${fmt(b.total)}   [${delta(a.total, b.total)}]`)

console.log('\n--- 发生变化的 chunk（按逻辑名归并，已忽略 hash 变化）---')
const names = new Set([...a.chunks.keys(), ...b.chunks.keys()])
let changed = 0
for (const n of [...names].sort()) {
  const x = a.chunks.get(n) || 0
  const y = b.chunks.get(n) || 0
  if (x !== y) {
    changed += 1
    console.log(`  ${n}: ${x} -> ${y}  [${delta(x, y)}]`)
  }
}
if (!changed) console.log('  （无任何 chunk 体积变化）')

let failures = 0
console.log('')
if (b.entryJs !== a.entryJs) { failures += 1; console.log(`FAIL  入口 JS 发生变化，需说明原因`) }
else console.log('PASS  入口 JS 体积零回退')
if (b.entryCss !== a.entryCss) { failures += 1; console.log(`FAIL  入口 CSS 发生变化，需说明原因`) }
else console.log('PASS  入口 CSS 体积零回退')
if (b.total > 350 * 1024) { failures += 1; console.log('FAIL  首屏 JS 总计超预算') }
else console.log('PASS  首屏 JS 总计仍在 350 KiB 预算内')

process.exit(failures ? 1 : 0)
