<template>
  <div class="tech-map" ref="containerRef">
    <div v-if="mergedNodes.length === 0" class="tech-map-empty">
      <div class="empty-orbit">
        <span class="orbit-dot" />
      </div>
      <p>技术栈数据加载中或暂未配置</p>
      <span class="empty-hint">在后台「技术栈」中添加技能后，这里会生成技能图谱</span>
    </div>
    <!-- 移动端（≤768px）：分类卡片墙；桌面端保留原 SVG 图谱（v-else 承接） -->
    <div v-else-if="isMobile" class="tech-map-mobile">
      <div
        v-for="group in mobileGroups"
        :key="group.category"
        class="mobile-category-card"
      >
        <div class="mobile-card-header">
          <span
            class="mobile-card-dot"
            :style="{
              backgroundColor: categoryColor(group.category),
              boxShadow: `0 0 8px ${categoryColor(group.category)}`
            }"
          />
          <span class="mobile-card-title">{{ group.category }}</span>
          <span class="mobile-card-count">{{ group.items.length }} 项技术</span>
        </div>
        <div class="mobile-chip-list">
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            class="mobile-chip"
            :class="{ 'is-disabled': item.count === 0 }"
            :disabled="item.count === 0"
            @click="handleClick(item)"
          >
            <span class="mobile-chip-name">{{ item.name }}</span>
            <span class="mobile-chip-level">
              <span class="mobile-chip-level-bar">
                <span
                  class="mobile-chip-level-fill"
                  :style="{
                    width: item.level + '%',
                    backgroundColor: categoryColor(item.category)
                  }"
                />
              </span>
              <span class="mobile-chip-level-text">{{ item.level }}%</span>
            </span>
            <span class="mobile-chip-count">
              {{ item.count > 0 ? item.count + ' 篇' : '暂无文章' }}
            </span>
          </button>
        </div>
      </div>
    </div>
    <template v-else>
    <!-- P2-2：分类筛选 chip（仅桌面端显示） -->
    <div v-if="!isMobile" class="tech-chips">
      <button
        v-for="cat in categoryList"
        :key="cat"
        class="chip-btn"
        :class="{ active: activeCategory === cat }"
        @click="activeCategory = cat"
      >
        {{ cat }}
      </button>
    </div>
    <svg
      ref="svgRef"
      :width="width"
      :height="height"
      class="tech-map-svg"
      :class="{ 'has-hover': hoverNode, 'is-panning': isPanning }"
      @mousedown="onPanStart"
      @wheel.prevent="onWheel"
      @touchstart="onTouchStart"
      @dblclick="resetView"
    >
      <defs>
        <filter
          v-for="(color, category) in categoryColors"
          :key="`glow-${category}`"
          :id="`glow-${category}`"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <!-- 视口层：承载平移/缩放变换，节点与连线均在其中 -->
      <g class="viewport" :transform="`translate(${viewTx}, ${viewTy}) scale(${viewK})`">
      <g class="links">
        <line
          v-for="(link, index) in links"
          :key="`link-${index}`"
          :x1="link.source.x"
          :y1="link.source.y"
          :x2="link.target.x"
          :y2="link.target.y"
          class="tech-link"
          :class="[`link-${index % 5}`, linkClass(link), link.relationType ? `rt-${link.relationType}` : '', { 'link-filtered': filteredCategoryIds !== null && !filteredCategoryIds.has(link.source?.id) && !filteredCategoryIds.has(link.target?.id) }]"
          :style="{
            stroke: linkStyle(link).stroke,
            strokeWidth: linkStyle(link).strokeWidth,
            strokeDasharray: linkStyle(link).strokeDasharray,
            opacity: linkStyle(link).opacity
          }"
        />
      </g>

      <g class="nodes">
        <g
          v-for="(node, index) in nodes"
          :key="node.id"
          class="tech-node"
          :class="{
            hovering: hoverNode === node,
            related: hoverNode && hoverNode !== node && relatedNodeIds.has(node.id),
            // P2-2：分类过滤 dimmed（优先于 hover dimmed）
            filtered: filteredCategoryIds !== null && !filteredCategoryIds.has(node.id),
            dimmed: hoverNode && hoverNode !== node && !relatedNodeIds.has(node.id) && (filteredCategoryIds === null || filteredCategoryIds.has(node.id))
          }"
          :transform="`translate(${node.x}, ${node.y})`"
          @mouseenter="hoverNode = node"
          @mouseleave="hoverNode = null"
          @click="handleClick(node)"
        >
          <!-- 内层负责漂浮动画，不覆盖定位 translate -->
          <g class="tech-node-float" :style="floatStyle(index)">
            <!-- 固定基准外壳（所有节点统一半径 R0，空心发光环，仅作容器边界） -->
            <circle
              class="node-base"
              :r="BASE_RADIUS"
              :stroke="categoryColor(node.category)"
              :stroke-width="1.5"
              fill="none"
              :filter="`url(#glow-${node.category})`"
            />

            <!-- 使用频率外环：从基准边缘向外延展出 freqExtend(count) 的半透明厚环 -->
            <circle
              class="node-freq"
              :r="BASE_RADIUS + freqExtend(node.count)"
              :fill="categoryColor(node.category)"
              fill-opacity="0.12"
              :stroke="categoryColor(node.category)"
              :stroke-width="freqExtend(node.count) > 0 ? 2 : 0"
              :stroke-opacity="0.5"
            />

            <!-- 内核：熟练度（实心填充，半径 = R0 × level/100，level 100% 时填满基准圈） -->
            <circle
              class="node-inner"
              :r="innerRadius(node.level)"
              :fill="categoryColor(node.category)"
            />

            <!-- 技术名称 -->
            <text
              class="node-label"
              dy="1"
              text-anchor="middle"
              dominant-baseline="middle"
            >
              {{ shortName(node.name) }}
            </text>
          </g>
        </g>
      </g>
      </g>

      <!-- 重置视图按钮（仅桌面端显示） -->
      <g
        v-if="!isMobile"
        class="reset-btn"
        :transform="`translate(${width - 36}, 16)`"
        @click="resetView"
        @mousedown.stop
      >
        <circle r="14" />
        <text text-anchor="middle" dominant-baseline="middle" dy="1">⟲</text>
      </g>
    </svg>

    <!-- 悬停卡片 -->
    <transition name="fade">
      <div
        v-if="hoverNode"
        class="tech-tooltip"
        :style="tooltipStyle"
      >
        <div class="tooltip-title">
          {{ hoverNode.name }}
          <span class="tooltip-category">{{ hoverNode.category }}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">熟练度</span>
          <el-progress
            :percentage="hoverNode.level"
            :color="categoryColor(hoverNode.category)"
            :stroke-width="8"
            style="flex: 1;"
          />
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">博客使用</span>
          <span class="tooltip-count">{{ hoverNode.count }} 篇文章</span>
        </div>
        <!-- P1-2：若有描述信息则展示简介 -->
        <div v-if="hoverNode.description || hoverNode.desc" class="tooltip-desc">
          {{ hoverNode.description || hoverNode.desc }}
        </div>
        <div v-if="hoverNode.count > 0" class="tooltip-action">
          <el-button
            size="small"
            type="primary"
            text
            @click.stop="goArticles(hoverNode.name)"
          >
            查看相关文章
          </el-button>
        </div>
        <div v-else class="tooltip-empty">暂无相关文章</div>
      </div>
    </transition>

    <!-- 图例（P1-3：位置将移至画布外侧，当前先补全内容） -->
    <div class="tech-legend">
      <div class="legend-item">
        <span class="legend-ring" />
        <span>内核填充 = 熟练度</span>
      </div>
      <div class="legend-item">
        <span class="legend-freq" />
        <span>外环厚度 = 使用频率</span>
      </div>
      <div class="legend-sep" />
      <div class="legend-item">
        <span class="legend-link legend-link-same" />
        <span>同类</span>
      </div>
      <div class="legend-item">
        <span class="legend-link legend-link-collab" />
        <span>协作</span>
      </div>
      <div class="legend-item">
        <span class="legend-link legend-link-depend" />
        <span>依赖</span>
      </div>
      <div class="legend-item">
        <span class="legend-link legend-link-enhance" />
        <span>增强</span>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { forceSimulation, forceManyBody, forceCollide, forceLink, forceX, forceY } from 'd3-force'

