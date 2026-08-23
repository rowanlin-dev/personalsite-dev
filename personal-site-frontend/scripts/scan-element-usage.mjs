#!/usr/bin/env node
/**
 * scan-element-usage.mjs
 * ---------------------------------------------------------------------------
 * 扫描全站源码，统计实际使用的 element-plus 组件与 @element-plus/icons-vue 图标。
 *
 * 背景：
 *   main.js 原来用 `import * as ElementPlusIconsVue` + 遍历 `app.component()` 全量注册
 *   1300+ 图标，tree-shaking 完全失效。改为「显式白名单注册」后，任何漏掉的图标都会
 *   在运行时静默渲染成空标签（Vue 仅在 dev 模式告警）。因此白名单必须由脚本扫描生成，
 *   绝不能人工枚举。
 *
 * 扫描的图标使用形态（覆盖本项目全部写法）：
 *   1. 模板标签  <View />, <view-icon/>, <ArrowDown />        —— 依赖全局注册
 *   2. kebab 标签 <arrow-down />                              —— Vue 自动 kebab->Pascal 匹配
 *   3. 显式 import { Search } from '@element-plus/icons-vue'  —— 已是按需，但也纳入白名单便于统一
 *   4. 属性绑定  :icon="Plus" / icon="Plus"                    —— ElButton/ElInput 的 icon prop
 *   5. 动态组件  <component :is="'Setting'" /> 或 is="Setting"
 *   6. JS 字面量 icon: 'Odometer'（后台菜单配置项常见）
 *
 * 用法：
 *   node scripts/scan-element-usage.mjs           # 打印报告
 *   node scripts/scan-element-usage.mjs --json    # 输出 JSON
 *
 * 输出：stdout 报告 + scripts/element-usage.report.json
 * ---------------------------------------------------------------------------
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(PROJECT_ROOT, 'src')
const ICONS_PKG_DIR = path.join(PROJECT_ROOT, 'node_modules', '@element-plus', 'icons-vue')

/** 需要扫描的文件后缀 */
const SCAN_EXTENSIONS = new Set(['.vue', '.js', '.ts', '.jsx', '.tsx'])

/* -------------------------------------------------------------------------- */
/* 1. 读取 @element-plus/icons-vue 的全部合法图标名（作为判定基准）              */
/* -------------------------------------------------------------------------- */

/**
 * 从 icons-vue 的类型声明 / ESM 入口中解析全部导出的图标组件名。
 * @returns {Set<string>} 合法图标名集合（PascalCase）
 */
function loadValidIconNames() {
  /** @type {Set<string>} */
  const names = new Set()

  const candidates = [
    path.join(ICONS_PKG_DIR, 'dist', 'types', 'components', 'index.d.ts'),
    path.join(ICONS_PKG_DIR, 'dist', 'types', 'index.d.ts'),
    path.join(ICONS_PKG_DIR, 'dist', 'index.d.ts'),
    path.join(ICONS_PKG_DIR, 'global.d.ts')
  ]

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    // export { default as AddLocation } from './add-location.vue'
    for (const m of text.matchAll(/export\s*\{\s*default\s+as\s+([A-Z][A-Za-z0-9]*)\s*\}/g)) {
      names.add(m[1])
    }
    // export declare const AddLocation: ...
    for (const m of text.matchAll(/export\s+declare\s+const\s+([A-Z][A-Za-z0-9]*)\s*:/g)) {
      names.add(m[1])
    }
  }

  // 兜底：直接读取 ESM 产物目录下的组件文件名（add-location.vue.d.ts 之类）
  if (names.size === 0) {
    const compDir = path.join(ICONS_PKG_DIR, 'dist', 'es', 'components')
    if (fs.existsSync(compDir)) {
      for (const f of fs.readdirSync(compDir)) {
        if (!f.endsWith('.vue.mjs') && !f.endsWith('.mjs')) continue
        const base = f.replace(/\.vue\.mjs$/, '').replace(/\.mjs$/, '')
        if (base === 'index') continue
        names.add(kebabToPascal(base))
      }
    }
  }

  // 最终兜底：动态 import 包本身，读取导出键名
  return names
}

