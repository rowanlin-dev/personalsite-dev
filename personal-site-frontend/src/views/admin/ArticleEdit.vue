<template>
  <div>
    <el-card>
      <template #header>{{ isEdit ? '编辑文章' : '新增文章' }}</template>
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="标签">
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
        <el-form-item label="封面">
          <el-upload :http-request="uploadCover" :show-file-list="false">
            <el-button type="primary">上传封面</el-button>
          </el-upload>
          <el-image v-if="form.coverImage" :src="form.coverImage" style="width: 200px; margin-top: 10px" />
        </el-form-item>
        <el-form-item label="内容">
          <MdEditor ref="mdEditorRef" v-model="form.mdContent" style="height: 500px" :sanitize="sanitizeHtml" @onUploadImg="onUploadImg" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSave">保存</el-button>
          <el-button @click="$router.push('/admin/articles')">返回</el-button>
          <el-button @click="assetPickerVisible = true">从素材库选择图片</el-button>
          <el-button @click="importUrlVisible = true">收录图片链接</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <AssetPickerModal v-model:visible="assetPickerVisible" @confirm="onAssetPicked" />

    <!-- Q4：收录同桶外部 URL（本地项目与线上共用同一 COS 仓库时，粘贴链接即可入库） -->
    <el-dialog v-model="importUrlVisible" title="收录图片链接到素材库" width="520px" :close-on-click-modal="false">
      <p class="import-tip">
        粘贴本地项目（同一 COS 仓库）或本站已上传的图片链接，将复制到当前文章素材目录，随后可继续编辑正文插入。
      </p>
      <el-input
        v-model="importUrlInput"
        placeholder="https://cos-personal-site.minipluto.cn/assets/public/blogs/xxx/xxxx.jpg"
        clearable
        @keyup.enter="handleImportUrl"
      />
      <template #footer>
        <el-button @click="importUrlVisible = false">取消</el-button>
        <el-button type="primary" :loading="importingUrl" @click="handleImportUrl">收录并插入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import DOMPurify from 'dompurify'
import { getArticleInfo, saveArticle } from '../../api/article'
import { getTagList, searchTags, saveTag } from '../../api/tag'
import { uploadAssets, moveAssets, removeAssets, importAssetUrl } from '../../api/assets'
import { useAssetsStore } from '../../store/assets'
import { useSiteStore } from '../../store/site'
import { ElMessage } from 'element-plus'
import AssetPickerModal from './AssetPickerModal.vue'

// XSS 兜底：md-editor-v3 v4 已移除内置 XSS 过滤，渲染前用 DOMPurify 净化 Markdown 产出的 HTML
const sanitizeHtml = (html) => DOMPurify.sanitize(html)

const siteStore = useSiteStore()
const assetsStore = useAssetsStore()

const route = useRoute()
const mdEditorRef = ref(null)
const assetPickerVisible = ref(false)
const importUrlVisible = ref(false)
const importUrlInput = ref('')
const importingUrl = ref(false)
const isEdit = ref(false)
const form = ref({ title: '', tagIds: [], mdContent: '', coverImage: '' })
// 图片 COS key 清单：上传时捕获，保存时随 article 提交，供删除文章时级联删除
const imageKeys = ref([])
// 新文章尚无 slug，用稳定草稿 id 作上传前缀占位，保存后前缀不影响级联（级联按 imageKeys）
const draftId = ref('draft-' + Date.now())
const assetPrefix = () => `assets/public/blogs/${form.value.slug || form.value.id || draftId.value}/`
const addImageKey = (key) => {
  if (key && !imageKeys.value.includes(key)) imageKeys.value.push(key)
}
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
      const res = await getArticleInfo(id)
      form.value = res.data
      if (!form.value.tagIds) form.value.tagIds = []
      selectedTagIds.value = [...form.value.tagIds]
      // 已存图片 key：恢复进 imageKeys，保存时一并回写
      imageKeys.value = parseKeys(form.value.imageKeys)
    } catch (e) {
      ElMessage.error('加载文章失败')
    }
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
      addImageKey(r.key)
    }
    ElMessage.success('封面上传成功')
  } catch (e) {
    console.error(e)
    ElMessage.error('封面上传失败')
  }
}