const props = defineProps({
  skills: { type: Array, default: () => [] },
  // 后台手动配置的关系（方案 C），格式：[{sourceSkillId, targetSkillId, relationType}]
  // 优先级高于前端关键词推断；为空时全部走推断。
  relations: { type: Array, default: () => [] }
})

const router = useRouter()
const containerRef = ref(null)
const svgRef = ref(null)
const width = ref(0)
const height = ref(0)
const nodes = ref([])
const links = ref([])
const hoverNode = ref(null)

// P2-2：分类筛选状态（null = 全部显示）
const activeCategory = ref(null)

// 视口平移/缩放状态（P1：画布拖拽平移 + 滚轮缩放，配合防重叠硬约束查看密集节点）
const viewTx = ref(0)
const viewTy = ref(0)
const viewK = ref(1)
const isPanning = ref(false)
const MIN_K = 0.5
const MAX_K = 2.5
// 拖拽阈值：移动距离超过该值才视为拖拽（避免误触节点 click）
const DRAG_THRESHOLD = 4

// 移动端断点：≤768px 时切换为「分类卡片墙」（窄屏物理空间不足，SVG 环形布局仍会重叠）
// 用 matchMedia 监听视口宽度；初始值在 setup 期同步判定（首帧即正确），resize/旋转由 change 事件同步
const mobileQuery = typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)') : null
const isMobile = ref(mobileQuery ? mobileQuery.matches : false)

const updateIsMobile = () => {
  isMobile.value = mobileQuery ? mobileQuery.matches : false
}

// 切回桌面端时，确保 SVG 图谱按最新容器尺寸重新计算布局（防旋转/拉伸后错位）
const onMobileChange = (e) => {
  isMobile.value = e.matches
  if (!e.matches) {
    updateSize()
    runSimulation()
  }
}

// 悬停时的「关联节点」集合：hover 节点本身 + 同一分类下的所有节点。
// 在分类分区布局语义下，同分类技术属于同一技术栈，应整体保留显示（而非仅链上紧邻的 1~2 个）。
const relatedNodeIds = computed(() => {
  const set = new Set()
  const current = hoverNode.value
  if (!current) return set
  set.add(current.id)
  mergedNodes.value.forEach(n => {
    if (n.category === current.category) set.add(n.id)
  })
  return set
})

// 连线联动：与 hover 节点同分类的 link 加 link-active（整组链路保持高亮），其余由 has-hover 统一压暗
const linkClass = (link) => {
  if (!hoverNode.value) return ''
  const current = hoverNode.value
  const srcCat = link.source?.category
  const tgtCat = link.target?.category
  // links 的 source/target 可能是已解析的对象或原始 id，这里兼容两种形态
  const srcNode = typeof link.source === 'object' ? link.source : mergedNodes.value.find(n => n.id === link.source)
  const tgtNode = typeof link.target === 'object' ? link.target : mergedNodes.value.find(n => n.id === link.target)
  if (srcNode?.category === current.category || tgtNode?.category === current.category) return 'link-active'
  return ''
}

