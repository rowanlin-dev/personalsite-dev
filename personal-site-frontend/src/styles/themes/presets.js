/* ============================================================
 * 主题系统 · 命名预设（presets）
 * ------------------------------------------------------------
 * 每个预设提供 dark / light 两套「核心色板」，由 buildThemeVars
 * 自动推导出全部 CSS 变量（含 Element Plus 主色梯度、
 * hover 底色、毛玻璃 header 等派生值）。
 *
 * 想新增预设：仿照下面加一个键即可，然后在
 * src/theme.config.js 里把 preset 改成它的名字。
 * ============================================================ */

/* ---------- 颜色工具 ---------- */
const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

const rgbToHex = ([r, g, b]) =>
  '#' + [r, g, b].map(n => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('')

/** 两色混合，w 为目标色权重 0~1 */
const mix = (a, b, w) => {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return rgbToHex(ca.map((v, i) => v + (cb[i] - v) * w))
}

/**  hex + 透明度 → rgba() */
const alpha = (hex, a) => {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/* ---------- 核心色板 → 完整 CSS 变量 ---------- */
/**
 * core 字段说明：
 *  bg / bgSoft / bgCard / bgElevated  层级底色（页面 < 区块 < 卡片 < 抬升面）
 *  text / textSecondary / textMuted   三级文字
 *  accent / accent2                   主强调色 / 次强调色（渐变、按钮、链接）
 *  footerText                         页脚文字（默认同 textMuted，可单独调亮）
 */
export function buildThemeVars(core) {
  const {
    bg, bgSoft, bgCard, bgElevated,
    text, textSecondary, textMuted,
    accent, accent2,
    footerBg, footerText = textMuted,
    scheme
  } = core

  const isDark = scheme === 'dark'
  // 分隔线 / 毛玻璃描边基于文字色推导，深浅主题自动适配
  const lineBase = isDark ? '#94a3b8' : '#0f172a'

  return {
    'bg': bg,
    'bg-soft': bgSoft,
    'bg-card': bgCard,
    'bg-elevated': bgElevated,
    'text': text,
    'text-secondary': textSecondary,
    'text-muted': textMuted,
    'accent': accent,
    'accent-2': accent2,
    'accent-soft': alpha(accent, isDark ? 0.12 : 0.08),
    'border': alpha(lineBase, isDark ? 0.14 : 0.09),
    'hover-bg': alpha(accent, isDark ? 0.06 : 0.05),
    'header-bg': alpha(isDark ? bg : '#ffffff', isDark ? 0.72 : 0.78),
    'header-border': alpha(lineBase, isDark ? 0.12 : 0.08),
    'footer-bg': footerBg,
    'footer-text': footerText,
    'menu-text': textSecondary,
    'shadow-card': isDark
      ? '0 4px 24px rgba(0, 0, 0, 0.25)'
      : '0 2px 12px rgba(15, 23, 42, 0.06)',
    // Element Plus 主色梯度（由 accent 自动推导）
    'el-color-primary': accent,
    'el-color-primary-dark-2': mix(accent, isDark ? '#000000' : '#000000', 0.18),
    'el-color-primary-light-3': mix(accent, '#ffffff', 0.32),
    'el-color-primary-light-5': mix(accent, '#ffffff', 0.55),
    'el-color-primary-light-7': mix(accent, '#ffffff', 0.74),
    'el-color-primary-light-8': mix(accent, '#ffffff', 0.84),
    'el-color-primary-light-9': alpha(accent, isDark ? 0.14 : 0.1),
    // 暗色主题实心主按钮的深色文字（亮色主题保持白字）
    ...(isDark ? { 'primary-on-solid': '#06252b' } : { 'primary-on-solid': '#ffffff' })
  }
}

/* ============================================================
 * 预设列表
 * ============================================================ */
export const presets = {
  /* 霓虹青（默认）：暗色极客青紫 + 明亮杂志青 */
  'neon-cyan': {
    dark: buildThemeVars({
      scheme: 'dark',
      bg: '#0a0e17', bgSoft: '#0d1320', bgCard: '#121826', bgElevated: '#182033',
      text: '#e6ecf5', textSecondary: '#9aa7bd', textMuted: '#64748b',
      accent: '#22d3ee', accent2: '#a78bfa',
      footerBg: '#080b12', footerText: '#8a97ab'
    }),
    light: buildThemeVars({
      scheme: 'light',
      bg: '#fafaf6', bgSoft: '#f4f3ec', bgCard: '#ffffff', bgElevated: '#ffffff',
      text: '#20242c', textSecondary: '#5b6472', textMuted: '#8a93a3',
      accent: '#0e8aa8', accent2: '#7c6bd6',
      footerBg: '#f0efe8'
    })
  },

  /* 紫罗兰：暗色紫调极客 + 明亮紫色杂志 */
  'violet': {
    dark: buildThemeVars({
      scheme: 'dark',
      bg: '#0d0a17', bgSoft: '#120f1f', bgCard: '#171226', bgElevated: '#1f1833',
      text: '#ece8f5', textSecondary: '#a39dbd', textMuted: '#6f6889',
      accent: '#a78bfa', accent2: '#22d3ee',
      footerBg: '#0a0812', footerText: '#9a93b3'
    }),
    light: buildThemeVars({
      scheme: 'light',
      bg: '#fbfaf8', bgSoft: '#f5f3ee', bgCard: '#ffffff', bgElevated: '#ffffff',
      text: '#23202c', textSecondary: '#5f5b72', textMuted: '#8f8ba3',
      accent: '#6d5bd0', accent2: '#0e8aa8',
      footerBg: '#f1eff0'
    })
  },

  /* 暖橙：暗色琥珀暖调 + 明亮陶橙杂志 */
  'warm-orange': {
    dark: buildThemeVars({
      scheme: 'dark',
      bg: '#14100a', bgSoft: '#181309', bgCard: '#1e1810', bgElevated: '#272013',
      text: '#f5eee2', textSecondary: '#b3a793', textMuted: '#7d7466',
      accent: '#fbbf24', accent2: '#fb923c',
      footerBg: '#100d08', footerText: '#a2988a'
    }),
    light: buildThemeVars({
      scheme: 'light',
      bg: '#fbf8f3', bgSoft: '#f5f0e8', bgCard: '#ffffff', bgElevated: '#ffffff',
      text: '#2b2419', textSecondary: '#6b6252', textMuted: '#988e7c',
      accent: '#c2690a', accent2: '#8a6d3b',
      footerBg: '#f2ede4'
    })
  },

  /* 森林绿：暗色苔绿 + 明亮墨绿杂志 */
  'forest': {
    dark: buildThemeVars({
      scheme: 'dark',
      bg: '#0a120d', bgSoft: '#0d1710', bgCard: '#121e15', bgElevated: '#18271c',
      text: '#e5f2e8', textSecondary: '#9cb3a2', textMuted: '#637d6b',
      accent: '#34d399', accent2: '#a3e635',
      footerBg: '#080f0a', footerText: '#8fa896'
    }),
    light: buildThemeVars({
      scheme: 'light',
      bg: '#f8faf5', bgSoft: '#f1f4ec', bgCard: '#ffffff', bgElevated: '#ffffff',
      text: '#1f2a20', textSecondary: '#57685a', textMuted: '#87968a',
      accent: '#15803d', accent2: '#5a8a2a',
      footerBg: '#eef1e9'
    })
  }
}

export default presets
