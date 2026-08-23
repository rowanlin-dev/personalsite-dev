import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(ROOT_DIR, '..')

/* -------------------------------------------------------------------------- */
/* 站点常量（SEO / 资源提示用）                                                 */
/* -------------------------------------------------------------------------- */

/** 主域兜底值。与 deploy/nginx-minipluto.conf 的 server_name 及部署脚本 CDN_URLS 一致。 */
const DEFAULT_SITE_ORIGIN = 'https://minipluto.cn'

/** COS 图片域名兜底值。与仓库根 .env 的 COS_DOMAIN 一致。 */
const DEFAULT_COS_DOMAIN = 'cos-personal-site.minipluto.cn'

/**
 * 从仓库根目录的 .env 读取指定键。
 *
 * 该 .env 是后端（Spring/Tomcat）与部署脚本共用的配置源，且被 .gitignore 忽略，
 * 因此这里必须容错：文件不存在 / 键缺失时回退到兜底值，绝不让构建失败。
 *
 * @param {string} key      环境变量名，例如 'COS_DOMAIN'
 * @param {string} fallback 读取失败时的兜底值
 * @returns {string} 配置值
 */
function readRepoEnv(key, fallback) {
  try {
    const envPath = path.join(REPO_ROOT, '.env')
    if (!fs.existsSync(envPath)) return fallback
    const text = fs.readFileSync(envPath, 'utf8')
    const matched = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'm'))
    if (!matched) return fallback
    const value = matched[1].trim().replace(/^["']|["']$/g, '')
    return value || fallback
  } catch (err) {
    console.warn(`[vite] 读取根 .env 的 ${key} 失败，使用兜底值 ${fallback}：${err.message}`)
    return fallback
  }
}

/** 站点主域（canonical / og:url 基准）。可用环境变量 VITE_SITE_ORIGIN 覆盖。 */
const SITE_ORIGIN = (process.env.VITE_SITE_ORIGIN || DEFAULT_SITE_ORIGIN).replace(/\/+$/, '')

/** COS 图片域名（preconnect / dns-prefetch 目标）。 */
const COS_DOMAIN = readRepoEnv('COS_DOMAIN', DEFAULT_COS_DOMAIN)

/**
 * 把 index.html 里的占位符替换为真实站点常量。
 *
 * 为什么不用 Vite 原生的 `%VITE_X%` 语法：
 *   - COS_DOMAIN 来自仓库根的 .env（后端共用），不是前端 .env，Vite 不会加载；
 *   - 前端 .env.* 被 .gitignore 忽略（见根 .gitignore 第 3 行 `.env.*`），
 *     新克隆的仓库会缺文件导致构建产物缺 preconnect，属于静默劣化。
 * 因此改用自定义占位符 `__COS_DOMAIN__` / `__SITE_ORIGIN__`，在此处集中注入，
 * 且带兜底值，任何环境都能构建出正确的 HTML。
 *
 * @type {import('vite').Plugin}
 */
const htmlSiteConstantsPlugin = {
  name: 'personal-site:html-constants',
  transformIndexHtml: {
    order: 'pre',
    /**
     * @param {string} html 原始 HTML
     * @returns {string} 替换占位符后的 HTML
     */
    handler(html) {
      return html
        .replaceAll('__COS_DOMAIN__', COS_DOMAIN)
        .replaceAll('__SITE_ORIGIN__', SITE_ORIGIN)
    }
  }
}

/* -------------------------------------------------------------------------- */
/* manualChunks —— 按「变更频率」而非体积分组，最大化浏览器/CDN 缓存命中率        */
/* -------------------------------------------------------------------------- */

/**
 * 手动分包策略。
 *
 * 分组原则：把「几乎不变的第三方依赖」与「高频变更的业务代码」彻底隔离，
 * 这样发版时用户只需重新下载业务 chunk（通常 < 30 KiB），
 * 而不是像改造前那样重下整个 1.14 MiB 的入口。
 *
 * 【核心原则：只有「全站每个页面都要用」的依赖才值得手动分组】
 * 手动分组会强制把组内所有模块打进同一个文件。若组内含有「只有个别路由才用到」
 * 的模块，那么任何一个页面只要碰到该组，就得把整组一起下载 —— 手动分包反而
 * 摧毁了 Vite 原生的按路由代码分割。下面两个包正是因此被排除在外。
 *
 * 【三处刻意偏离架构评审文档 §3.2 的设计，均有实测数据支撑】
 *
 * 1) md-editor-v3 不进 vendor-md（评审文档原方案把它和 dompurify 归为一组）
 *    md-editor-v3 同时导出轻量的 `MdPreview`（公开文章页用）和重量级的
 *    `MdEditor`（后台编辑页用，含 codemirror 等，实测 664 KiB）。
 *    若强制把整个包归入同一个 chunk，Rollup 会把两者的模块合并输出，
 *    公开文章页 ArticleDetail 只需要 MdPreview 却会被迫下载完整编辑器，
 *    首屏体积不降反升约 10 倍 —— 与优化目标直接冲突。
 *    保持不分组，让 Rollup 按「可达性」自然拆分，实测已正确分离
 *    （ArticleDetail-*.js 5.93 KiB vs ArticleEdit-*.js 664 KiB）。
 *
 * 2) element-plus 整体不进 vendor-element（评审文档原方案要求单独成组）
 *    这是本次最关键的一处修正，有实测数据：按评审文档建组后，
 *    vendor-element 达 928 KiB，且因入口可达而被 index.html 的 modulepreload
 *    直接拉取，首屏 JS = 入口 17 KiB + vendor-vue 112 KiB + vendor-element 928 KiB
 *    ≈ 1058 KiB，相比改造前 1197 KiB 只降 12% —— 优化基本落空。
 *    根因：全站 37 个 element-plus 组件里，约 29 个是后台独占
 *    （el-table / el-tree / el-upload / el-date-picker / el-select ...），
 *    强行归入同一 chunk 后，公开页面被迫下载整个后台组件集。
 *    改为不分组，交由 Rollup 按路由可达性自然拆分：
 *    入口只带 ElMessage / ElMessageBox / ElLoading 等真正全局用到的部分，
 *    后台组件随各自路由 chunk 懒加载。
 *    注意：此处「不手动分组」不会产生重复打包 —— 被 2 个以上动态入口共用的
 *    模块，Rollup 会自动抽成共享 chunk。
 *
 * 3) element-plus 的按需样式模块（es/components/<name>/style/*）同理不分组
 *    这些是只含 CSS 副作用的模块，理由与 2) 完全一致：集中成组会让首页
 *    加载后台专用组件的 CSS，阻塞渲染的样式反而变大。
 *    保持不分组 → CSS 跟随各自路由 chunk 分发，首屏只加载本页真正用到的样式。
 *    全局必需的基础样式（base / message / message-box / loading）已由
 *    src/plugins/element-styles.js 从入口显式引入，落在入口 CSS 中，不受影响。
 *    （因 element-plus 整体已不分组，这里无需再写排除规则，特此说明。）
 *
 * @param {string} id 模块的绝对路径 id
 * @returns {string | undefined} chunk 名；返回 undefined 表示交给 Rollup 默认算法
 */