// P2-2：分类筛选——仅显示选中分类本身的节点（不跨分类带入关联节点）
const filteredCategoryIds = computed(() => {
  const ac = activeCategory.value
  if (!ac || ac === '全部') return null // null = 不过滤
  const ids = new Set()
  mergedNodes.value.forEach(n => {
    if (n.category === ac) ids.add(n.id)
  })
  return ids
})

// P2-2：分类筛选列表（"全部" + 各分类名）
const categoryList = computed(() => {
  const cats = Object.keys(categoryColors.value)
  return ['全部', ...cats]
})

const palette = [
  '#22d3ee', '#34d399', '#a78bfa', '#fbbf24', '#f472b6',
  '#fb923c', '#60a5fa', '#a3e635', '#f87171', '#22c55e', '#94a3b8'
]

const categoryColors = computed(() => {
  const categories = [...new Set(mergedNodes.value.map(n => n.category))]
    .filter(c => c && c !== '其他')
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
  // 把“其他”固定放到最后
  categories.push('其他')
  const map = {}
  categories.forEach((c, i) => {
    map[c] = palette[i % palette.length]
  })
  return map
})

const categoryColor = (category) => {
  return categoryColors.value[category || '其他'] || categoryColors.value['其他']
}

// 固定基准半径 R0：所有节点统一大小，取原 level=0 时的最小外环半径（26）。
// 这是解决重叠的根本——节点大小不再随维度变化，碰撞半径一致。
const BASE_RADIUS = 26

// ===== P1-1：link 关系类型系统（relationType）=====
// 每条 link 带有 relationType，用不同线型/颜色/宽度表达语义
const RELATION_TYPES = {
  same: {     // 同类/同栈：同分类内相邻节点串联
    label: '同类',
    strokeDash: 'none',        // 实线
    strokeWidth: 1.0,
    opacity: 0.18,
    animate: false
  },
  collab: {   // 协作：前端↔后端等跨分类协作关系
    label: '协作',
    strokeDash: '6 4',         // 虚线
    strokeWidth: 1.2,
    opacity: 0.25,
    color: 'rgba(34, 211, 238, 0.5)',          // 青色（减淡）
    animate: false
  },
  depend: {   // 依赖：后端↔DB 等数据依赖
    label: '依赖',
    strokeDash: '2 4',         // 点线
    strokeWidth: 0.8,
    opacity: 0.22,
    color: 'rgba(167, 139, 250, 0.5)',          // 紫色（减淡）
    animate: false
  },
  enhance: {  // 增强：任何技术↔AI/智能
    label: '增强',
    strokeDash: '10 4 2 4',    // 点划线（长划-空-点-空，视觉上明显区分于虚线和点线）
    strokeWidth: 1.2,
    opacity: 0.28,
    color: 'rgba(251, 191, 36, 0.5)',          // 金色（减淡）
    animate: true              // 此类 link 后续可加粒子流光（P2-3）
  }
}

// 基于分类名关键词推断两个分类之间的关系类型
const inferRelationType = (catA, catB) => {
  if (!catA || !catB || catA === catB) return 'same'
  const a = (catA + '').toLowerCase()
  const b = (catB + '').toLowerCase()
  // 前端 ↔ 后端 → 协作
  const isFE = a.includes('前端') || b.includes('前端')
  const isBE = a.includes('后端') || b.includes('后端') || a.includes('服务') || b.includes('服务')
  if ((isFE && isBE) && !(a.includes('数据库') || b.includes('数据库'))) return 'collab'
  // 后端 ↔ 数据库 → 依赖
  const isDB = a.includes('数据库') || b.includes('数据库') || a.includes('db') || b.includes('db')
  if ((isBE || isDB) && !isFE) return 'depend'
  // 任何 ↔ AI/智能 → 增强
  if (a.includes('ai') || b.includes('ai') || a.includes('智能') || b.includes('智能') ||
      a.includes('机器学习') || b.includes('机器学习')) return 'enhance'
  // 默认：跨分类但无法推断 → 用协作样式
  return 'collab'
}

// 方案 C：后台手动配置的关系覆盖表，key = "小id-大id"，value = relationType
const relationOverrideMap = computed(() => {
  const map = {}
  ;(props.relations || []).forEach(r => {
    if (!r.sourceSkillId || !r.targetSkillId || !r.relationType) return
    const a = Math.min(r.sourceSkillId, r.targetSkillId)
    const b = Math.max(r.sourceSkillId, r.targetSkillId)
    map[`${a}-${b}`] = r.relationType
  })
  return map
})

// 取两个技能节点之间的关系类型：优先后台配置，否则关键词推断
const resolveRelationType = (nodeA, nodeB) => {
  const sidA = nodeA.skillId, sidB = nodeB.skillId
  if (sidA && sidB) {
    const a = Math.min(sidA, sidB)
    const b = Math.max(sidA, sidB)
    const override = relationOverrideMap.value[`${a}-${b}`]
    if (override) return override
  }
  return inferRelationType(nodeA.category, nodeB.category)
}

// 获取 link 的视觉属性（基于 relationType，若未指定则回退到 source 节点分类色）
const linkStyle = (link) => {
  const rt = RELATION_TYPES[link.relationType] || RELATION_TYPES.same
  const baseColor = rt.color || categoryColor(link.source?.category)
  return {
    stroke: baseColor,
    strokeWidth: rt.strokeWidth,
    strokeDasharray: rt.strokeDash,
    opacity: rt.opacity,
    ...(rt.animate ? { class: 'link-enhanced' } : {})
  }
}

