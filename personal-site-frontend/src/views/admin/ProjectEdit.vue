<template>
  <div>
    <el-card>
      <template #header>{{ isEdit ? '编辑项目' : '新增项目' }}</template>
      <el-form :model="form" label-width="100px">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.descript" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="技术栈">
          <el-select
            ref="tagSelectRef"
            v-model="selectedTagIds"
            multiple
            filterable
            remote
            reserve-keyword
            default-first-option
            placeholder="输入关键字搜索标签，回车或点击框外可创建新标签"
            :remote-method="onSearchTags"
            :loading="tagLoading"
            @change="onTagChange"
            style="width: 100%"
          >
            <el-option
              v-for="tag in tagOptions"
              :key="tag.id"
              :label="tag.name"
              :value="tag.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="GitHub"><el-input v-model="form.github" /></el-form-item>
        <el-form-item label="演示链接"><el-input v-model="form.demoUrl" /></el-form-item>
        <el-form-item label="封面">
          <div class="cover-field">
            <div class="cover-actions">
              <el-upload :http-request="uploadCover" :show-file-list="false"><el-button type="primary">上传封面</el-button></el-upload>
              <el-button v-if="form.coverImage" text type="danger" @click="form.coverImage = ''; coverPreviewFailed = false">移除封面</el-button>
            </div>
            <img
              :src="coverPreviewFailed ? defaultProjectCover : (form.coverImage || defaultProjectCover)"
              class="cover-preview"
              alt="项目封面预览"
              @error="onCoverPreviewError"
            />
            <p v-if="coverPreviewFailed" class="cover-hint" style="color:#f56c6c">
              自定义封面加载失败（可能已在 COS 删除），已回退默认封面；可重新上传或点击「移除封面」清空。
            </p>
            <p v-else-if="!form.coverImage" class="cover-hint">
              当前为默认封面预览：不上传封面时，前台将自动展示默认封面（public/project-cover-default.svg）。
            </p>
            <p v-else class="cover-hint">已上传自定义封面；点击「移除封面」可恢复为默认封面。</p>
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSave">保存</el-button>
          <el-button @click="$router.push('/admin/projects')">返回</el-button>
          <el-button @click="$router.push('/admin/assets')">从素材库选择封面</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { SITE_ORIGIN } from '../../utils/seo'
import { useRoute, useRouter } from 'vue-router'
import { getProjectDetail, saveProject } from '../../api/project'
import { getTagList, searchTags, saveTag } from '../../api/tag'
import { uploadAssets } from '../../api/assets'
import { useAssetsStore } from '../../store/assets'
import { useSiteStore } from '../../store/site'
import { ElMessage } from 'element-plus'

const siteStore = useSiteStore()
const assetsStore = useAssetsStore()

const route = useRoute()
const router = useRouter()
const isEdit = ref(false)
const form = ref({ title: '', descript: '', tagIds: [], github: '', demoUrl: '', coverImage: '' })
// 图片 COS key 清单：封面上传时捕获，保存时随 project 提交，供删除项目时级联删除
const imageKeys = ref([])
const draftId = ref('draft-' + Date.now())
const assetPrefix = () => `assets/public/projects/${form.value.slug || form.value.id || draftId.value}/`
const addImageKey = (key) => {
  if (key && !imageKeys.value.includes(key)) imageKeys.value.push(key)
}
// 与前台约定：coverImage 留空 = 使用默认封面（前台 fallback 到
// SITE_ORIGIN + '/project-cover-default.svg' 这个绝对链接，避免本地非根路径打开时加载失败）
const defaultProjectCover = SITE_ORIGIN + '/project-cover-default.svg'
const coverPreviewFailed = ref(false)
const onCoverPreviewError = () => { coverPreviewFailed.value = true }
// 兼容两种来源：新 UI 数组形式、后端实际返回的 JSON-array 字符串形式
function parseKeys(v) {
  if (Array.isArray(v)) return v
  if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}
const selectedTagIds = ref([])
const allTags = ref([])
const tagOptions = ref([])
const tagLoading = ref(false)
const tagSelectRef = ref(null)
let blurHandler = null

onMounted(async () => {
  // 先加载全部标签，确保已选标签能正确显示名称
  try {
    const res = await getTagList()
    allTags.value = res.data || []
    tagOptions.value = allTags.value
  } catch (e) {
    console.error('加载标签失败', e)
  }

  const id = route.query.id
  if (id) {
    isEdit.value = true
    try {
      const res = await getProjectDetail(id)
      form.value = res.data
      if (!form.value.tagIds) form.value.tagIds = []
      selectedTagIds.value = [...form.value.tagIds]
      imageKeys.value = parseKeys(form.value.imageKeys)
    } catch (e) {
      ElMessage.error('加载项目失败')
    }
  }

  // 素材库「选用」回写：直接作为封面
  if (assetsStore.lastPickedUrl) {
    form.value.coverImage = assetsStore.lastPickedUrl
    coverPreviewFailed.value = false
    assetsStore.clearLastPickedUrl()
  }

  await nextTick()
  const input = tagSelectRef.value?.$el?.querySelector('input')
  if (input) {
    blurHandler = () => handleInputBlur()
    input.addEventListener('blur', blurHandler)
  }
})

