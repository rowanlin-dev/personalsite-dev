<template>
  <div>
    <el-card>
      <template #header>
        <span>文章管理</span>
        <el-button type="primary" @click="$router.push('/admin/article-edit')">新增文章</el-button>
      </template>
      <el-table :data="list" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="tags" label="标签" />
        <el-table-column prop="viewCount" label="阅读量" width="90" />
        <el-table-column prop="likeCount" label="点赞数" width="90" />
        <el-table-column label="操作" width="240">
          <template #default="scope">
            <el-button size="small" @click="$router.push(`/admin/article-edit?id=${scope.row.id}`)">编辑</el-button>
            <el-button size="small" type="success" @click="openPicker(scope.row.id)">加入合集</el-button>
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

    <CollectionPickerModal v-model:visible="pickerVisible" :article-id="pickerArticleId" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getArticleList, deleteArticle } from '../../api/article'
import CollectionPickerModal from './CollectionPickerModal.vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const total = ref(0)
const query = ref({ page: 1, size: 10 })

// 合集选择器
const pickerVisible = ref(false)
const pickerArticleId = ref(null)
const openPicker = (id) => {
  pickerArticleId.value = id
  pickerVisible.value = true
}

const loadData = async () => {
  const res = await getArticleList(query.value)
  list.value = res.data.list
  total.value = res.data.total
}

onMounted(loadData)

const handleDelete = (id) => {
  ElMessageBox.confirm('确认删除该文章？', '提示', { type: 'warning' })
    .then(async () => {
      await deleteArticle(id)
      ElMessage.success('删除成功')
      loadData()
    })
    .catch(() => {})
}
</script>