// 内核半径 = 熟练度：R0 × (level / 100)。
// level 0% → 半径 0（只剩固定基准壳）；100% → 填充满整个 R0（实心球）。
const innerRadius = (level) => {
  const v = Math.max(0, Math.min(100, level || 0))
  return BASE_RADIUS * (v / 100)
}

// 使用频率外延：从基准边缘向外延展的厚度 = freqExtend(count)。
// count=0 → 0（无外延）；count 越大外延越厚（封顶 FREQ_MAX，避免碰撞半径暴涨导致重叠）。
const FREQ_MAX = 16
const freqExtend = (count) => {
  const v = Math.max(0, count || 0)
  // 以 count=20 篇为饱和点（博客高频技术约 20 篇），封顶 FREQ_MAX
  const ratio = Math.min(1, v / 20)
  return FREQ_MAX * ratio * ratio // 平方曲线：低频增长慢，高频更突出
}

// 碰撞半径：统一为 R0 + FREQ_MAX（频次外延上限），与节点实际维度无关。
// 这样所有节点碰撞边界一致，力导向收敛后不会因大小差异而重叠。
const collideRadius = () => BASE_RADIUS + FREQ_MAX

// 确定性防重叠后处理：力导向收敛后，几何硬约束保证任意两节点不重叠。
// 两两检测：若圆心距 < 两碰撞半径之和，沿中心连线把较外的节点推开到刚好相切 + gap。
// 迭代多轮（上限 MAX_PASS），直到无重叠或轮次耗尽；这是 100% 不重叠的兜底，不依赖力导向收敛精度。
const MIN_GAP = 4 // 节点间最小空隙（px），避免视觉贴死
const resolveOverlaps = (nodesList) => {
  const cr = collideRadius()
  const need = nodesList.length
  if (need < 2) return
  const MAX_PASS = 60
  for (let pass = 0; pass < MAX_PASS; pass++) {
    let moved = false
    for (let i = 0; i < need; i++) {
      for (let j = i + 1; j < need; j++) {
        const a = nodesList[i]
        const b = nodesList[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let dist = Math.hypot(dx, dy)
        const minDist = cr * 2 + MIN_GAP
        if (dist < minDist) {
          // 防止完全重合（dist=0 时给一个随机微小偏移方向）
          if (dist < 0.01) {
            const ang = (i * 7 + j * 13) % 360 * (Math.PI / 180)
            dx = Math.cos(ang)
            dy = Math.sin(ang)
            dist = 0.01
          } else {
            dx /= dist
            dy /= dist
          }
          const push = (minDist - dist) / 2
          // 各退一半；若在某边界则让另一个多退（由边界钳制兜底）
          a.x -= dx * push
          a.y -= dy * push
          b.x += dx * push
          b.y += dy * push
          moved = true
        }
      }
    }
    if (!moved) break
  }
}

// 名字太长时截断
const shortName = (name) => {
  if (!name) return ''
  // P1-2：截断阈值从 6 放宽到 10，配合描边增强可读性
  return name.length > 10 ? name.slice(0, 9) + '…' : name
}

const mergedNodes = computed(() => {
  const result = []
  const seen = new Set()

  props.skills.forEach(skill => {
    const name = (skill.name || skill.tagName || '').trim()
    if (!name) return
    const key = name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)

    const category = skill.parent_name || skill.parentName || '其他'
    result.push({
      id: skill.id != null ? `skill-${skill.id}` : `tag-${key}`,
      skillId: skill.id != null ? skill.id : null, // 数字技能 id，用于匹配后台关系配置
      name,
      category,
      level: skill.level ?? 0,
      count: skill.article_count || skill.articleCount || 0
    })
  })

  return result
})

// 移动端卡片墙分组：按分类聚合 mergedNodes；分类按中文名称排序，「其他」固定置底（与 categoryColors 排序一致）
const mobileGroups = computed(() => {
  const groupMap = new Map()
  mergedNodes.value.forEach(node => {
    const category = node.category || '其他'
    if (!groupMap.has(category)) groupMap.set(category, [])
    groupMap.get(category).push(node)
  })
  const sortedCategories = [...groupMap.keys()]
    .filter(c => c !== '其他')
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
  if (groupMap.has('其他')) sortedCategories.push('其他')
  return sortedCategories.map(category => ({
    category,
    items: groupMap.get(category)
  }))
})

const tooltipStyle = computed(() => {
  if (!hoverNode.value) return {}
  const r = BASE_RADIUS + freqExtend(hoverNode.value.count)
  let left = hoverNode.value.x + r + 16
  let top = hoverNode.value.y - 40

  // 防止 tooltip 溢出右侧
  if (left + 250 > width.value) {
    left = hoverNode.value.x - r - 266
  }
  // 防止 tooltip 溢出底部
  if (top + 180 > height.value) {
    top = height.value - 180
  }

  return {
    left: `${Math.max(8, left)}px`,
    top: `${Math.max(8, top)}px`
  }
})

// 每个节点不同的漂浮节奏
const floatStyle = (index) => {
  const duration = 4 + (index % 5) * 0.8
  const delay = (index % 7) * -0.6
  return {
    animationDuration: `${duration}s`,
    animationDelay: `${delay}s`
  }
}