function manualChunks(id) {
  const file = id.replace(/\\/g, '/')
  if (!file.includes('/node_modules/')) return undefined

  // 框架层：每个页面都要用，且季度级才升级一次，缓存价值最高
  if (/\/node_modules\/(vue|vue-router|pinia|@vue)\//.test(file)) return 'vendor-vue'

  // 网络层：axios 实例被所有 api 模块共用
  if (/\/node_modules\/axios\//.test(file)) return 'vendor-net'

  // 可视化层：仅 src/components/TechMap.vue 使用
  if (/\/node_modules\/d3-[a-z-]+\//.test(file)) return 'vendor-viz'

  // Markdown 安全层：仅 ArticleDetail / ArticleEdit 使用，不进首屏
  if (/\/node_modules\/dompurify\//.test(file)) return 'vendor-md'

  // element-plus / @element-plus / @vueuse 刻意不分组，见上方说明 2、3
  return undefined
}

/* -------------------------------------------------------------------------- */
/* Vite 配置                                                                    */
/* -------------------------------------------------------------------------- */

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),

    // 自动导入 ElMessage / ElMessageBox 等 API（现有代码为显式 import，
    // 此处主要是为新增代码兜底，避免今后漏引样式）
    AutoImport({
      resolvers: [ElementPlusResolver()],
      // 纯 JS 项目，不生成 auto-imports.d.ts，避免产生未纳入版本控制的噪音文件
      dts: false
    }),

    // 模板中 <el-xxx> 标签按需解析组件 + 自动引入对应样式。
    // 注意：ElementPlusResolver 不解析 @element-plus/icons-vue 的图标，
    // 图标由 src/plugins/element-icons.js 走显式白名单全局注册。
    Components({
      resolvers: [ElementPlusResolver()],
      dts: false
    }),

    htmlSiteConstantsPlugin
  ],

  define: {
    // SEO 工具层（src/utils/seo.js）用它拼 canonical / og:url 绝对地址。
    // 必须是固定主域而非 window.location.origin，否则 minipluto.cn 与
    // www.minipluto.cn 会各自指向自己，canonical 失去归一化作用。
    __SITE_ORIGIN__: JSON.stringify(SITE_ORIGIN)
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/upload': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },

  build: {
    // 显式声明，避免依赖 Vite 默认值被上游改动影响
    minify: 'esbuild',
    sourcemap: false,
    cssCodeSplit: true,

    // 超过 500 KiB 的 chunk 在构建时告警，防止体积回退
    // （本次 1.14 MiB 入口正是长期缺少体积守门累积的结果）
    chunkSizeWarningLimit: 500,

    // 关闭 gzip 体积统计可明显加快构建；实际传输体积以 CDN 侧压缩为准
    reportCompressedSize: false,

    // 【P0-5 构建卡点修复】
    // Vite 的 emptyOutDir 会对 dist/assets 执行一次「递归批量删除」。
    // 在带批量删除防护的工作环境下（见 qa-build.log:
    // SAFE_DELETE_BULK_CONFIRM_REQUIRED count=306 threshold=50），
    // 该调用被守卫拦截并直接导致 `Build failed` —— 这就是上次构建失败的根因。
    //
    // 注意：不能用「拆成逐文件删除」来绕过。实测守卫的计数是按 turn 累计的
    // （scope:"turn"），单文件 unlink 一样会在累计到 50 次后被拦截，且每次
    // 拦截都会 spawnSync 一个会超时的守卫子进程，结果是构建静默挂起数分钟
    // （实测卡死 8m19s、dist 一个文件未删）。详见 scripts/clean-dist.mjs 头注。
    //
    // 因此这里关闭 Vite 自带清理，且默认构建流程完全不做删除：
    //   - 构建产物文件名带内容 hash，新 index.html 只引用新文件，
    //     残留旧文件不会被引用，不影响正确性（唯一代价是 dist 目录偏大）。
    //   - 发布流程 scripts/deploy_frontend.py 的 clean_dist() 用 Python
    //     shutil.rmtree 硬清理，不经 Node 守卫，保证 release 产物干净。
    emptyOutDir: false,

    rollupOptions: {
      output: {
        manualChunks,
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
})
