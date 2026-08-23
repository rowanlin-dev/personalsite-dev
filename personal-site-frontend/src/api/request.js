import axios from 'axios'
import { ElMessage } from 'element-plus'

// element-plus 按需引入后，ElMessage 这类「函数式组件」不会被
// unplugin-vue-components 的 ElementPlusResolver 自动补样式
// （它只处理模板里出现的 <el-xxx> 标签），必须显式引入，否则 toast 弹出但无样式。
// 样式集中在 src/plugins/element-styles.js 维护；这里再引一次是为了让依赖关系
// 在实际调用点显式可见 —— Rollup 会去重，不产生额外体积。
import '../plugins/element-styles'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 慢请求阈值（ms），超过则在控制台告警
const SLOW_REQUEST_THRESHOLD = 300

// 后端 LoginInterceptor 白名单内的匿名可访问读接口。
// 这些公开接口即便意外返回 401（如访客无登录态），也应静默处理、不弹「未登录」toast，
// 避免污染公开页面。需登录的接口（/admin/*、各 save/delete、/config/all）不在此列，
// 仍保留原提示逻辑，以确保后台登录态失效时用户能感知并重新登录。
const PUBLIC_PATHS = [
  '/config/about', '/config/contact', '/config/resume', '/config/avatar',
  '/article/list', '/article/detail', '/article/info', '/article/liked', '/article/like',
  '/project/list', '/project/all', '/project/detail',
  '/tag/list', '/tag/list-with-aliases', '/tag/cloud', '/tag/tree', '/tag/alias',
  '/skill/list', '/skill/all', '/skill/detail', '/skill/radar'
]
const isPublicPath = (url) => PUBLIC_PATHS.some(p => (url || '').startsWith(p))

request.interceptors.request.use(
  config => {
    config.metadata = { startTime: performance.now() }
    return config
  },
  error => Promise.reject(error)
)

request.interceptors.response.use(
  response => {
    const config = response.config
    const startTime = config.metadata?.startTime
    const duration = startTime ? Math.round(performance.now() - startTime) : 0
    const url = config.url

    if (duration >= SLOW_REQUEST_THRESHOLD) {
      console.warn(`[慢请求] ${url} 耗时 ${duration}ms`)
    } else {
      console.log(`[请求] ${url} 耗时 ${duration}ms`)
    }

    const data = response.data
    if (data.code !== 200) {
      ElMessage.error(data.msg || '请求失败')
      return Promise.reject(data)
    }
    return data
  },
  error => {
    const config = error.config
    const startTime = config?.metadata?.startTime
    const duration = startTime ? Math.round(performance.now() - startTime) : 0
    console.error(`[请求失败] ${config?.url} 耗时 ${duration}ms`, error)

    const status = error.response?.status
    const msg = error.response?.data?.msg

    // 公开读接口返回 401（登录态缺失）时，仅告警、不弹 toast，避免污染公开页面体验。
    // 需登录接口（/admin/*、save/delete、/config/all 等）仍按原逻辑弹「未登录」提示。
    if (status === 401 && isPublicPath(config?.url)) {
      console.warn(`[公开接口 401 已静默] ${config?.url}（${msg || '未登录'}）`)
      return Promise.reject(error)
    }

    ElMessage.error(msg || '网络错误')
    return Promise.reject(error)
  }
)

export default request