const onUploadImg = async (files, callback) => {
  try {
    const receipts = await uploadAssets(assetPrefix(), files)
    const urls = []
    for (const r of (receipts || [])) {
      if (r && r.key) addImageKey(r.key)
      if (r && r.url) urls.push(r.url)
    }
    callback(urls)
  } catch (e) {
    console.error(e)
    ElMessage.error('图片上传失败')
  }
}

const handleSave = async () => {
  if (!form.value.title || form.value.title.trim() === '') {
    ElMessage.warning('请输入标题')
    return
  }
  await resolveNewTags(selectedTagIds.value)
  try {
    // 随 article 提交 imageKeys，供后端级联删除（后端 imageKeys 为字符串，须 JSON.stringify）
    const payload = { ...form.value, imageKeys: JSON.stringify(imageKeys.value) }
    const res = await saveArticle(payload)
    // 保存后回写 id（新建场景），保持页面不跳转
    if (res && res.data && res.data.id) form.value.id = res.data.id
    // Q3：新建文章保存后，把 draft- 前缀下已上传图片复制到 <id>/ 前缀，
    // 否则素材库按文章聚合时看不到（article 表无 slug，素材库按 id 分区）。
    if (form.value.id) {
      await migrateDraftAssets()
    }
    siteStore.clearCache()
    ElMessage.success('保存成功')
  } catch (e) {
    console.error('保存文章失败', e)
    ElMessage.error('保存失败')
  }
}

// Q3 迁移：draft- 前缀 -> <id>/ 前缀。复制成功后回写正文/封面 URL 与 imageKeys，
// 再次保存持久化；源 draft 对象最后才删除（安全顺序：先保证内容指向新 URL）。
const migrateDraftAssets = async () => {
  const oldPrefix = `assets/public/blogs/${draftId.value}/`
  const newPrefix = `assets/public/blogs/${form.value.id}/`
  if (oldPrefix === newPrefix) return

  let moves = []
  try {
    moves = await moveAssets(oldPrefix, newPrefix) || []
  } catch (e) {
    console.warn('复制 draft 素材失败，跳过迁移（不影响保存）', e)
    return
  }
  if (!moves.length) return

  // 回写正文与封面中的旧 URL -> 新 URL
  for (const m of moves) {
    if (m.oldUrl && m.newUrl && m.oldUrl !== m.newUrl) {
      if (form.value.mdContent) {
        form.value.mdContent = form.value.mdContent.split(m.oldUrl).join(m.newUrl)
      }
      if (form.value.coverImage === m.oldUrl) {
        form.value.coverImage = m.newUrl
      }
    }
    if (m.oldKey && m.newKey && m.oldKey !== m.newKey) {
      const idx = imageKeys.value.indexOf(m.oldKey)
      if (idx !== -1) imageKeys.value[idx] = m.newKey
    }
  }

  // 持久化迁移后的内容
  try {
    await saveArticle({ ...form.value, imageKeys: JSON.stringify(imageKeys.value) })
  } catch (e) {
    console.error('迁移后重新保存失败', e)
  }

  // 源对象已无引用，删除 draft- 残留（best-effort，失败不影响）
  try {
    await removeAssets(moves.map(m => m.oldKey))
  } catch (e) {
    console.warn('清理 draft 源对象失败', e)
  }
}

// Q4：收录同桶外部 URL 到当前文章前缀，并立即在光标处插入 Markdown
const handleImportUrl = async () => {
  const url = (importUrlInput.value || '').trim()
  if (!url) {
    ElMessage.warning('请粘贴图片链接')
    return
  }
  importingUrl.value = true
  try {
    const r = await importAssetUrl(url, assetPrefix())
    if (r && r.key) addImageKey(r.key)
    if (r && r.url) {
      onAssetPicked([r.url])
      importUrlInput.value = ''
      importUrlVisible.value = false
      ElMessage.success('已收录到当前文章素材库并插入')
    }
  } catch (e) {
    // 错误信息已由 request 拦截器 toast
    console.error('收录图片链接失败', e)
  } finally {
    importingUrl.value = false
  }
}

// 素材库弹窗确认：在光标处插入选中图片的 Markdown
const onAssetPicked = (urls) => {
  if (!mdEditorRef.value) return
  for (const u of (urls || [])) {
    mdEditorRef.value.insert(() => ({ targetValue: `\n![image](${u})\n` }))
  }
  mdEditorRef.value.focus()
}
</script>

<style scoped>
.import-tip {
  color: var(--text-secondary, #606266);
  font-size: 13px;
  line-height: 1.6;
  margin: 0 0 12px;
}
</style>
