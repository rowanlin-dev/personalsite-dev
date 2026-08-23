<template>
  <el-dialog
    :model-value="props.visible"
    title="加入合集"
    width="560px"
    top="8vh"
    :close-on-click-modal="false"
    @update:model-value="(v) => { if (!v) emit('update:visible', false) }"
  >
    <div class="cp-body">
      <!-- 内联新建合集表单 -->
      <div v-if="showCreate" class="cp-create">
        <el-input
          v-model="newName"
          placeholder="合集名称（必填，唯一）"
          maxlength="60"
          show-word-limit
          @keyup.enter="submitCreate"
        />
        <el-input
          v-model="newDesc"
          class="cp-create-desc"
          placeholder="描述（可选）"
          maxlength="255"
          show-word-limit
        />
        <div class="cp-create-row">
          <el-switch v-model="newPublic" active-text="公开" inactive-text="私有" />
          <div class="cp-create-actions">
            <el-button size="small" @click="cancelCreate">取消</el-button>
            <el-button size="small" type="primary" :loading="creating" @click="submitCreate">创建并关联</el-button>
          </div>
        </div>
      </div>

      <div v-else class="cp-toolbar">
        <span class="cp-count">已选 {{ selectedIds.length }} 个合集</span>
        <el-button size="small" type="primary" plain @click="showCreate = true">新建合集</el-button>
      </div>

      <div v-if="loading" class="cp-empty">加载中…</div>
      <div v-else-if="collections.length === 0" class="cp-empty">
        暂无合集，点击「新建合集」创建后自动关联当前文章
      </div>

      <el-scrollbar v-else max-height="320px" class="cp-list">
        <div v-for="c in collections" :key="c.id" class="cp-item">
          <el-checkbox
            :model-value="selectedIds.includes(c.id)"
            @change="(val) => onToggle(c.id, val)"
          >
            <span class="cp-name">{{ c.name }}</span>
            <el-tag v-if="c.isPublic === false" size="small" type="warning" effect="plain">私有</el-tag>
            <span class="cp-meta">{{ c.articleCount || 0 }} 篇</span>
          </el-checkbox>
        </div>
      </el-scrollbar>
    </div>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="onConfirm">完成</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getCollections,
  createCollection,
  addArticlesToCollection,
  removeArticleFromCollection
} from '../../api/collection'
import { getArticleInfo } from '../../api/article'

const props = defineProps({
  visible: { type: Boolean, default: false },
  articleId: { type: [Number, String], default: null }
})
const emit = defineEmits(['update:visible', 'confirm'])

const collections = ref([])
const selectedIds = ref([])
const loading = ref(false)

const showCreate = ref(false)
const newName = ref('')
const newDesc = ref('')
const newPublic = ref(true)
const creating = ref(false)

// 打开弹窗：加载合集列表 + 预勾该文已属（公开）合集
watch(() => props.visible, async (open) => {
  if (open) {
    showCreate.value = false
    selectedIds.value = []
    await loadCollections()
    if (props.articleId) {
      try {
        const info = await getArticleInfo(props.articleId)
        const cols = (info?.data?.collections || []).map(c => c.id)
        selectedIds.value = cols
      } catch (e) {
        // 预勾失败非致命：保持空选，用户手动勾选
      }
    }
  }
})

const loadCollections = async () => {
  loading.value = true
  try {
    collections.value = await getCollections()
  } catch (e) {
    collections.value = []
    ElMessage.error('加载合集失败')
  } finally {
    loading.value = false
  }
}

// 勾选/取消即时调关联接口（乐观更新）
const onToggle = async (collectionId, checked) => {
  const already = selectedIds.value.includes(collectionId)
  if (checked && !already) {
    selectedIds.value = [...selectedIds.value, collectionId]
    try {
      await addArticlesToCollection(collectionId, [Number(props.articleId)])
    } catch (e) {
      selectedIds.value = selectedIds.value.filter(x => x !== collectionId)
      ElMessage.error('加入合集失败')
    }
  } else if (!checked && already) {
    selectedIds.value = selectedIds.value.filter(x => x !== collectionId)
    try {
      await removeArticleFromCollection(collectionId, Number(props.articleId))
    } catch (e) {
      selectedIds.value = [...selectedIds.value, collectionId]
      ElMessage.error('移出合集失败')
    }
  }
}

const cancelCreate = () => {
  showCreate.value = false
  newName.value = ''
  newDesc.value = ''
  newPublic.value = true
}

// 内联新建：创建后自动勾选并加入当前文章
const submitCreate = async () => {
  const name = (newName.value || '').trim()
  if (!name) {
    ElMessage.warning('请输入合集名称')
    return
  }
  creating.value = true
  try {
    const created = await createCollection({
      name,
      description: newDesc.value || undefined,
      isPublic: newPublic.value
    })
    if (created && created.id) {
      if (!selectedIds.value.includes(created.id)) {
        selectedIds.value = [...selectedIds.value, created.id]
      }
      if (props.articleId) {
        await addArticlesToCollection(created.id, [Number(props.articleId)])
      }
      ElMessage.success('合集已创建并关联')
    }
    cancelCreate()
    await loadCollections()
  } catch (e) {
    // 重名等已由后端拦截（request 拦截器已弹「合集名已存在」）
  } finally {
    creating.value = false
  }
}

const onConfirm = () => {
  emit('confirm', selectedIds.value)
  emit('update:visible', false)
}
</script>

<style scoped>
.cp-body {
  min-height: 120px;
}
.cp-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.cp-count {
  color: #909399;
  font-size: 13px;
}
.cp-empty {
  color: #909399;
  text-align: center;
  padding: 40px 0;
  font-size: 14px;
}
.cp-list {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 4px 8px;
}
.cp-item {
  border-bottom: 1px solid #f2f4f7;
}
.cp-item:last-child {
  border-bottom: none;
}
.cp-name {
  font-weight: 600;
  margin-right: 8px;
}
.cp-meta {
  color: #909399;
  font-size: 12px;
  margin-left: 8px;
}
.cp-create {
  background: #f7f8fa;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.cp-create-desc {
  margin-top: 10px;
}
.cp-create-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}
.cp-create-actions {
  display: flex;
  gap: 8px;
}
</style>
