/* ============================================================
 * 主题系统 · 运行时注入
 * 读取 src/theme.config.js，合并预设与用户覆盖，
 * 生成 <style> 注入 <head>（位于 base.css 之后，优先级更高）。
 * ============================================================ */

import { presets } from './presets'
import themeConfig from '../../theme.config'

const FALLBACK_PRESET = 'neon-cyan'

export function applyTheme() {
  const blocks = ['dark', 'light'].map((mode) => {
    const conf = themeConfig?.[mode] || {}
    const presetName = conf.preset || FALLBACK_PRESET
    const presetVars =
      presets[presetName]?.[mode] || presets[FALLBACK_PRESET][mode]
    const vars = { ...presetVars, ...(conf.overrides || {}) }

    const body = Object.entries(vars)
      .map(([name, value]) => `  --${name}: ${value};`)
      .join('\n')
    return `body.theme-${mode} {\n${body}\n}`
  })

  // 支持热更新：重复注入时替换旧 style 节点
  let styleEl = document.getElementById('app-theme-overrides')
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'app-theme-overrides'
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = blocks.join('\n\n')

  // 暗色实心主按钮文字色（跟随预设的 primary-on-solid）
  const darkVars = {
    ...(presets[themeConfig?.dark?.preset || FALLBACK_PRESET]?.dark ||
      presets[FALLBACK_PRESET].dark),
    ...(themeConfig?.dark?.overrides || {})
  }
  if (darkVars['primary-on-solid']) {
    styleEl.textContent += `\n\nbody.theme-dark .el-button--primary:not(.is-link):not(.is-text):not(.is-plain) {\n` +
      `  --el-button-text-color: ${darkVars['primary-on-solid']};\n` +
      `  --el-button-hover-text-color: ${darkVars['primary-on-solid']};\n` +
      `  --el-button-active-text-color: ${darkVars['primary-on-solid']};\n}`
  }
}

export default applyTheme
