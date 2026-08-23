/* ============================================================
 * ★ 主题配置 —— 自定义配色只需要改这一个文件 ★
 * ------------------------------------------------------------
 * 本站分两套主题：
 *   dark  → 首页 / 暗色页面（极客风）
 *   light → 博客、项目等亮色页面（杂志风）
 *
 * 【玩法一：换预设】（最简单）
 *   把 preset 改成 presets.js 里任意预设名：
 *     'neon-cyan'    霓虹青（默认）
 *     'violet'       紫罗兰
 *     'warm-orange'  暖橙
 *     'forest'       森林绿
 *   暗色和亮色可以用不同的预设，自由混搭。
 *
 * 【玩法二：覆盖单个变量】
 *   在 overrides 里写「变量名: 色值」，会盖掉预设里的同名变量。
 *   变量名不带 `--` 前缀。常用变量：
 *     accent / accent-2     主/次强调色（按钮、链接、渐变）
 *     bg / bg-card          页面底色 / 卡片底色
 *     text / text-secondary 主/次文字色
 *     header-bg             顶栏毛玻璃底色
 *   完整变量列表见 src/styles/themes/presets.js 的 buildThemeVars。
 *   注意：Element Plus 主色梯度由 accent 自动推导，
 *   如果你覆盖了 el-color-primary，建议把 light-3/5/7/8/9、dark-2
 *   也一起覆盖，否则梯度会不协调。
 *
 * 【玩法三：新增预设】
 *   打开 src/styles/themes/presets.js，仿照现有预设加一项，
 *   再回到这里把 preset 改成新预设名。
 *
 * 改完保存即可，Vite 热更新会立即生效，无需重启。
 * ============================================================ */

export default {
  // 暗色主题（首页等极客风页面）
  dark: {
    preset: 'neon-cyan',
    overrides: {
      // 示例：把暗色主题强调色换成绿色
      // accent: '#34d399',
    }
  },

  // 亮色主题（博客 / 项目等杂志风页面）
  light: {
    preset: 'neon-cyan',
    overrides: {
      // 示例：把亮色主题页面底色换成纯白
      // bg: '#ffffff',
    }
  }
}
