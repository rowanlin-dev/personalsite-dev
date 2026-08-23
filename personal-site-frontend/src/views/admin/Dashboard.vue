<template>
  <div class="dashboard-page">
    <h2>仪表盘</h2>
    <p class="subtitle">欢迎使用蜂潮网络科技工作室后台管理系统</p>

    <el-row :gutter="20">
      <el-col :xs="24" :sm="12" :lg="8" v-for="item in statCards" :key="item.key">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-title">{{ item.title }}</div>
          <div class="stat-value">{{ stats[item.key] ?? 0 }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getDashboardStats } from '../../api/admin'
import { ElMessage } from 'element-plus'

const stats = ref({})

const statCards = [
  { title: '文章总数', key: 'articleCount' },
  { title: '项目总数', key: 'projectCount' },
  { title: '技能总数', key: 'skillCount' },
  { title: '标签总数', key: 'tagCount' },
  { title: '累计阅读量', key: 'totalViews' },
  { title: '累计点赞数', key: 'totalLikes' }
]

onMounted(async () => {
  try {
    const res = await getDashboardStats()
    stats.value = res.data
  } catch (e) {
    console.error('加载仪表盘数据失败', e)
    ElMessage.error('加载仪表盘数据失败')
  }
})
</script>

<style scoped>
.dashboard-page {
  padding: 20px;
}
.subtitle {
  color: #64748b;
  margin-bottom: 24px;
}
.stat-card {
  border-radius: 12px;
  margin-bottom: 20px;
  text-align: center;
}
.stat-title {
  color: #64748b;
  font-size: 14px;
  margin-bottom: 12px;
}
.stat-value {
  color: #1e293b;
  font-size: 32px;
  font-weight: 700;
}
</style>
