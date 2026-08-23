<template>
  <el-dialog
    :model-value="props.visible"
    title="素材库选图"
    width="72%"
    top="5vh"
    :close-on-click-modal="false"
    @update:model-value="(v) => { if (!v) emit('update:visible', false) }"
  >
    <div class="ap-body">
      <!-- 分区选择：只列 public 分区 -->
      <div class="ap-toolbar">
        <el-select
          v-model="currentPrefix"
          placeholder="选择分区"
          style="width: 260px"
          @change="onZoneChange"
        >
          <el-option
            v-for="z in publicZones"
            :key="z.key"
            :label="z.label"
            :value="z.key"
          />
        </el-select>

        <el-upload
          :http-request="handleUpload"
          :show-file-list="false"
          :disabled="!currentPrefix"
          multiple
        >
          <el-button type="primary" :disabled="!currentPrefix">
            上传到当前分区
          </el-button>
        </el-upload>

        <el-button :disabled="!items.length" @click="toggleSelectAll">
          {{ allSelected ? '取消全选' : '全选' }}
        </el-button>

        <span class="ap-count">已选 {{ selectedKeys.length }}</span>
      </div>

      <div v-if="!currentPrefix" class="ap-empty">请选择上方分区查看素材</div>
      <div v-else-if="!items.length" class="ap-empty">该分区下暂无素材</div>

      <el-row v-else :gutter="12" class="ap-grid">
        <el-col
          v-for="item in items"
          :key="item.key"
          :xs="12"
          :sm="8"
          :md="6"
          :lg="4"
        >
          <div class="ap-card" :class="{ selected: selectedKeys.includes(item.key) }">
            <el-checkbox
              class="ap-check"
              :model-value="selectedKeys.includes(item.key)"
              @change="(val) => toggleItem(item.key, val)"
            />
            <el-image
              :src="item.url"
              fit="cover"
              class="ap-thumb"
              :preview-src-list="items.map(i => i.url)"
              :initial-index="items.indexOf(item)"
              hide-on-click-modal
            />
            <div class="ap-name" :title="fileName(item.key)">{{ fileName(item.key) }}</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :disabled="!selectedKeys.length" @click="onConfirm">
        确认插入 ({{ selectedKeys.length }})
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAssetsStore } from '../../store/assets'

const props = defineProps({
  visible: { type: Boolean, default: false },
  multiple: { type: Boolean, default: true }
})
const emit = defineEmits(['update:visible', 'confirm'])

const assetsStore = useAssetsStore()

// 本地选中态，避免与素材库页面的 store.selectedKeys 互相干扰
const selectedKeys = ref([])
const currentPrefix = ref('')

const zones = computed(() => assetsStore.zones || [])
const items = computed(() => assetsStore.items || [])

// 仅列出 public 分区（私密前缀 assets/private 不展示）
const publicZones = computed(() =>
  zones.value.filter(z => !String(z.key || '').startsWith('assets/private'))
)

const allSelected = computed(() =>
  items.value.length > 0 && items.value.every(i => selectedKeys.value.includes(i.key))
)

const fileName = (key) => {
  if (!key) return ''
  const parts = key.split('/')
  return parts[parts.length - 1] || key
}

const toggleItem = (key, val) => {
  const set = new Set(selectedKeys.value)
  if (val) {
    if (props.multiple) {
      set.add(key)
    } else {
      set.clear()
      set.add(key) // 单选：替换
    }
  } else {
    set.delete(key)
  }
  selectedKeys.value = [...set]
}

const toggleSelectAll = () => {
  if (!props.multiple) return
  selectedKeys.value = allSelected.value ? [] : items.value.map(i => i.key)
}

const onZoneChange = (prefix) => {
  selectedKeys.value = []
  assetsStore.loadItems(prefix).catch(() => ElMessage.error('加载素材失败'))
}

const handleUpload = async (options) => {
  try {
    await assetsStore.upload(currentPrefix.value, [options.file])
    ElMessage.success('上传成功')
  } catch (e) {
    ElMessage.error('上传失败')
  }
  options.onSuccess && options.onSuccess()
}

// 确认插入：收集选中项的 url（私密分区需签名）
const onConfirm = async () => {
  const urls = []
  const isPrivate = String(currentPrefix.value || '').startsWith('assets/private/')
  for (const key of selectedKeys.value) {
    const item = items.value.find(i => i.key === key)
    if (!item) continue
    let url = item.url
    if (isPrivate && key) {
      try {
        url = await assetsStore.sign(key)
      } catch (e) {
        continue
      }
    }
    urls.push(url)
  }
  emit('confirm', urls)
  emit('update:visible', false)
}

// 打开弹窗时加载分区与第一个 public 分区内容
watch(() => props.visible, async (open) => {
  if (open) {
    try {
      await assetsStore.loadZones()
    } catch (e) {
      ElMessage.error('加载分区失败')
    }
    const first = publicZones.value[0]
    if (first) {
      currentPrefix.value = first.key
      selectedKeys.value = []
      try {
        await assetsStore.loadItems(first.key)
      } catch (e) {
        ElMessage.error('加载素材失败')
      }
    }
  } else {
    selectedKeys.value = []
  }
})
</script>

<style scoped>
.ap-body {
  min-height: 320px;
}
.ap-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.ap-count {
  color: #909399;
  font-size: 13px;
}
.ap-empty {
  color: #909399;
  text-align: center;
  padding: 60px 0;
}
.ap-grid {
  margin-top: 4px;
}
.ap-card {
  position: relative;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  padding: 8px;
  margin-bottom: 12px;
  background: #fff;
}
.ap-card.selected {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}
.ap-check {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
}
.ap-thumb {
  width: 100%;
  height: 120px;
  border-radius: 6px;
  background: #f5f7fa;
  display: block;
}
.ap-name {
  font-size: 13px;
  font-weight: 600;
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
