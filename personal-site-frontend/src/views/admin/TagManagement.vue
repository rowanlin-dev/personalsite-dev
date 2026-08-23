<template>
  <div class="tags-page">
    <div class="page-header">
      <h2>标签管理</h2>
      <el-button type="primary" @click="openAddDialog">新增标签</el-button>
    </div>

    <el-card>
      <el-table :data="tags" stripe row-key="id" default-expand-all>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="标签名称" />
        <el-table-column prop="parentName" label="父标签" />
        <el-table-column prop="aliases" label="别名">
          <template #default="scope">
            <template v-if="scope.row.aliases?.length">
              <el-tag v-for="alias in scope.row.aliases" :key="alias.id" size="small" style="margin-right: 4px">
                {{ alias.aliasName }}
              </el-tag>
            </template>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="isTechStack" label="技术栈">
          <template #default="scope">
            <el-switch v-model="scope.row.isTechStack" disabled />
          </template>
        </el-table-column>
        <el-table-column prop="showInTechMap" label="图谱展示">
          <template #default="scope">
            <el-switch v-model="scope.row.showInTechMap" disabled />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320">
          <template #default="scope">
            <el-button size="small" @click="openEditDialog(scope.row)">编辑</el-button>
            <el-button size="small" @click="openAliasDialog(scope.row)">别名</el-button>
            <el-button
              size="small"
              type="success"
              :disabled="linkedTagIds.has(scope.row.id)"
              @click="openAddToSkillDialog(scope.row)"
            >
              {{ linkedTagIds.has(scope.row.id) ? '已加技能' : '添加到技能' }}
            </el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑标签对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑标签' : '新增标签'" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="标签名称">
          <el-input v-model="form.name" placeholder="如：前端" />
        </el-form-item>
        <el-form-item label="父标签">
          <el-select v-model="form.parentId" clearable placeholder="无">
            <el-option
              v-for="tag in parentOptions"
              :key="tag.id"
              :label="tag.name"
              :value="tag.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="是否技术栈">
          <el-switch v-model="form.isTechStack" />
        </el-form-item>
        <el-form-item label="图谱展示">
          <el-switch v-model="form.showInTechMap" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
    <!-- 别名管理对话框 -->
    <el-dialog v-model="aliasDialogVisible" :title="`管理别名：${currentTag?.name || ''}`" width="400px">
      <div class="alias-list">
        <el-tag
          v-for="alias in currentTag?.aliases"
          :key="alias.id"
          closable
          size="small"
          style="margin-right: 8px; margin-bottom: 8px"
          @close="handleDeleteAlias(alias)"
        >
          {{ alias.aliasName }}
        </el-tag>
        <el-empty v-if="!currentTag?.aliases?.some(a => a.id && a.aliasName)" description="暂无别名" :image-size="60" />
      </div>
      <div class="alias-add">
        <el-input
          v-model="aliasInput"
          placeholder="输入新别名，如 frontend"
          @keyup.enter="handleAddAlias"
        >
          <template #append>
            <el-button @click="handleAddAlias">添加</el-button>
          </template>
        </el-input>
      </div>
    </el-dialog>
    <!-- 标签转技能对话框：保留标签共用属性，熟练度由用户手动设置 -->
    <el-dialog v-model="skillDialogVisible" title="添加到技能" width="500px">
      <el-descriptions :column="1" border size="small" style="margin-bottom: 16px">
        <el-descriptions-item label="标签名称">{{ skillForm.tagName }}</el-descriptions-item>
        <el-descriptions-item label="父标签">{{ skillForm.parentName || '无' }}</el-descriptions-item>
        <el-descriptions-item label="技术栈">{{ skillForm.isTechStack ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="图谱展示">{{ skillForm.showInTechMap ? '是' : '否' }}</el-descriptions-item>
      </el-descriptions>
      <el-form :model="skillForm" label-width="100px">
        <el-form-item label="熟练度">
          <el-slider v-model="skillForm.level" :max="100" show-input />
          <div class="form-tip">技能专有属性，标签无此字段，请手动设置。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="skillDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="skillSubmitting" @click="handleAddToSkill">确定添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { getTagListWithAliases, saveTag, deleteTag, saveTagAlias, deleteTagAlias } from '../../api/tag'
import { getSkillAll, createSkillFromTag } from '../../api/skill'
import { ElMessage, ElMessageBox } from 'element-plus'

const tags = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const form = ref({
  id: null,
  name: '',
  parentId: null,
  isTechStack: true,
  showInTechMap: true,
  description: ''
})
const aliasDialogVisible = ref(false)
const currentTag = ref(null)
const aliasInput = ref('')

// 标签转技能相关状态
const skillDialogVisible = ref(false)
const skillSubmitting = ref(false)
const skillForm = ref({
  tagId: null,
  tagName: '',
  parentName: '',
  isTechStack: true,
  showInTechMap: true,
  level: 50
})
// 已关联技能的标签 ID 集合（用于隐藏「添加到技能」按钮）
const linkedTagIds = ref(new Set())

const parentOptions = computed(() => {
  return tags.value.filter(t => t.id !== form.value.id)
})

const loadData = async () => {
  try {
    const [tagRes, skillRes] = await Promise.all([
      getTagListWithAliases(),
      getSkillAll()
    ])
    tags.value = tagRes.data || []
    const ids = new Set((skillRes.data || []).map(s => s.tagId).filter(Boolean))
    linkedTagIds.value = ids
  } catch (e) {
    ElMessage.error('加载标签失败')
  }
}

const openAddDialog = () => {
  isEdit.value = false
  form.value = { id: null, name: '', parentId: null, isTechStack: true, showInTechMap: true, description: '' }
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  isEdit.value = true
  form.value = {
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    isTechStack: row.isTechStack,
    showInTechMap: row.showInTechMap,
    description: row.description || ''
  }
  dialogVisible.value = true
}

const handleSave = async () => {
  const name = form.value.name.trim()
  if (!name) {
    ElMessage.warning('请输入标签名称')
    return
  }
  try {
    await saveTag({ ...form.value, name })
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await loadData()
  } catch (e) {
    ElMessage.error('保存失败，名称可能已存在')
  }
}

const handleDelete = (id) => {
  ElMessageBox.confirm('确认删除该标签？', '提示', { type: 'warning' })
    .then(async () => {
      try {
        await deleteTag(id)
        ElMessage.success('删除成功')
        await loadData()
      } catch (e) {
        ElMessage.error('删除失败，标签可能仍被引用')
      }
    })
    .catch(() => {})
}

const openAliasDialog = (row) => {
  currentTag.value = row
  aliasInput.value = ''
  aliasDialogVisible.value = true
}

// 打开「标签转技能」对话框：预填标签共用属性，熟练度留空让用户设
const openAddToSkillDialog = (row) => {
  skillForm.value = {
    tagId: row.id,
    tagName: row.name,
    parentName: row.parentName,
    isTechStack: row.isTechStack,
    showInTechMap: row.showInTechMap,
    level: 50
  }
  skillDialogVisible.value = true
}

const handleAddToSkill = async () => {
  skillSubmitting.value = true
  try {
    await createSkillFromTag(skillForm.value.tagId, skillForm.value.level)
    ElMessage.success('已添加到技能')
    skillDialogVisible.value = false
    await loadData()
  } catch (e) {
    const msg = e?.response?.data?.msg || e?.message || '添加失败'
    ElMessage.error(msg)
  } finally {
    skillSubmitting.value = false
  }
}

const handleAddAlias = async () => {
  const name = aliasInput.value.trim()
  if (!name) {
    ElMessage.warning('请输入别名')
    return
  }
  try {
    await saveTagAlias({ tagId: currentTag.value.id, aliasName: name })
    ElMessage.success('添加成功')
    aliasInput.value = ''
    await refreshCurrentTag()
  } catch (e) {
    ElMessage.error('添加失败，别名可能已存在或与标签名冲突')
  }
}

const handleDeleteAlias = async (alias) => {
  try {
    await deleteTagAlias(alias.id)
    ElMessage.success('删除成功')
    await refreshCurrentTag()
  } catch (e) {
    ElMessage.error('删除失败')
  }
}

const refreshCurrentTag = async () => {
  await loadData()
  if (currentTag.value) {
    currentTag.value = tags.value.find(t => t.id === currentTag.value.id) || null
  }
}

onMounted(loadData)
</script>

<style scoped>
.tags-page {
  padding: 20px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-header h2 {
  margin: 0;
}
.alias-list {
  margin-bottom: 16px;
}
.alias-add {
  display: flex;
  gap: 8px;
}
</style>
