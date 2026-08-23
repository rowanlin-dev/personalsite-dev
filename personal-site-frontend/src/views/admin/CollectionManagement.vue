<template>
  <div>
    <el-card>
      <template #header>
        <span>合集管理</span>
        <el-button type="primary" @click="openCreate">新增合集</el-button>
      </template>

      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip />
        <el-table-column label="封面" width="90">
          <template #default="scope">
            <el-image
              v-if="scope.row.coverImage"
              :src="scope.row.coverImage"
              fit="cover"
              style="width: 56px; height: 40px; border-radius: 4px"
              :preview-src-list="[scope.row.coverImage]"
              hide-on-click-modal
            />
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="公开" width="80">
          <template #default="scope">
            <el-tag v-if="scope.row.isPublic !== false" size="small" type="success" effect="plain">公开</el-tag>
            <el-tag v-else size="small" type="warning" effect="plain">私有</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="articleCount" label="篇数" width="70" />
        <el-table-column label="更新时间" width="170">
          <template #default="scope">{{ formatDate(scope.row.updateTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="openManage(scope.row)">管理博客</el-button>
            <el-button size="small" @click="openEdit(scope.row)">重命名</el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建 / 重命名 弹窗 -->
    <el-dialog v-model="formVisible" :title="form.id ? '重命名合集' : '新增合集'" width="480px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" maxlength="60" show-word-limit placeholder="合集名称（唯一）" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="255" show-word-limit />
        </el-form-item>
        <el-form-item label="封面图">
          <el-input v-model="form.coverImage" placeholder="公开图片 URL（不传则留空）" />
        </el-form-item>
        <el-form-item label="公开">
          <el-switch v-model="form.isPublic" active-text="公开" inactive-text="私有" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <!-- 管理博客 弹窗 -->
    <el-dialog v-model="manageVisible" title="管理博客" width="760px" top="5vh">
      <div v-if="manageTarget" class="cm">
        <!-- 合集内文章（可排序） -->
        <div class="cm-section">
          <div class="cm-title">
            合集内文章（{{ manageArticles.length }}）
            <span class="muted">上移/下移调整顺序</span>
          </div>
          <div v-if="manageArticles.length === 0" class="cm-empty">暂无文章，从下方添加</div>
          <el-scrollbar v-else max-height="240px">
            <div v-for="(a, idx) in manageArticles" :key="a.id" class="cm-row">
              <span class="cm-idx">{{ idx + 1 }}</span>
              <span class="cm-art-title">{{ a.title }}</span>
              <div class="cm-row-actions">
                <el-button size="small" :disabled="idx === 0" @click="move(idx, -1)">上移</el-button>
                <el-button size="small" :disabled="idx === manageArticles.length - 1" @click="move(idx, 1)">下移</el-button>
                <el-button size="small" type="danger" @click="removeFromCollection(a.id)">移除</el-button>
              </div>
            </div>
          </el-scrollbar>
        </div>

        <!-- 添加文章（搜索 + 分页 + 勾选） -->
        <div class="cm-section">
          <div class="cm-title">添加文章</div>
          <div class="cm-search">
            <el-input
              v-model="searchQuery.titleKey"
              placeholder="搜索文章标题"
              clearable
              style="width: 240px"
              @keyup.enter="loadSearch"
              @clear="loadSearch"
            >
              <template #append>
                <el-button @click="loadSearch"><el-icon><Search /></el-icon></el-button>
              </template>
            </el-input>
          </div>
          <el-table :data="searchList" stripe size="small" v-loading="searchLoading">
            <el-table-column width="50">
              <template #default="scope">
                <el-checkbox
                  :model-value="inCollection(scope.row.id)"
                  @change="(val) => toggleSearch(scope.row, val)"
                />
              </template>
            </el-table-column>
            <el-table-column prop="title" label="标题" show-overflow-tooltip />
            <el-table-column prop="viewCount" label="阅读" width="70" />
          </el-table>
          <el-pagination
            v-model:current-page="searchQuery.page"
            v-model:page-size="searchQuery.size"
            :total="searchTotal"
            layout="prev, pager, next"
            @change="loadSearch"
            style="margin-top: 12px; justify-content: center"
          />
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="manageVisible = false">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getCollections,
  createCollection,
  saveCollection,
  deleteCollection,
  addArticlesToCollection,
  removeArticleFromCollection,
  sortCollectionArticles,
  getCollectionArticles
} from '../../api/collection'
import { getArticleList } from '../../api/article'

const list = ref([])
const loading = ref(false)

const formVisible = ref(false)
const saving = ref(false)
const form = ref({ id: null, name: '', description: '', coverImage: '', isPublic: true })

