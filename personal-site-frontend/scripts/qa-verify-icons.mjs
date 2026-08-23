/**
 * qa-verify-icons.mjs —— QA 独立图标白名单核验脚本
 * ===========================================================================
 * 目的：独立于 scripts/scan-element-usage.mjs 重新实现一次扫描，
 *       交叉验证 src/plugins/element-icons.js 白名单是否完整。
 *       若两套独立实现结论一致，可显著降低「漏一个图标静默变空标签」的风险。
 *
 * 判定口径：
 *   - 从 @element-plus/icons-vue 的真实导出列表取全集（而非硬编码）
 *   - 扫描 src/ 下所有 .vue/.js 文件的模板与脚本
 *   - 任何「疑似图标使用」若不在白名单内 → 报错退出码 1
 *
 * 用法：node scripts/qa-verify-icons.mjs
 * ===========================================================================
 */

import fs from 'node:fs'
import path from 'node:path'
import url, { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

/* -------------------------------------------------------------------------- */
/* 1. 取图标库全集（从 node_modules 真实导出读取，不硬编码）                     */
/* -------------------------------------------------------------------------- */

const iconsPkgDir = path.join(ROOT, 'node_modules', '@element-plus', 'icons-vue')
const allIcons = new Set()

// icons-vue 2.x 是打包后的单文件产物（dist/index.js），没有 es/components 目录，
// 因此最权威的做法是直接 import 该 ESM 入口读取真实导出名，而不是猜目录结构。
try {
  const entry = path.join(iconsPkgDir, 'dist', 'index.js')
  const mod = await import(url.pathToFileURL(entry).href)
  for (const name of Object.keys(mod)) {
    if (/^[A-Z]\w*$/.test(name)) allIcons.add(name)
  }
} catch (err) {
  console.error('[qa] 动态 import 图标库失败，回退解析类型声明：', err.message)
}

// 兜底：解析类型声明文件
if (!allIcons.size) {
  try {
    const dts = path.join(iconsPkgDir, 'dist', 'types', 'index.d.ts')
    if (fs.existsSync(dts)) {
      const text = fs.readFileSync(dts, 'utf8')
      for (const m of text.matchAll(/export\s+\{?\s*default\s+as\s+(\w+)/g)) allIcons.add(m[1])
      for (const m of text.matchAll(/declare\s+const\s+(\w+)/g)) allIcons.add(m[1])
    }
  } catch (err) {
    console.error('[qa] 读取图标库全集失败：', err.message)
  }
}

// 全集读取失败时必须让脚本失败，而不是「放宽为不校验」——
// 否则会像首轮那样产生 AppHeader / RouterView 这类非图标误报，
// 使 QA 结论不可信。
if (!allIcons.size) {
  console.error('[qa] 致命：无法获得图标库全集，核验结论不可信，主动失败。')
  process.exit(2)
}

/* -------------------------------------------------------------------------- */
/* 2. 读取白名单                                                                */
/* -------------------------------------------------------------------------- */

const whitelistFile = path.join(SRC, 'plugins', 'element-icons.js')
const whitelistText = fs.readFileSync(whitelistFile, 'utf8')
const frozenBlock = whitelistText.match(/Object\.freeze\(\{([\s\S]*?)\}\)/)
const whitelist = new Set(
  (frozenBlock ? frozenBlock[1] : '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => /^[A-Z]\w*$/.test(s))
)

/* -------------------------------------------------------------------------- */
/* 3. 遍历 src/ 收集使用点                                                      */
/* -------------------------------------------------------------------------- */

/** @type {string[]} */
const files = []
;(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(vue|js|ts)$/.test(entry.name)) files.push(full)
  }
})(SRC)

/** 图标名 -> 使用点列表 */
const used = new Map()
const record = (name, file, how) => {
  if (!name) return
  const pascal = name.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())
  // 只统计「确实是图标库导出」的名字，排除 AppHeader / RouterView / ElButton 等业务或框架组件
  if (allIcons.has(pascal)) {
    if (!used.has(pascal)) used.set(pascal, [])
    used.get(pascal).push(`${path.relative(ROOT, file)} (${how})`)
  }
}

for (const file of files) {
  // 白名单文件自身不算使用点
  if (file === whitelistFile) continue
  const text = fs.readFileSync(file, 'utf8')

  // a) 模板自闭合标签 <View /> / <arrow-down />
  for (const m of text.matchAll(/<([A-Z][A-Za-z0-9]*|[a-z]+(?:-[a-z0-9]+)+)\s*\/>/g)) {
    record(m[1], file, '模板自闭合标签')
  }
  // b) 模板成对标签 <View></View>
  for (const m of text.matchAll(/<([A-Z][A-Za-z0-9]*|[a-z]+(?:-[a-z0-9]+)+)(\s[^>]*)?>\s*<\/\1>/g)) {
    record(m[1], file, '模板成对标签')
  }
  // c) 具名导入 import { Search } from '@element-plus/icons-vue'
  for (const m of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]@element-plus\/icons-vue['"]/g)) {
    for (const n of m[1].split(',')) record(n.trim().split(/\s+as\s+/)[0], file, '具名导入')
  }
  // d) :icon="Pointer" / icon="Search"
  for (const m of text.matchAll(/:?icon\s*=\s*["']([A-Za-z][\w-]*)["']/g)) {
    record(m[1], file, 'icon 属性绑定')
  }
  // e) <component :is="'Setting'" /> 与 JS 字面量 icon: 'Odometer'
  for (const m of text.matchAll(/:is\s*=\s*["']\s*'?([A-Z]\w*)'?\s*["']/g)) {
    record(m[1], file, '动态组件 is')
  }
  for (const m of text.matchAll(/\bicon\s*:\s*['"]([A-Za-z][\w-]*)['"]/g)) {
    record(m[1], file, 'JS 字面量 icon')
  }
}

/* -------------------------------------------------------------------------- */
/* 4. 比对输出                                                                  */
/* -------------------------------------------------------------------------- */

const usedNames = [...used.keys()].sort()
const missing = usedNames.filter((n) => !whitelist.has(n))
const unusedInWhitelist = [...whitelist].filter((n) => !used.has(n)).sort()

console.log('图标库全集数量 :', allIcons.size || '(读取失败，已放宽为不校验全集)')
console.log('白名单数量     :', whitelist.size, '->', [...whitelist].sort().join(', '))
console.log('扫描到使用数量 :', usedNames.length, '->', usedNames.join(', '))
console.log('')

if (missing.length) {
  console.log('!! 缺失（模板在用但未注册，生产环境会静默渲染成空标签）:')
  for (const n of missing) {
    console.log(`   - ${n}`)
    for (const at of used.get(n)) console.log(`       ${at}`)
  }
} else {
  console.log('OK 无缺失图标：所有扫描到的使用点均已在白名单内')
}

if (unusedInWhitelist.length) {
  console.log('')
  console.log('-- 白名单中未扫描到使用点（多注册，仅浪费极小体积，非阻断）:')
  for (const n of unusedInWhitelist) console.log(`   - ${n}`)
}

process.exit(missing.length ? 1 : 0)