/**
 * kebab-case -> PascalCase
 * @param {string} s
 * @returns {string}
 */
function kebabToPascal(s) {
  return s
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
}

/* -------------------------------------------------------------------------- */
/* 2. 遍历源码文件                                                              */
/* -------------------------------------------------------------------------- */

/**
 * 递归收集待扫描文件。
 * @param {string} dir
 * @param {string[]} acc
 * @returns {string[]}
 */
function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue
      walk(full, acc)
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      acc.push(full)
    }
  }
  return acc
}

/* -------------------------------------------------------------------------- */
/* 3. 扫描逻辑                                                                  */
/* -------------------------------------------------------------------------- */

/** element-plus 中以函数式方式调用、需要单独引入样式的服务型组件 */
const SERVICE_COMPONENTS = [
  'ElMessage',
  'ElMessageBox',
  'ElNotification',
  'ElLoading'
]

/**
 * 扫描单个文件，累加统计结果。
 * @param {string} file
 * @param {Set<string>} validIcons
 * @param {Map<string, Set<string>>} componentHits  组件名 -> 命中文件集合
 * @param {Map<string, Set<string>>} iconHits       图标名 -> 命中文件集合
 * @param {Map<string, Set<string>>} serviceHits    服务组件 -> 命中文件集合
 * @returns {void}
 */
