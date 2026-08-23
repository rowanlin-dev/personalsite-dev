# PersonalSite 前端

个人网站前端，技术栈：Vue 3 + Vite + Element Plus + Pinia + Vue Router。

```bash
npm install
npm run dev      # 开发（通过 vite proxy 调后端 /api）
npm run build    # 构建
```

## 如何自定义主题配色

站点分两套主题：**暗色极客风**（首页）和**明亮杂志风**（博客 / 项目页），
通过 CSS 变量实现，路由切换时自动切换 `body` 上的 `theme-dark` / `theme-light` class。

**改配色只需要编辑一个文件：[`src/theme.config.js`](src/theme.config.js)**

### 玩法一：换内置预设（最简单）

```js
export default {
  dark:  { preset: 'violet', overrides: {} },   // 暗色页用紫罗兰
  light: { preset: 'forest', overrides: {} }    // 亮色页用森林绿
}
```

内置预设（定义在 `src/styles/themes/presets.js`，每个都含暗色 / 亮色两套）：

| 预设名 | 风格 |
| --- | --- |
| `neon-cyan` | 霓虹青（默认）：暗色青紫极客 + 亮色杂志青 |
| `violet` | 紫罗兰 |
| `warm-orange` | 暖橙琥珀 |
| `forest` | 森林绿 |

暗色和亮色可以混搭不同预设。保存后 Vite 热更新立即生效。

### 玩法二：覆盖单个变量

在 `overrides` 里写「变量名: 色值」（不带 `--` 前缀），会盖掉预设同名变量：

```js
dark: {
  preset: 'neon-cyan',
  overrides: {
    accent: '#34d399',        // 主强调色（按钮、链接、渐变）
    'bg-card': '#101827'      // 卡片底色
  }
}
```

常用变量：`accent` / `accent-2` / `bg` / `bg-soft` / `bg-card` / `text` /
`text-secondary` / `header-bg` / `footer-bg`，完整列表见
`presets.js` 里的 `buildThemeVars()`。
Element Plus 的主色梯度（`el-color-primary-light-*` 等）会由 `accent` 自动推导，
一般无需手动覆盖。

### 玩法三：新增自己的预设

在 `src/styles/themes/presets.js` 里仿照现有预设加一项
（只需给出核心色板，派生变量自动计算），然后到
`theme.config.js` 把 `preset` 改成新预设名。

### 目录结构

```
src/
├── theme.config.js            # ★ 你唯一需要改的文件
└── styles/themes/
    ├── base.css               # 结构样式 + 默认变量兜底（勿改配色）
    ├── presets.js             # 命名预设（可加新预设）
    └── applyTheme.js          # 运行时把最终变量注入 <style>
```