// ===== 画布拖拽平移 + 滚轮缩放（P1）=====
// 仅当按下点在空白背景（非节点）时启动拖拽，避免干扰节点 hover/click
const panState = { startX: 0, startY: 0, origTx: 0, origTy: 0, moved: 0 }

const onPanStart = (e) => {
  // 右键/中键不触发；左键仅在 target 是 svg 或 viewport 背景时拖拽
  if (e.button !== 0) return
  const t = e.target
  const isBackground = t === svgRef.value || t.classList?.contains('viewport') || t.tagName === 'svg'
  if (!isBackground) return
  isPanning.value = true
  panState.startX = e.clientX
  panState.startY = e.clientY
  panState.origTx = viewTx.value
  panState.origTy = viewTy.value
  panState.moved = 0
  window.addEventListener('mousemove', onPanMove)
  window.addEventListener('mouseup', onPanEnd)
}

const onPanMove = (e) => {
  if (!isPanning.value) return
  const dx = e.clientX - panState.startX
  const dy = e.clientY - panState.startY
  panState.moved = Math.max(panState.moved, Math.abs(dx), Math.abs(dy))
  viewTx.value = panState.origTx + dx
  viewTy.value = panState.origTy + dy
}

const onPanEnd = () => {
  isPanning.value = false
  window.removeEventListener('mousemove', onPanMove)
  window.removeEventListener('mouseup', onPanEnd)
}

const onWheel = (e) => {
  if (!svgRef.value) return
  const rect = svgRef.value.getBoundingClientRect()
  // 鼠标在 svg 内的坐标（以当前视口变换为基准反算）
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const delta = -e.deltaY * 0.0015
  const newK = Math.max(MIN_K, Math.min(MAX_K, viewK.value * (1 + delta)))
  if (newK === viewK.value) return
  // 以鼠标位置为锚点缩放：保持锚点在缩放前后屏幕位置不变
  const wx = (mx - viewTx.value) / viewK.value
  const wy = (my - viewTy.value) / viewK.value
  viewTx.value = mx - wx * newK
  viewTy.value = my - wy * newK
  viewK.value = newK
}

// 触屏单指拖拽（移动端卡片墙不进此逻辑；仅桌面 SVG 触屏场景）
const touchState = { startX: 0, startY: 0, origTx: 0, origTy: 0, moved: 0, active: false }
const onTouchStart = (e) => {
  if (e.touches.length !== 1) return
  const t = e.target
  const isBackground = t === svgRef.value || t.classList?.contains('viewport') || t.tagName === 'svg'
  if (!isBackground) return
  touchState.active = true
  touchState.startX = e.touches[0].clientX
  touchState.startY = e.touches[0].clientY
  touchState.origTx = viewTx.value
  touchState.origTy = viewTy.value
  touchState.moved = 0
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
}

const onTouchMove = (e) => {
  if (!touchState.active) return
  e.preventDefault()
  const dx = e.touches[0].clientX - touchState.startX
  const dy = e.touches[0].clientY - touchState.startY
  touchState.moved = Math.max(touchState.moved, Math.abs(dx), Math.abs(dy))
  viewTx.value = touchState.origTx + dx
  viewTy.value = touchState.origTy + dy
}

const onTouchEnd = () => {
  touchState.active = false
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onTouchEnd)
}

const resetView = () => {
  viewTx.value = 0
  viewTy.value = 0
  viewK.value = 1
}

const updateSize = () => {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  width.value = rect.width
  // 固定画布高度比例（节点多时靠画布拖拽查看，P2 实现），不随节点数拉伸
  height.value = Math.max(300, Math.min(420, rect.width * 0.4))
}