const manageVisible = ref(false)
const manageTarget = ref(null)
const manageArticles = ref([])
const searchList = ref([])
const searchTotal = ref(0)
const searchLoading = ref(false)
const searchQuery = ref({ page: 1, size: 8, titleKey: '' })

const loadData = async () => {
  loading.value = true
  try {
    list.value = await getCollections()
  } catch (e) {
    ElMessage.error('加载合集失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

const openCreate = () => {
  form.value = { id: null, name: '', description: '', coverImage: '', isPublic: true }
  formVisible.value = true
}

const openEdit = (row) => {
  form.value = {
    id: row.id,
    name: row.name,
    description: row.description || '',
    coverImage: row.coverImage || '',
    isPublic: row.isPublic !== false
  }
  formVisible.value = true
}

const submitForm = async () => {
  const name = (form.value.name || '').trim()
  if (!name) {
    ElMessage.warning('请输入合集名称')
    return
  }
  saving.value = true
  try {
    if (form.value.id) {
      await saveCollection({
        id: form.value.id,
        name,
        description: form.value.description || undefined,
        coverImage: form.value.coverImage || undefined,
        isPublic: form.value.isPublic
      })
      ElMessage.success('已保存')
    } else {
      await createCollection({
        name,
        description: form.value.description || undefined,
        coverImage: form.value.coverImage || undefined,
        isPublic: form.value.isPublic
      })
      ElMessage.success('已创建')
    }
    formVisible.value = false
    await loadData()
  } catch (e) {
    // 重名等已由后端拦截（request 拦截器已弹「合集名已存在」），保持弹窗不关闭
  } finally {
    saving.value = false
  }
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确认删除合集「${row.name}」？关联的文章不会被删除，仅移除归属。`, '提示', { type: 'warning' })
    .then(async () => {
      await deleteCollection(row.id)
      ElMessage.success('删除成功')
      await loadData()
    })
    .catch(() => {})
}

/* ---------- 管理博客 ---------- */
const openManage = async (row) => {
  manageTarget.value = row
  manageArticles.value = []
  manageVisible.value = true
  await Promise.all([loadManageArticles(), loadSearch()])
}

const loadManageArticles = async () => {
  if (!manageTarget.value) return
  try {
    const vo = await getCollectionArticles(manageTarget.value.id)
    manageArticles.value = (vo && vo.articles) || []
  } catch (e) {
    manageArticles.value = []
  }
}

const inCollection = (articleId) =>
  manageArticles.value.some(a => a.id === articleId)

const move = async (idx, dir) => {
  const target = idx + dir
  if (target < 0 || target >= manageArticles.value.length) return
  const arr = [...manageArticles.value]
  const [item] = arr.splice(idx, 1)
  arr.splice(target, 0, item)
  manageArticles.value = arr
  try {
    await sortCollectionArticles(manageTarget.value.id, arr.map(a => a.id))
  } catch (e) {
    ElMessage.error('排序失败，已回滚')
    await loadManageArticles()
  }
}

const removeFromCollection = async (articleId) => {
  try {
    await removeArticleFromCollection(manageTarget.value.id, articleId)
    manageArticles.value = manageArticles.value.filter(a => a.id !== articleId)
    ElMessage.success('已移除')
  } catch (e) {
    ElMessage.error('移除失败')
  }
}

const loadSearch = async () => {
  searchLoading.value = true
  try {
    const res = await getArticleList(searchQuery.value)
    searchList.value = res.data.list
    searchTotal.value = res.data.total
  } catch (e) {
    searchList.value = []
  } finally {
    searchLoading.value = false
  }
}

const toggleSearch = async (article, checked) => {
  const id = article.id
  if (checked) {
    try {
      await addArticlesToCollection(manageTarget.value.id, [id])
      if (!inCollection(id)) {
        manageArticles.value = [...manageArticles.value, { id, title: article.title }]
      }
      ElMessage.success('已加入')
    } catch (e) {
      ElMessage.error('加入失败')
    }
  } else {
    try {
      await removeArticleFromCollection(manageTarget.value.id, id)
      manageArticles.value = manageArticles.value.filter(a => a.id !== id)
      ElMessage.success('已移除')
    } catch (e) {
      ElMessage.error('移除失败')
    }
  }
}

const formatDate = (time) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.muted {
  color: #909399;
}
.cm-section {
  margin-bottom: 20px;
}
.cm-title {
  font-weight: 600;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.cm-title .muted {
  font-weight: 400;
  font-size: 12px;
}
.cm-empty {
  color: #909399;
  padding: 16px 0;
  text-align: center;
}
.cm-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  margin-bottom: 8px;
}
.cm-idx {
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 50%;
  background: #ecf0f5;
  color: #606266;
  font-size: 12px;
  flex-shrink: 0;
}
.cm-art-title {
  flex: 1;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cm-row-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.cm-search {
  margin-bottom: 12px;
}
</style>
