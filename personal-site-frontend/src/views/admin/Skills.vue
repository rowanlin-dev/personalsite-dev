<template>
  <div class="skills-page">
    <div class="page-header">
      <h2>技能管理</h2>
      <div class="header-actions">
        <el-button type="primary" @click="$router.push('/admin/skill-edit')">新增技能</el-button>
        <el-button @click="$router.push('/admin/tags')">标签管理</el-button>
      </div>
    </div>

    <el-card>
      <el-table :data="list" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="tagName" label="名称" />
        <el-table-column prop="parentName" label="父类" />
        <el-table-column prop="level" label="熟练度" />
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
        <el-table-column label="操作" width="150">
          <template #default="scope">
            <el-button size="small" @click="$router.push(`/admin/skill-edit?id=${scope.row.id}`)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.size"
        :total="total"
        layout="prev, pager, next"
        @change="loadData"
        style="margin-top: 16px"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getSkillList, deleteSkill } from '../../api/skill'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const total = ref(0)
const query = ref({ page: 1, size: 10 })

const loadData = async () => {
  try {
    const res = await getSkillList(query.value)
    list.value = res.data.list
    total.value = res.data.total
  } catch (e) {
    console.error('加载技能列表失败', e)
    ElMessage.error('加载技能列表失败')
  }
}

const handleDelete = (id) => {
  ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    .then(async () => {
      await deleteSkill(id)
      ElMessage.success('删除成功')
      await loadData()
    })
    .catch(() => {})
}

onMounted(loadData)
</script>

<style scoped>
.skills-page {
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
.header-actions .el-button {
  margin-left: 10px;
}
</style>
