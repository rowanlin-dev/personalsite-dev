import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { ElLoading } from 'element-plus'

// element-plus 按需模式下必须手动补齐的样式（base 变量 + 函数式组件 + 指令）。
// 必须早于项目自身的 base.css，保证层叠顺序为：
//   element-plus base -> 项目 base.css -> applyTheme() 注入的 <style>
// 与改造前 `import 'element-plus/dist/index.css'` 置顶时的顺序一致。
import './plugins/element-styles'
import './styles/themes/base.css'

import { applyTheme } from './styles/themes/applyTheme'
import { setupElementIcons } from './plugins/element-icons'

import App from './App.vue'
import router from './router'

// 注入主题变量（读取 src/theme.config.js）
applyTheme()

const app = createApp(App)

// 图标：显式白名单全局注册（替代原先 `import *` + 遍历全量注册的写法）。
// 白名单由 scripts/scan-element-usage.mjs 扫描生成，详见该文件头部说明。
setupElementIcons(app)

// v-loading 指令：src/views/admin/CollectionManagement.vue 使用。
// unplugin-vue-components 的 ElementPlusResolver 默认也能解析指令，
// 这里显式 install 是双保险 —— 同时会正确设置 Loading 服务的 app context。
app.use(ElLoading)

app.use(createPinia())
app.use(router)

app.mount('#app')
