<template>
  <div>
    <el-card>
      <template #header>
        <span>项目管理</span>
        <el-button type="primary" @click="$router.push('/admin/project-edit')">新增项目</el-button>
      </template>
      <el-table :data="list" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="techStack" label="技术栈" />
        <el-table-column label="操作" width="150">
          <template #default="scope">
            <el-button size="small" @click="$router.push(`/admin/project-edit?id=${scope.row.id}`)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" layout="prev, pager, next" @change="loadData" style="margin-top: 16px" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getProjectList, deleteProject } from '../../api/project'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const total = ref(0)
const query = ref({ page: 1, size: 10 })

const loadData = async () => {
  const res = await getProjectList(query.value)
  list.value = res.data.list
  total.value = res.data.total
}

onMounted(loadData)

const handleDelete = (id) => {
  ElMessageBox.confirm('确认删除？', '提示', { type: 'warning' })
    .then(async () => {
      await deleteProject(id)
      ElMessage.success('删除成功')
      loadData()
    })
    .catch(() => {})
}
</script>