const runSimulation = () => {
  const rawNodes = mergedNodes.value.map(n => ({ ...n, x: width.value / 2, y: height.value / 2 }))
  if (rawNodes.length === 0 || width.value <= 0 || height.value <= 0) {
    nodes.value = []
    links.value = []
    return
  }

  // 1. 按分类分组，同时生成组内串联 links + 跨分类关联 links
  const linkList = []
  const categoryGroups = {}
  rawNodes.forEach(n => {
    categoryGroups[n.category] = categoryGroups[n.category] || []
    categoryGroups[n.category].push(n)
  })
  // 同分类内相邻节点串联 → relationType: 'same'
  Object.values(categoryGroups).forEach(group => {
    for (let i = 0; i < group.length - 1; i++) {
      linkList.push({ source: group[i], target: group[i + 1], relationType: 'same' })
    }
  })
  // 跨分类关联：取每分类的首节点作为"分类代表"，两两推断关系类型并建 link
  // （避免 O(n²) 全连接爆炸：只连分类代表，数量 = C(分类数,2)，通常 ≤10 条）
  const categories = Object.keys(categoryGroups)
  for (let i = 0; i < categories.length; i++) {
    for (let j = i + 1; j < categories.length; j++) {
      const catA = categories[i], catB = categories[j]
      const repA = categoryGroups[catA][0]
      const repB = categoryGroups[catB][0]
      // 方案 C：优先后台手动配置的关系，否则关键词推断
      const rt = resolveRelationType(repA, repB)
      if (rt === 'same') continue // 同类已在上面处理
      linkList.push({
        source: categoryGroups[catA][0],
        target: categoryGroups[catB][0],
        relationType: rt
      })
    }
  }

  // 2. 计算每个分类的「区域中心」（分类分区布局的主布局）
  // categories 已在上面声明（步骤 1 跨分类 link 处），此处直接用
  const categoryCount = categories.length
  const available = Math.min(width.value, height.value)
  const cx = width.value / 2
  const cy = height.value / 2
  // 区域中心到画布边缘的最小距离，避免中心落在边缘
  const edgeMargin = Math.max(30, available * 0.1)
  // 分类内节点很多（>8）时整体适度放大，给大分类留出空间（上限 1.6 倍）
  const maxGroupSize = Math.max(1, ...categories.map(c => categoryGroups[c].length))
  const regionScale = 1 + Math.min(0.6, Math.max(0, maxGroupSize - 8) * 0.1)

  const clampCenter = (p) => ({
    x: Math.max(edgeMargin, Math.min(width.value - edgeMargin, p.x)),
    y: Math.max(edgeMargin, Math.min(height.value - edgeMargin, p.y))
  })

  const groupCenter = {}
  if (categoryCount === 1) {
    // 单分类：居中
    groupCenter[categories[0]] = clampCenter({ x: cx, y: cy })
  } else if (categoryCount === 2) {
    // 双分类：左右对半分
    const offset = available * 0.23 * regionScale
    groupCenter[categories[0]] = clampCenter({ x: cx - offset, y: cy })
    groupCenter[categories[1]] = clampCenter({ x: cx + offset, y: cy })
  } else if (categoryCount === 3) {
    // 三分类：品字形（上 1 下 2）
    const r = available * 0.25 * regionScale
    groupCenter[categories[0]] = clampCenter({ x: cx, y: cy - r * 0.9 })
    groupCenter[categories[1]] = clampCenter({ x: cx - r * 0.85, y: cy + r * 0.65 })
    groupCenter[categories[2]] = clampCenter({ x: cx + r * 0.85, y: cy + r * 0.65 })
  } else {
    // 四分类及以上：环形均分；分类越多半径越小，分类内节点越多半径略增
    let ringR = available * 0.32 * regionScale
    if (categoryCount > 6) {
      ringR *= Math.max(0.5, 1 - (categoryCount - 6) * 0.06)
    }
    categories.forEach((cat, i) => {
      const angle = (i / categoryCount) * Math.PI * 2 - Math.PI / 2
      groupCenter[cat] = clampCenter({
        x: cx + Math.cos(angle) * ringR,
        y: cy + Math.sin(angle) * ringR
      })
    })
  }

  // 3. 分类分区力导向：强 forceX/Y 把节点拉向自己的分类区域，弱化全局斥力避免挤边
  const simulation = forceSimulation(rawNodes)
    .force('charge', forceManyBody().strength(-90))
    .force('collide', forceCollide().radius(() => collideRadius() + (width.value < 480 ? 16 : 14)).iterations(3))
    .force('x', forceX(d => groupCenter[d.category].x).strength(0.15))
    .force('y', forceY(d => groupCenter[d.category].y).strength(0.25))
    .force('link', forceLink(linkList).id(d => d.id).distance(100).strength(0.25))
    .stop()

  // 4. tick 收敛：由 350 增至 450，保证分区内碰撞充分收敛（节点一般 < 40，性能无压力）
  for (let i = 0; i < 450; i++) simulation.tick()

  // 5. 大分类二次展开：分类内节点 > 8 时围绕区域中心螺旋铺开，再少量 tick 平滑
  const LARGE_GROUP_THRESHOLD = 8
  let needSmooth = false
  categories.forEach(cat => {
    const group = categoryGroups[cat]
    if (group.length <= LARGE_GROUP_THRESHOLD) return
    needSmooth = true
    const center = groupCenter[cat]
    const ringStep = collideRadius() * 2 + MIN_GAP + 4 // 每环间距至少容纳一个完整碰撞直径，避免螺旋本身重叠
    group.forEach((n, i) => {
      const ringIndex = Math.floor(i / 6)
      const angle = ((i % 6) / 6) * Math.PI * 2 + ringIndex * 0.5
      const radius = ringStep * (ringIndex + 1)
      n.x = center.x + Math.cos(angle) * radius
      n.y = center.y + Math.sin(angle) * radius
    })
  })
  if (needSmooth) {
    // 主 tick 跑完后 alpha 已衰减到 ~0，需重新加热补 tick 才能平滑新位置
    simulation.alpha(0.35)
    for (let i = 0; i < 80; i++) simulation.tick()
    // 大分类螺旋展开后可能仍有局部重叠，先解一次
    resolveOverlaps(rawNodes)
  }

  // 6. 边界钳制：margin 由 18 增大到 26（移动端 30），避免节点贴边
  const margin = width.value < 480 ? 30 : 26
  rawNodes.forEach(n => {
    const r = collideRadius() + margin
    n.x = Math.max(r, Math.min(width.value - r, n.x))
    n.y = Math.max(r, Math.min(height.value - r, n.y))
  })

  // 7. 确定性防重叠硬约束（最终兜底）：边界钳制后可能把节点挤回重叠，这里几何化解到完全不重叠
  resolveOverlaps(rawNodes)
  // 解出边界后再次钳制，防止推开时越出画布
  rawNodes.forEach(n => {
    const r = collideRadius() + margin
    n.x = Math.max(r, Math.min(width.value - r, n.x))
    n.y = Math.max(r, Math.min(height.value - r, n.y))
  })

  nodes.value = rawNodes
  links.value = linkList
}

const handleClick = (node) => {
  // 若刚发生拖拽（移动超过阈值），吞掉本次 click，避免误触跳转
  if (panState.moved > DRAG_THRESHOLD || touchState.moved > DRAG_THRESHOLD) return
  if (node.count > 0) {
    goArticles(node.name)
  }
}

const goArticles = (tag) => {
  router.push({ path: '/articles', query: { tagKey: tag } })
}

let resizeTimer = null
const onResize = () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    updateSize()
    runSimulation()
  }, 200)
}

