/**
 * element-icons.js —— @element-plus/icons-vue 图标「显式白名单」全局注册
 * ===========================================================================
 *
 * 【为什么需要这个文件】
 * 改造前 `main.js` 的写法是：
 *     import * as ElementPlusIconsVue from '@element-plus/icons-vue'
 *     for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
 *       app.component(key, component)
 *     }
 * `import *` + 运行时遍历会让 Rollup 无法静态判定哪些导出被使用，
 * tree-shaking 完全失效 —— 图标库全部 293 个组件被打进入口 chunk。
 * 实测全站只用到 17 个（5.80%），其余 276 个是纯浪费。
 *
 * 【为什么不能删掉全局注册】
 * 模板中 `<el-icon><View /></el-icon>` 这类写法依赖「全局注册」。
 * 若某个图标未注册，Vue 只在 dev 模式告警，生产环境会静默渲染成空标签 ——
 * 属于极难发现的静默故障。因此白名单必须完整。
 *
 * 【白名单如何生成 —— 严禁人工枚举】
 * 由 `scripts/scan-element-usage.mjs` 扫描全站 src/ 生成，覆盖以下全部用法：
 *   1. 模板标签      <View />、<arrow-down />
 *   2. 显式具名导入  import { Search } from '@element-plus/icons-vue'
 *   3. 属性绑定      :icon="Pointer"
 *   4. 动态组件      <component :is="'Setting'" />
 *   5. JS 字面量     icon: 'Odometer'
 * 新增/删除图标后必须重跑：
 *     node scripts/scan-element-usage.mjs
 * 并据其输出同步下方 import 与 ELEMENT_ICONS 映射。
 *
 * 【下方 for...of 与被删掉的写法有何不同】
 * 这里遍历的是「显式具名导入构成的对象字面量」，每个成员都是静态可分析的
 * ESM 具名导入，Rollup 能精确 tree-shake，只有这 17 个图标会进产物。
 * 被删掉的写法遍历的是 `import *` 命名空间对象，二者性质完全不同。
 * ===========================================================================
 */

import {
  ArrowDown,
  ArrowRight,
  Back,
  ChatDotRound,
  Delete,
  Document,
  Download,
  EditPen,
  FolderOpened,
  Link,
  Menu,
  Message,
  Pointer,
  Search,
  Sunny,
  Upload,
  View
} from '@element-plus/icons-vue'

/**
 * 全站实际使用的图标白名单（由 scripts/scan-element-usage.mjs 扫描生成）。
 * 键名必须与模板中使用的标签名（PascalCase）完全一致。
 *
 * 使用点速查（相对 personal-site-frontend/）：
 *   ArrowDown     src/views/admin/Layout.vue
 *   ArrowRight    src/views/Home.vue
 *   Back          src/views/ArticleDetail.vue
 *   ChatDotRound  src/views/Home.vue
 *   Delete        src/views/admin/AssetLibrary.vue, Config.vue
 *   Document      src/views/Home.vue, admin/Config.vue, admin/Layout.vue
 *   Download      src/views/components/AppHeader.vue
 *   EditPen       src/views/Home.vue, src/views/Articles.vue
 *   FolderOpened  src/views/Home.vue, src/views/Projects.vue, admin/Layout.vue
 *   Link          src/views/Home.vue, src/views/Projects.vue
 *   Menu          src/views/components/AppHeader.vue, admin/Layout.vue
 *   Message       src/views/Home.vue
 *   Pointer       src/views/Home.vue, Articles.vue, ArticleDetail.vue
 *   Search        src/views/Articles.vue, admin/CollectionManagement.vue
 *   Sunny         src/views/components/AppHeader.vue
 *   Upload        src/views/admin/Config.vue, admin/AssetLibrary.vue
 *   View          src/views/Home.vue, Articles.vue, ArticleDetail.vue, Projects.vue
 *
 * @type {Readonly<Record<string, import('vue').Component>>}
 */
export const ELEMENT_ICONS = Object.freeze({
  ArrowDown,
  ArrowRight,
  Back,
  ChatDotRound,
  Delete,
  Document,
  Download,
  EditPen,
  FolderOpened,
  Link,
  Menu,
  Message,
  Pointer,
  Search,
  Sunny,
  Upload,
  View
})

/**
 * 把白名单内的图标注册为全局组件。
 *
 * @param {import('vue').App} app Vue 应用实例
 * @returns {void}
 */
export function setupElementIcons(app) {
  for (const [name, component] of Object.entries(ELEMENT_ICONS)) {
    app.component(name, component)
  }
}

export default setupElementIcons
