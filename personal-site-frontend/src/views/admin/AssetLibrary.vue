<template>
  <div class="asset-library">
    <!-- 窄屏：用抽屉收纳分类树 -->
    <el-drawer v-model="drawerVisible" title="分类" direction="ltr" size="70%">
      <el-tree
        :data="treeData"
        :props="treeProps"
        node-key="id"
        :expand-on-click-node="false"
        default-expand-all
        highlight-current
        @node-click="onNodeClick"
      >
        <template #default="{ node, data }">
          <span class="tree-node">
            <span>{{ node.label }}</span>
            <el-button
              v-if="data.dynamic && data.prefix"
              class="tree-del"
              size="small"
              type="danger"
              text
              @click.stop="cascadeDeleteNode(data)"
            >级联删</el-button>
          </span>
        </template>
      </el-tree>
    </el-drawer>

    <div class="al-body">
      <!-- 宽屏左侧分类树 -->
      <aside v-if="!isNarrow" class="al-aside">
        <el-tree
          :data="treeData"
          :props="treeProps"
          node-key="id"
          :expand-on-click-node="false"
          default-expand-all
          highlight-current
          @node-click="onNodeClick"
        >
          <template #default="{ node, data }">
            <span class="tree-node">
              <span>{{ node.label }}</span>
              <el-button
                v-if="data.dynamic && data.prefix"
                class="tree-del"
                size="small"
                type="danger"
                text
                @click.stop="cascadeDeleteNode(data)"
              >级联删</el-button>
            </span>
          </template>
        </el-tree>
      </aside>

      <section class="al-main">
        <!-- 顶栏 -->
        <div class="al-toolbar">
          <el-button v-if="isNarrow" @click="drawerVisible = true">
            <el-icon><Menu /></el-icon> 分类
          </el-button>

          <template v-if="!isNarrow">
            <el-input
              v-model="searchText"
              placeholder="按文件名搜索"
              clearable
              style="width: 220px"
              @clear="searchText = ''"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-upload
              :http-request="handleUpload"
              :show-file-list="false"
              :disabled="!currentPrefix"
              multiple
            >
              <el-button type="primary" :disabled="!currentPrefix">
                <el-icon><Upload /></el-icon> 上传到当前分类
              </el-button>
            </el-upload>
            <el-button :disabled="!filteredItems.length" @click="toggleSelectAll">
              {{ allSelected ? '取消全选' : '全选' }}
            </el-button>
            <el-button
              type="danger"
              :disabled="!selectedKeys.length"
              @click="deleteSelected"
            >
              <el-icon><Delete /></el-icon> 删除选中 ({{ selectedKeys.length }})
            </el-button>
            <el-button
              v-if="currentNode && currentNode.dynamic && currentNode.prefix"
              type="danger"
              text
              @click="cascadeDeleteNode(currentNode)"
            >级联删除本分类</el-button>
          </template>

          <!-- 窄屏：操作收进「更多」 -->
          <el-dropdown v-else trigger="click" @command="onMoreCommand">
            <el-button>更多<el-icon><ArrowDown /></el-icon></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="search">
                  <el-icon><Search /></el-icon> 搜索
                </el-dropdown-item>
                <el-dropdown-item command="upload" :disabled="!currentPrefix">
                  <el-icon><Upload /></el-icon> 上传
                </el-dropdown-item>
                <el-dropdown-item command="selectAll" :disabled="!filteredItems.length">
                  全选/取消
                </el-dropdown-item>
                <el-dropdown-item command="deleteSelected" :disabled="!selectedKeys.length" divided>
                  <el-icon><Delete /></el-icon> 删除选中 ({{ selectedKeys.length }})
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- 窄屏搜索框（更多里点开时显示） -->
        <el-input
          v-if="isNarrow && showSearch"
          v-model="searchText"
          placeholder="按文件名搜索"
          clearable
          style="margin-bottom: 12px"
          @clear="searchText = ''"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>

        <!-- 窄屏「更多」上传依赖此隐藏上传控件 -->
        <el-upload
          ref="uploadRef"
          :http-request="handleUpload"
          :show-file-list="false"
          multiple
          style="display: none"
        >
          <el-button>上传</el-button>
        </el-upload>

        <div v-if="!currentPrefix" class="al-empty">请选择左侧分类查看素材</div>
        <div v-else-if="!filteredItems.length" class="al-empty">该分类下暂无素材</div>

        <el-row v-else :gutter="12" class="al-grid">
          <el-col
            v-for="item in filteredItems"
            :key="item.key"
            :xs="12"
            :sm="8"
            :md="6"
            :lg="4"
          >
            <div class="al-card" :class="{ selected: selectedKeys.includes(item.key) }">
              <el-checkbox
                class="al-check"
                :model-value="selectedKeys.includes(item.key)"
                @change="(val) => toggleItem(item.key, val)"
              />
              <el-image
                :src="item.url"
                fit="cover"
                class="al-thumb"
                :preview-src-list="filteredItems.map(i => i.url)"
                :initial-index="filteredItems.indexOf(item)"
                hide-on-click-modal
              />
              <div class="al-meta">
                <div class="al-name" :title="fileName(item.key)">{{ fileName(item.key) }}</div>
                <div class="al-sub">{{ formatSize(item.size) }} · {{ formatTime(item.lastModified) }}</div>
                <div class="al-owner" v-if="item.owner">归属：{{ item.owner }}</div>
              </div>
              <!-- 窄屏/宽屏卡片按钮均常驻可见，不依赖 hover -->
              <div class="al-actions">
                <el-button size="small" type="primary" @click="pick(item)">选用</el-button>
                <el-button size="small" type="danger" @click="deleteOne(item)">删除</el-button>
              </div>
            </div>
          </el-col>
        </el-row>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, h } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElCheckbox } from 'element-plus'