onUnmounted(() => {
  const input = tagSelectRef.value?.$el?.querySelector('input')
  if (input && blurHandler) {
    input.removeEventListener('blur', blurHandler)
  }
})

const syncFormTagIds = () => {
  form.value.tagIds = selectedTagIds.value.filter(id => typeof id === 'number')
}

const onSearchTags = async (keyword) => {
  const trimmed = keyword ? keyword.trim() : ''
  if (!trimmed) {
    tagOptions.value = allTags.value
    return
  }
  tagLoading.value = true
  try {
    const res = await searchTags(trimmed)
    let list = res.data || []
    const lower = trimmed.toLowerCase()
    const exactMatch = list.some(t => t.name.toLowerCase() === lower)
    if (!exactMatch) {
      list = [{ id: `__new__${trimmed}`, name: `创建新标签：${trimmed}` }, ...list]
    }
    tagOptions.value = list
  } catch (e) {
    console.error('搜索标签失败', e)
  } finally {
    tagLoading.value = false
  }
}

const onTagChange = (val) => {
  // 清除当前输入，避免 blur 再次触发创建
  const input = tagSelectRef.value?.$el?.querySelector('input')
  if (input) input.value = ''
  resolveNewTags(val)
  syncFormTagIds()
}

const resolveNewTags = async (val) => {
  const arr = [...val]
  let changed = false
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    if (typeof item === 'string') {
      let name = item
      if (name.startsWith('__new__')) name = name.slice(7)
      const id = await resolveTag(name)
      if (id) {
        arr[i] = id
        changed = true
      } else {
        arr.splice(i, 1)
        i--
        changed = true
      }
    }
  }
  if (changed) {
    selectedTagIds.value = arr
    syncFormTagIds()
  }
}

const handleInputBlur = () => {
  const input = tagSelectRef.value?.$el?.querySelector('input')
  const name = input?.value?.trim()
  if (!name) return

  // 延迟一点，让 el-select 先处理用户点击选项的行为
  setTimeout(() => {
    const selectedNames = selectedTagIds.value
      .filter(id => typeof id === 'number')
      .map(id => allTags.value.find(t => t.id === id)?.name?.toLowerCase())
    if (selectedNames.includes(name.toLowerCase())) return

    const existing = allTags.value.find(t => t.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!selectedTagIds.value.includes(existing.id)) {
        selectedTagIds.value.push(existing.id)
        syncFormTagIds()
      }
      return
    }

    resolveTag(name).then(id => {
      if (id && !selectedTagIds.value.includes(id)) {
        selectedTagIds.value.push(id)
        syncFormTagIds()
      }
    })
  }, 50)
}

const resolveTag = async (rawName) => {
  const name = rawName.trim()
  if (!name) return null
  const lower = name.toLowerCase()
  const existing = allTags.value.find(t => t.name.toLowerCase() === lower)
  if (existing) return existing.id

  try {
    await saveTag({ name, isTechStack: true, showInTechMap: true })
    const res = await getTagList()
    allTags.value = res.data || []
    tagOptions.value = allTags.value
    const newTag = allTags.value.find(t => t.name.toLowerCase() === lower)
    return newTag ? newTag.id : null
  } catch (e) {
    ElMessage.error(`创建标签「${name}」失败`)
    return null
  }
}

const uploadCover = async (options) => {
  try {
    const receipts = await uploadAssets(assetPrefix(), [options.file])
    const r = receipts && receipts[0]
    if (r) {
      form.value.coverImage = r.url
      coverPreviewFailed.value = false
      addImageKey(r.key)
    }
    ElMessage.success('上传成功')
  } catch (e) {
    console.error(e)
    ElMessage.error('上传失败')
  }
}

const handleSave = async () => {
  if (!form.value.title || form.value.title.trim() === '') {
    ElMessage.warning('请输入标题')
    return
  }
  await resolveNewTags(selectedTagIds.value)
  try {
    const payload = { ...form.value, imageKeys: JSON.stringify(imageKeys.value || []) }
    await saveProject(payload)
    siteStore.clearCache()
    ElMessage.success('保存成功')
    router.push('/admin/projects')
  } catch (e) {
    console.error('保存项目失败', e)
    ElMessage.error('保存失败')
  }
}
</script>

<style scoped>
.cover-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cover-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cover-preview {
  width: 240px;
  height: 135px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  background: #f8fafc;
  object-fit: cover;
  display: block;
}
.cover-hint {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.6;
}
</style>
