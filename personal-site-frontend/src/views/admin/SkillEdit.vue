<template>
  <div>
    <el-card>
      <template #header>{{ isEdit ? '编辑技能' : '新增技能' }}</template>
      <el-form :model="form" label-width="120px">
        <el-form-item label="标签名称">
          <el-input v-model="form.tagName" placeholder="请输入标签名称，如：Vue" />
          <div class="form-tip">提示：保存时会同步更新标签名称与父类等属性。</div>
        </el-form-item>
        <el-form-item label="父类">
          <el-select v-model="form.parentId" clearable placeholder="无">
            <el-option
              v-for="tag in parentOptions"
              :key="tag.id"
              :label="tag.name"
              :value="tag.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="熟练度">
          <el-slider v-model="form.level" :max="100" show-input />
        </el-form-item>
        <el-form-item label="是否技术栈">
          <el-switch v-model="form.isTechStack" />
        </el-form-item>
        <el-form-item label="是否在图谱展示">
          <el-switch v-model="form.showInTechMap" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSave">保存</el-button>
          <el-button @click="$router.push('/admin/skills')">返回</el-button>
        </el-form-item>
      </el-form>

      <!-- 方案 C：关系配置（仅编辑已有技能时显示） -->
      <el-divider v-if="isEdit" content-position="left">关联关系配置</el-divider>
      <div v-if="isEdit" class="relation-editor">
        <p class="relation-tip">为该技能与其他技能设置关系类型（同类/协作/依赖/增强）。留空「无」表示使用系统自动推断。</p>
        <div v-for="other in otherSkills" :key="other.id" class="relation-row">
          <span class="relation-name">{{ other.tagName }}</span>
          <el-select v-model="relationSelections[other.id]" placeholder="无" size="small" style="width: 140px">
            <el-option label="无（自动推断）" value="" />
            <el-option label="同类" value="same" />
            <el-option label="协作" value="collab" />
            <el-option label="依赖" value="depend" />
            <el-option label="增强" value="enhance" />
          </el-select>
        </div>
        <el-button type="primary" size="small" :loading="relationSaving" @click="handleSaveRelations">保存关系</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getSkillDetail, saveSkill, getSkillAll, getTechRelations, saveTechRelation } from '../../api/skill'
import { getTagList } from '../../api/tag'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const isEdit = ref(false)
const form = ref({
  id: null,
  tagId: null,
  tagName: '',
  parentId: null,
  level: 50,
  isTechStack: true,
  showInTechMap: true
})
const allTags = ref([])

const parentOptions = computed(() => {
  return allTags.value.filter(t => t.id !== form.value.tagId)
})

// 方案 C：关系配置
const otherSkills = ref([])
const relationSelections = ref({}) // { [otherSkillId]: relationType }
const relationSaving = ref(false)

// 当前技能 id（编辑时存在）
const currentSkillId = computed(() => form.value.id)

onMounted(async () => {
  try {
    const tagRes = await getTagList()
    allTags.value = tagRes.data || []
  } catch (e) {
    ElMessage.error('加载标签失败')
  }

  const id = route.query.id
  if (id) {
    isEdit.value = true
    try {
      const res = await getSkillDetail(id)
      const data = res.data
      form.value = {
        id: data.id,
        tagId: data.tagId,
        tagName: data.tagName || '',
        parentId: data.parentId,
        level: data.level || 50,
        isTechStack: data.isTechStack !== false,
        showInTechMap: data.showInTechMap !== false
      }
      // 方案 C：加载其他技能 + 已配置关系
      await loadRelationEditor(data.id)
    } catch (e) {
      ElMessage.error('加载技能详情失败')
    }
  }
})

const loadRelationEditor = async (skillId) => {
  try {
    const [allRes, relRes] = await Promise.all([getSkillAll(), getTechRelations()])
    const all = allRes.data || []
    otherSkills.value = all.filter(s => s.id !== skillId)
    // 构建已配置关系映射：key = "小id-大id"
    const map = {}
    ;(relRes.data || []).forEach(r => {
      const a = Math.min(r.sourceSkillId, r.targetSkillId)
      const b = Math.max(r.sourceSkillId, r.targetSkillId)
      map[`${a}-${b}`] = r.relationType
    })
    const sel = {}
    otherSkills.value.forEach(o => {
      const a = Math.min(skillId, o.id)
      const b = Math.max(skillId, o.id)
      sel[o.id] = map[`${a}-${b}`] || ''
    })
    relationSelections.value = sel
  } catch (e) {
    ElMessage.error('加载关系配置失败')
  }
}

const handleSaveRelations = async () => {
  const sid = currentSkillId.value
  if (!sid) return
  relationSaving.value = true
  try {
    const entries = Object.entries(relationSelections.value)
    for (const [otherId, type] of entries) {
      await saveTechRelation(sid, Number(otherId), type || null)
    }
    ElMessage.success('关系已保存')
  } catch (e) {
    const msg = e?.response?.data?.msg || e?.message || '保存关系失败'
    ElMessage.error(msg)
  } finally {
    relationSaving.value = false
  }
}

const handleSave = async () => {
  const name = form.value.tagName.trim()
  if (!name) {
    ElMessage.warning('请输入标签名称')
    return
  }
  try {
    await saveSkill({
      id: form.value.id,
      tagId: form.value.tagId,
      tagName: name,
      parentId: form.value.parentId,
      level: form.value.level,
      isTechStack: form.value.isTechStack,
      showInTechMap: form.value.showInTechMap
    })
    ElMessage.success('保存成功')
    router.push('/admin/skills')
  } catch (e) {
    console.error('保存技能失败', e)
    ElMessage.error('保存失败')
  }
}
</script>

<style scoped>
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.relation-editor {
  margin-top: 8px;
}
.relation-tip {
  font-size: 12px;
  color: #909399;
  margin: 0 0 12px;
}
.relation-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.relation-name {
  min-width: 120px;
  font-weight: 600;
  color: #303133;
}
</style>
