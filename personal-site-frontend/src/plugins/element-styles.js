/**
 * element-styles.js —— element-plus 按需模式下必须「手动补齐」的样式
 * ===========================================================================
 *
 * 【背景】
 * `unplugin-vue-components` + `ElementPlusResolver` 只能为「模板里出现的标签」
 * （如 <el-button />）自动补样式。以下两类用法它覆盖不到，必须手动引入，
 * 否则运行时组件能弹出来但完全没有样式 —— 这是按需引入最容易漏的一步：
 *
 *   1. 函数式 / 服务型组件：代码里直接 `import { ElMessage } from 'element-plus'`
 *      然后 `ElMessage.error(...)` 调用。全站 16 个文件这么用（见 request.js
 *      与 admin/* 各视图）。
 *   2. 指令：`v-loading`（src/views/admin/CollectionManagement.vue 使用）。
 *
 * 【为什么用 es/components/<name>/style/css 而不是 theme-chalk/el-xxx.css】
 * 前者是 element-plus 官方的按需样式入口，会自动把依赖链一并带上，例如：
 *   message-box/style/css  ->  base + input + button + overlay + el-message-box.css
 *   message/style/css      ->  base + badge + el-message.css
 * 直接引 theme-chalk/el-message-box.css 会丢掉 overlay/button/input 的样式。
 *
 * 【base.css 与主题变量】
 * base 里定义了 :root 上的全部 --el-* CSS 变量。本文件在 main.js 中先于
 * `styles/themes/base.css` 引入，确保：
 *   element-plus base  →  项目 base.css  →  applyTheme() 注入的 <style>
 * 三者层叠顺序与改造前（element-plus/dist/index.css 在最前）保持一致，
 * applyTheme 对 --el-button-text-color 的覆盖不受影响。
 * 另注：applyTheme 的选择器
 *   body.theme-dark .el-button--primary:not(.is-link):not(.is-text):not(.is-plain)
 * 特异性为 (0,4,1)，远高于 element-plus 的 .el-button--primary (0,1,0)，
 * 因此即使样式注入顺序变化也仍然生效。
 *
 * 【维护提示】
 * 新增任何「函数式调用」或「指令式」的 element-plus 能力（如 ElNotification、
 * v-infinite-scroll），必须在本文件补一行对应的 style/css 引入。
 * ===========================================================================
 */

// 基础层：:root 上的 --el-* 变量、reset、过渡动画。必须最先引入。
import 'element-plus/es/components/base/style/css'

// ElMessage —— src/api/request.js 与 12 个 admin 视图直接函数式调用
import 'element-plus/es/components/message/style/css'

// ElMessageBox —— admin/Articles、Projects、Skills、TagManagement、
// CollectionManagement、AssetLibrary 的删除二次确认
import 'element-plus/es/components/message-box/style/css'

// v-loading 指令 —— src/views/admin/CollectionManagement.vue
import 'element-plus/es/components/loading/style/css'