onMounted(() => {
  updateIsMobile()
  updateSize()
  runSimulation()
  window.addEventListener('resize', onResize)
  if (mobileQuery) {
    mobileQuery.addEventListener('change', onMobileChange)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  if (mobileQuery) {
    mobileQuery.removeEventListener('change', onMobileChange)
  }
  // 清理拖拽/缩放的全局监听，防止内存泄漏
  window.removeEventListener('mousemove', onPanMove)
  window.removeEventListener('mouseup', onPanEnd)
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onTouchEnd)
})

watch(() => props.skills, () => {
  runSimulation()
}, { deep: true })
</script>

<style scoped>
.tech-map {
  position: relative;
  width: 100%;
  min-height: 300px;
  border-radius: 12px;
  overflow: hidden;
  background: radial-gradient(ellipse at center, #1e293b 0%, #0f172a 100%);
}

/* P2-2：分类筛选 chip 栏 */
.tech-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 4px 4px;
}
.chip-btn {
  padding: 4px 12px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.5);
  color: #94a3b8;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}
.chip-btn:hover {
  border-color: rgba(34, 211, 238, 0.5);
  color: #e2e8f0;
}
.chip-btn.active {
  background: rgba(34, 211, 238, 0.15);
  border-color: #22d3ee;
  color: #22d3ee;
}

/* P2-2：分类过滤 dimmed 状态 */
.tech-node.filtered,
.tech-node.filtered .node-base,
.tech-node.filtered .node-freq,
.tech-node.filtered .node-inner,
.tech-node.filtered .node-label {
  opacity: 0.12 !important;
  transition: opacity 0.3s ease;
}
.link-filtered {
  opacity: 0.08 !important;
  transition: opacity 0.3s ease;
}

/* 空态 */
.tech-map-empty {
  position: relative;
  z-index: 1;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #94a3b8;
  text-align: center;
  padding: 32px 20px;
}
.tech-map-empty p {
  margin: 0;
  font-size: 15px;
  color: #cbd5e1;
}
.tech-map-empty .empty-hint {
  font-size: 13px;
  color: #64748b;
}
.empty-orbit {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px dashed rgba(34, 211, 238, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}
.orbit-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #22d3ee;
  box-shadow: 0 0 12px rgba(34, 211, 238, 0.6);
}

.tech-map::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 30%, rgba(34, 211, 238, 0.08) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(167, 139, 250, 0.08) 0%, transparent 40%);
  pointer-events: none;
}

.tech-map-svg {
  display: block;
  width: 100%;
  position: relative;
  z-index: 1;
  cursor: grab;
  touch-action: none;
}
.tech-map-svg.is-panning {
  cursor: grabbing;
}

/* 重置视图按钮 */
.reset-btn {
  cursor: pointer;
}
.reset-btn circle {
  fill: rgba(15, 23, 42, 0.7);
  stroke: rgba(148, 163, 184, 0.5);
  stroke-width: 1;
  transition: fill 0.2s ease;
}
.reset-btn:hover circle {
  fill: rgba(34, 211, 238, 0.25);
}
.reset-btn text {
  fill: #cbd5e1;
  font-size: 16px;
  pointer-events: none;
}

/* 连线 - 基础样式（无线型，由 relationType 的 :style 覆盖） */
.tech-link {
  stroke: rgba(148, 163, 184, 0.12);
  stroke-width: 1;
}
.tech-map-svg.has-hover .tech-link {
  opacity: 0.08;
}
/* 与 hover 节点直接相连的连线：保持不透明、加粗到 2、颜色转亮 */
.tech-map-svg.has-hover .tech-link.link-active {
  opacity: 1;
  stroke-width: 2;
  stroke: rgba(226, 232, 240, 0.95);
  filter: drop-shadow(0 0 4px rgba(226, 232, 240, 0.5));
}

.tech-link.link-0 { animation-delay: 0s; }
.tech-link.link-1 { animation-delay: -0.6s; }
.tech-link.link-2 { animation-delay: -1.2s; }
.tech-link.link-3 { animation-delay: -1.8s; }
.tech-link.link-4 { animation-delay: -2.4s; }

@keyframes flow {
  to {
    stroke-dashoffset: -20;
  }
}

/* 节点 */
.tech-node {
  cursor: pointer;
  transition: opacity 0.3s ease, filter 0.3s ease;
}
.tech-node-float {
  animation-name: float;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(var(--float-scale, 1)); }
  25% { transform: translate(2px, -3px) scale(var(--float-scale, 1)); }
  50% { transform: translate(-2px, 2px) scale(var(--float-scale, 1)); }
  75% { transform: translate(3px, 1px) scale(var(--float-scale, 1)); }
}

.tech-node.dimmed {
  opacity: 0.25;
  filter: grayscale(0.6);
}

/* 与 hover 节点直接关联的节点：保持全亮 + 轻微放大（1.05），外环仍按熟练度着色 */
.tech-node.related {
  opacity: 1 !important;
  filter: grayscale(0) !important;
}
.tech-node.related .tech-node-float {
  --float-scale: 1.05;
}

.tech-node:hover,
.tech-node.hovering {
  opacity: 1 !important;
  filter: grayscale(0) !important;
}

.node-base {
  transition: r 0.3s ease, stroke-width 0.3s ease;
}

.node-freq {
  transition: r 0.3s ease, fill-opacity 0.3s ease;
}

.node-inner {
  opacity: 0.95;
  transition: r 0.3s ease;
}