import { getArticleList } from '../../api/article'
import { getProjectList } from '../../api/project'
import { useAssetsStore } from '../../store/assets'
import { useAdminStore } from '../../store/admin'

const router = useRouter()
const assetsStore = useAssetsStore()
const adminStore = useAdminStore()

const uploadRef = ref(null)

const treeProps = { label: 'label', children: 'children' }
const treeData = ref([])
const blogList = ref([])
const projectList = ref([])
const currentNode = ref(null)
const searchText = ref('')
const drawerVisible = ref(false)
const showSearch = ref(false)
const isNarrow = ref(false)

const zones = computed(() => assetsStore.zones)
const currentPrefix = computed(() => assetsStore.currentPrefix)
const items = computed(() => assetsStore.items)
const selectedKeys = computed(() => assetsStore.selectedKeys)

const filteredItems = computed(() => {
  const kw = searchText.value.trim().toLowerCase()
  if (!kw) return items.value
  return items.value.filter(i => fileName(i.key).toLowerCase().includes(kw))
})

const allSelected = computed(() =>
  filteredItems.value.length > 0 &&
  filteredItems.value.every(i => selectedKeys.value.includes(i.key))
)

// 强制改密拦截：沿用现有模式，命中则交由 Layout 弹出改密表单
const handleForcedChange = (err) => {
  const status = err?.response?.status
  const code = err?.response?.data?.code
  if (status === 403 && code === 'MUST_CHANGE_CREDENTIALS') {
    adminStore.setForceChange(true)
    return true
  }
  return false
}

const fileName = (key) => {
  if (!key) return ''
  const parts = key.split('/')
  return parts[parts.length - 1] || key
}