function scanFile(file, validIcons, componentHits, iconHits, serviceHits) {
  const text = fs.readFileSync(file, 'utf8')
  const rel = path.relative(PROJECT_ROOT, file).replace(/\\/g, '/')

  /** @param {Map<string, Set<string>>} map @param {string} key */
  const hit = (map, key) => {
    if (!map.has(key)) map.set(key, new Set())
    map.get(key).add(rel)
  }

  /* --- 3.1 element-plus 组件：<el-xxx> / <ElXxx> --- */
  for (const m of text.matchAll(/<\s*(el-[a-z0-9]+(?:-[a-z0-9]+)*)[\s/>]/g)) {
    hit(componentHits, kebabToPascal(m[1]))
  }
  for (const m of text.matchAll(/<\s*(El[A-Z][A-Za-z0-9]*)[\s/>]/g)) {
    hit(componentHits, m[1])
  }

  /* --- 3.2 服务型组件：import { ElMessage } from 'element-plus' 及直接调用 --- */
  for (const name of SERVICE_COMPONENTS) {
    // 匹配 import 语句中的具名导入，或代码中的直接调用 ElMessage.error(...) / ElMessage({...})
    const re = new RegExp(`\\b${name}\\b`, 'g')
    if (re.test(text)) hit(serviceHits, name)
  }

  /* --- 3.3 图标：显式 import { A, B } from '@element-plus/icons-vue' --- */
  for (const m of text.matchAll(
    /import\s*\{([^}]+)\}\s*from\s*['"]@element-plus\/icons-vue['"]/g
  )) {
    for (const raw of m[1].split(',')) {
      // 支持 `Search as SearchIcon` 形态，取原始导出名
      const name = raw.trim().split(/\s+as\s+/)[0].trim()
      if (validIcons.has(name)) hit(iconHits, name)
    }
  }

  /* --- 3.4 图标：模板标签 <View /> / <arrow-down /> --- */
  // PascalCase 标签
  for (const m of text.matchAll(/<\s*([A-Z][A-Za-z0-9]*)\s*(?:\/?>|\s)/g)) {
    if (validIcons.has(m[1])) hit(iconHits, m[1])
  }
  // kebab-case 标签（排除 el- 前缀，已在 3.1 处理）
  for (const m of text.matchAll(/<\s*([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\s*(?:\/?>|\s)/g)) {
    if (m[1].startsWith('el-')) continue
    const pascal = kebabToPascal(m[1])
    if (validIcons.has(pascal)) hit(iconHits, pascal)
  }

  /* --- 3.5 图标：属性绑定 :icon="Plus" / icon="Plus" / :is="Setting" --- */
  for (const m of text.matchAll(/:?(?:icon|is)\s*=\s*"([^"]+)"/g)) {
    const expr = m[1].trim()
    // 直接标识符：icon="Plus" 或 :icon="Plus"
    if (validIcons.has(expr)) hit(iconHits, expr)
    // 字符串字面量：:is="'Setting'"
    for (const s of expr.matchAll(/'([A-Za-z][A-Za-z0-9-]*)'/g)) {
      const name = validIcons.has(s[1]) ? s[1] : kebabToPascal(s[1])
      if (validIcons.has(name)) hit(iconHits, name)
    }
    // 三元/对象表达式里出现的裸标识符：:icon="loading ? Loading : Check"
    for (const s of expr.matchAll(/\b([A-Z][A-Za-z0-9]*)\b/g)) {
      if (validIcons.has(s[1])) hit(iconHits, s[1])
    }
  }

  /* --- 3.6 图标：JS 对象字面量 icon: 'Odometer' / icon: Odometer（菜单配置） --- */
  for (const m of text.matchAll(/\bicon\s*:\s*['"]([A-Za-z][A-Za-z0-9-]*)['"]/g)) {
    const name = validIcons.has(m[1]) ? m[1] : kebabToPascal(m[1])
    if (validIcons.has(name)) hit(iconHits, name)
  }
  for (const m of text.matchAll(/\bicon\s*:\s*([A-Z][A-Za-z0-9]*)\b/g)) {
    if (validIcons.has(m[1])) hit(iconHits, m[1])
  }
}

/* -------------------------------------------------------------------------- */
/* 4. 主流程                                                                    */
/* -------------------------------------------------------------------------- */

async function main() {
  let validIcons = loadValidIconNames()

  // 若静态解析失败，回退到运行时 import 读取导出键
  if (validIcons.size === 0) {
    const mod = await import('@element-plus/icons-vue')
    validIcons = new Set(Object.keys(mod).filter((k) => /^[A-Z]/.test(k)))
  }

  if (validIcons.size === 0) {
    console.error('[scan] 无法解析 @element-plus/icons-vue 的图标列表，请确认依赖已安装')
    process.exit(1)
  }

  const files = walk(SRC_DIR)
  /** @type {Map<string, Set<string>>} */
  const componentHits = new Map()
  /** @type {Map<string, Set<string>>} */
  const iconHits = new Map()
  /** @type {Map<string, Set<string>>} */
  const serviceHits = new Map()

  for (const f of files) {
    scanFile(f, validIcons, componentHits, iconHits, serviceHits)
  }

  const components = [...componentHits.keys()].sort()
  const icons = [...iconHits.keys()].sort()
  const services = [...serviceHits.keys()].sort()

  const report = {
    generatedAt: new Date().toISOString(),
    scannedFiles: files.length,
    totalAvailableIcons: validIcons.size,
    components: {
      count: components.length,
      list: components
    },
    icons: {
      count: icons.length,
      usageRate: `${((icons.length / validIcons.size) * 100).toFixed(2)}%`,
      list: icons,
      detail: Object.fromEntries(icons.map((k) => [k, [...iconHits.get(k)].sort()]))
    },
    serviceComponents: {
      count: services.length,
      list: services,
      detail: Object.fromEntries(services.map((k) => [k, [...serviceHits.get(k)].sort()]))
    }
  }

  const outFile = path.join(__dirname, 'element-usage.report.json')
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8')

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log('='.repeat(78))
  console.log('element-plus 使用情况扫描报告')
  console.log('='.repeat(78))
  console.log(`扫描文件数        : ${files.length}`)
  console.log(`图标库总数        : ${validIcons.size}`)
  console.log(`实际使用组件      : ${components.length} 种`)
  console.log(`实际使用图标      : ${icons.length} 个 (${report.icons.usageRate})`)
  console.log(`函数式服务型组件  : ${services.join(', ') || '无'}`)
  console.log('')
  console.log('--- 组件清单 ---')
  console.log(components.join(', '))
  console.log('')
  console.log('--- 图标清单 ---')
  console.log(icons.join(', '))
  console.log('')
  console.log(`报告已写入: ${path.relative(PROJECT_ROOT, outFile).replace(/\\/g, '/')}`)
}

main().catch((err) => {
  console.error('[scan] 执行失败:', err)
  process.exit(1)
})