.node-label {
  font-size: 11px;
  font-weight: 600;
  fill: #f8fafc;
  pointer-events: none;
  /* 文字阴影（模糊光晕），比 SVG 描边更柔和自然 */
  text-shadow: 0 1px 4px rgba(15, 23, 42, 0.8), 0 0 2px rgba(15, 23, 42, 0.6);
}

/* 悬停卡片 */
.tech-tooltip {
  position: absolute;
  width: 240px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 10px;
  padding: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  pointer-events: auto;
  z-index: 10;
  color: #e2e8f0;
  backdrop-filter: blur(8px);
}
.tooltip-title {
  font-size: 15px;
  font-weight: 700;
  color: #f8fafc;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tooltip-category {
  font-size: 11px;
  font-weight: 500;
  color: #cbd5e1;
  background: rgba(148, 163, 184, 0.2);
  padding: 2px 8px;
  border-radius: 12px;
}
.tooltip-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 13px;
  color: #cbd5e1;
}
.tooltip-label {
  width: 56px;
  flex-shrink: 0;
}
.tooltip-count {
  font-weight: 600;
  color: #f8fafc;
}
.tooltip-desc {
  margin-top: 6px;
  font-size: 12px;
  color: #cbd5e1;
  line-height: 1.5;
  max-width: 220px;
}
.tooltip-action {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(148, 163, 184, 0.15);
}
.tooltip-empty {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(148, 163, 184, 0.15);
  font-size: 12px;
  color: #94a3b8;
}

/* 图例 */
.tech-legend {
  /* P1-3：从 absolute 右上角改为画布下方正常流，不再遮挡节点 */
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding: 10px 4px;
  font-size: 12px;
  color: #94a3b8;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.legend-ring {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #22d3ee;
  display: inline-block;
  box-shadow: 0 0 6px rgba(34, 211, 238, 0.5);
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22d3ee;
  display: inline-block;
  box-shadow: 0 0 6px rgba(34, 211, 238, 0.5);
}
.legend-freq {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(34, 211, 238, 0.12);
  border: 2px solid rgba(34, 211, 238, 0.5);
  display: inline-block;
}

/* 关系类型图例 */
.legend-sep {
  width: 1px;
  height: 20px;
  background: rgba(148, 163, 184, 0.25);
  margin: 0 6px;
}
.legend-link {
  width: 24px;
  height: 0;
  display: inline-block;
  vertical-align: middle;
  margin-right: 2px;
}
.legend-link-same {
  border-top: 2px solid rgba(148, 163, 184, 0.3);
}
.legend-link-collab {
  border-top: 2px dashed rgba(34, 211, 238, 0.5);
  opacity: 0.7;
}
.legend-link-depend {
  border-top: 2px dotted rgba(167, 139, 250, 0.5);
  opacity: 0.7;
}
.legend-link-enhance {
  border-top: 2px solid rgba(251, 191, 36, 0.55);
  /* 用 background 模拟点划线（CSS border-style 无原生 dash-dot） */
  background: repeating-linear-gradient(
    90deg,
    rgba(251, 191, 36, 0.55) 0px,
    rgba(251, 191, 36, 0.55) 10px,
    transparent 10px,
    transparent 14px,
    rgba(251, 191, 36, 0.55) 14px,
    rgba(251, 191, 36, 0.55) 16px,
    transparent 16px,
    transparent 20px
  );
  background-size: 20px 100%;
  border-top: none;
  height: 2px;
  opacity: 0.75;
}

/* link 按 relationType 的额外动画（P2-3 粒子流光） */
.rt-enhance.tech-link {
  animation: pulse-glow 3s ease-in-out infinite, flow-light 4s linear infinite;
}
@keyframes pulse-glow {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.65; }
}
/* P2-3：粒子流光 —— stroke-dashoffset 从 0 到负值循环，产生亮点沿路径流动的视觉效果 */
@keyframes flow-light {
  to {
    stroke-dashoffset: -20;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ===== 移动端分类卡片墙（isMobile = true 时渲染，断点 ≤768px） ===== */
.tech-map-mobile {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 14px 20px;
}
.mobile-category-card {
  background: linear-gradient(160deg, rgba(30, 41, 59, 0.82) 0%, rgba(15, 23, 42, 0.92) 100%);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 14px;
  padding: 14px 14px 16px;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.mobile-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.mobile-card-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.mobile-card-title {
  font-size: 16px;
  font-weight: 700;
  color: #f8fafc;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mobile-card-count {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 12px;
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.15);
  padding: 3px 10px;
  border-radius: 12px;
}
.mobile-chip-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mobile-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 38px; /* 触控目标 ≥ 36px */
  padding: 8px 12px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 10px;
  color: #e2e8f0;
  font-size: 14px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.2s ease, border-color 0.2s ease;
}
.mobile-chip:active {
  background: rgba(34, 211, 238, 0.12);
  border-color: rgba(34, 211, 238, 0.5);
}
.mobile-chip.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.mobile-chip-name {
  min-width: 0;
  font-weight: 600;
  color: #f8fafc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mobile-chip-level {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.mobile-chip-level-bar {
  flex: 1;
  height: 5px;
  min-width: 36px;
  border-radius: 3px;
  background: rgba(148, 163, 184, 0.25);
  overflow: hidden;
}
.mobile-chip-level-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}
.mobile-chip-level-text {
  flex-shrink: 0;
  width: 36px;
  text-align: right;
  font-size: 11px;
  color: #cbd5e1;
  font-variant-numeric: tabular-nums;
}
.mobile-chip-count {
  flex-shrink: 0;
  min-width: 58px;
  text-align: right;
  font-size: 11px;
  color: #94a3b8;
}
</style>