const formatSize = (bytes) => {
  if (bytes == null) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

const formatTime = (ts) => {
  if (!ts) return '-'
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts)
  if (isNaN(d.getTime())) return '-'
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const buildTree = () => {
  const groups = {}
  const ensureGroup = (name) => {
    if (!groups[name]) groups[name] = { id: 'g:' + name, label: name, children: [] }
    return groups[name]
  }
  for (const z of zones.value) {
    const g = ensureGroup(z.group)
    if (!z.dynamic) {
      g.children.push({ id: 'z:' + z.key, label: z.label, prefix: z.key, dynamic: false })
    } else if (z.source === 'blogs') {
      for (const b of blogList.value) {
        const slug = b.slug || b.id
        g.children.push({
          id: 'b:' + slug,
          label: b.title || ('博客 ' + slug),
          prefix: z.key + slug + '/',
          dynamic: true
        })
      }
    } else if (z.source === 'projects') {
      for (const p of projectList.value) {
        const slug = p.slug || p.id
        g.children.push({
          id: 'p:' + slug,
          label: p.title || ('项目 ' + slug),
          prefix: z.key + slug + '/',
          dynamic: true
        })
      }
    }
  }
  treeData.value = Object.values(groups)
}

const onNodeClick = async (node) => {
  if (!node.prefix) return // 仅叶子节点（带前缀）触发列表
  currentNode.value = node
  try {
    await assetsStore.loadItems(node.prefix)
  } catch (e) {
    if (!handleForcedChange(e)) ElMessage.error('加载素材失败')
  }
}

const handleUpload = async (options) => {
  try {
    await assetsStore.upload(currentPrefix.value, [options.file])
    ElMessage.success('上传成功')
  } catch (e) {
    if (!handleForcedChange(e)) ElMessage.error('上传失败')
  }
  options.onSuccess && options.onSuccess()
}

const toggleItem = (key, val) => {
  const set = new Set(assetsStore.selectedKeys)
  if (val) set.add(key)
  else set.delete(key)
  assetsStore.selectedKeys.splice(0, assetsStore.selectedKeys.length, ...set)
}

const toggleSelectAll = () => {
  if (allSelected.value) {
    assetsStore.selectedKeys.splice(0, assetsStore.selectedKeys.length)
  } else {
    assetsStore.selectedKeys.splice(0, assetsStore.selectedKeys.length, ...filteredItems.value.map(i => i.key))
  }
}

// 单张删除：warning 级确认
const deleteOne = async (item) => {
  try {
    await ElMessageBox.confirm(`确认删除「${fileName(item.key)}」？`, '删除素材', { type: 'warning' })
  } catch (e) {
    return
  }
  try {
    await assetsStore.remove([item.key])
    ElMessage.success('已删除')
  } catch (e) {
    if (!handleForcedChange(e)) ElMessage.error('删除失败')
  }
}

// 多选删除：error 级 + 勾选确认
const deleteSelected = async () => {
  const keys = [...assetsStore.selectedKeys]
  if (!keys.length) return
  await cascadeConfirm(keys, '删除选中的 ' + keys.length + ' 个文件')
}

// 级联删除整个 blog/project 分类：列出该前缀下全部 key
const cascadeDeleteNode = async (node) => {
  if (!node.prefix) return
  let keys = []
  try {
    keys = (await assetsStore.loadItems(node.prefix)).map(i => i.key)
  } catch (e) {
    if (!handleForcedChange(e)) ElMessage.error('加载文件清单失败')
    return
  }
  if (!keys.length) {
    ElMessage.info('该分类下没有文件')
    return
  }
  await cascadeConfirm(keys, `级联删除「${node.label}」下的 ${keys.length} 个文件`)
}

// 通用级联确认：必须勾选「已知悉」确认按钮才可点
const cascadeConfirm = async (keys, title) => {
  const ackRef = { value: false }
  try {
    await ElMessageBox({
      title,
      type: 'error',
      message: () =>
        h('div', [
          h('p', '此操作将一并删除以下文件，且不可恢复：'),
          h('ul', { style: 'max-height:200px;overflow:auto;color:#f56c6c;font-size:12px;padding-left:18px' },
            keys.slice(0, 200).map(k => h('li', fileName(k)))
          ),
          keys.length > 200 ? h('p', `…等共 ${keys.length} 个文件`) : null,
          h('label', { style: 'display:flex;align-items:center;gap:6px;margin-top:12px' }, [
            h(ElCheckbox, {
              modelValue: ackRef.value,
              'onUpdate:modelValue': (v) => { ackRef.value = v },
              disabled: false
            }),
            h('span', '已知悉将一并删除以上 ' + keys.length + ' 个文件')
          ])
        ]),
      showCancelButton: true,
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      beforeClose: (action, instance, done) => {
        if (action === 'confirm' && !ackRef.value) {
          ElMessage.warning('请先勾选「已知悉」')
          return
        }
        done()
      }
    })
  } catch (e) {
    return
  }
  try {
    await assetsStore.remove(keys)
    ElMessage.success('已删除 ' + keys.length + ' 个文件')
  } catch (e) {
    if (!handleForcedChange(e)) ElMessage.error('删除失败')
  }
}

// 选用：写入公开 URL 并返回编辑页
const pick = async (item) => {
  let url = item.url
  // 私密前缀（resume）需签名
  if (currentPrefix.value.startsWith('assets/private') && item.key) {
    try {
      url = await assetsStore.sign(item.key)
    } catch (e) {
      if (handleForcedChange(e)) return
      ElMessage.error('获取访问链接失败')
      return
    }
  }
  assetsStore.setLastPickedUrl(url)
  router.back()
}

const onMoreCommand = (cmd) => {
  if (cmd === 'search') showSearch.value = !showSearch.value
  else if (cmd === 'upload') uploadRef.value?.$el?.querySelector('.el-upload__input')?.click()
  else if (cmd === 'selectAll') toggleSelectAll()
  else if (cmd === 'deleteSelected') deleteSelected()
}

const onResize = () => {
  isNarrow.value = window.innerWidth <= 768
}
window.addEventListener('resize', onResize)

onMounted(async () => {
  onResize()
  try {
    const [z, b, p] = await Promise.all([
      assetsStore.loadZones(),
      getArticleList({ page: 1, size: 1000 }).catch(() => null),
      getProjectList({ page: 1, size: 1000 }).catch(() => null)
    ])
    zones.value // 已在 store
    blogList.value = (b && b.data && b.data.list) || []
    projectList.value = (p && p.data && p.data.list) || []
    buildTree()
  } catch (e) {
    if (!handleForcedChange(e)) ElMessage.error('初始化素材库失败')
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.asset-library {
  height: 100%;
}
.al-body {
  display: flex;
  gap: 16px;
  height: 100%;
}
.al-aside {
  width: 240px;
  flex: none;
  border-right: 1px solid #e4e7ed;
  padding-right: 8px;
  overflow: auto;
}
.al-main {
  flex: 1;
  min-width: 0;
}
.al-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.tree-del {
  margin-left: 8px;
}
.al-empty {
  color: #909399;
  text-align: center;
  padding: 60px 0;
}
.al-grid {
  margin-top: 4px;
}
.al-card {
  position: relative;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  padding: 8px;
  margin-bottom: 12px;
  background: #fff;
}
.al-card.selected {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}
.al-check {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
}
.al-thumb {
  width: 100%;
  height: 120px;
  border-radius: 6px;
  background: #f5f7fa;
  display: block;
}
.al-meta {
  margin-top: 6px;
}
.al-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.al-sub {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}
.al-owner {
  font-size: 12px;
  color: #67c23a;
  margin-top: 2px;
}
.al-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
</style>
