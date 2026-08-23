<template>
  <div>
    <el-card>
      <template #header>网站配置</template>
      <el-form :model="form" label-width="120px">
        <el-form-item label="关于我标题"><el-input v-model="form.about_title" /></el-form-item>
        <el-form-item label="关于我内容"><el-input v-model="form.about_content" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="联系邮箱"><el-input v-model="form.contact_email" /></el-form-item>
        <el-form-item label="GitHub"><el-input v-model="form.contact_github" /></el-form-item>
        <el-form-item label="头像">
          <el-input v-model="form.avatar_url" placeholder="头像图片 URL" />
          <el-upload
            class="avatar-uploader"
            action="/api/upload"
            :show-file-list="false"
            :on-success="handleAvatarUploadSuccess"
            :on-error="handleUploadError"
            accept="image/*"
          >
            <el-button type="primary" text>
              <el-icon><Upload /></el-icon> 上传头像
            </el-button>
          </el-upload>
          <div v-if="form.avatar_url" class="avatar-preview">
            <el-image :src="form.avatar_url" fit="cover" style="width: 120px; height: 120px; border-radius: 50%;" />
          </div>
        </el-form-item>
        <el-form-item label="展示头像">
          <el-switch v-model="form.avatar_show" active-value="1" inactive-value="0" />
        </el-form-item>
        <el-form-item label="微信二维码">
          <el-input v-model="form.contact_wechat" placeholder="二维码图片 URL" />
          <el-upload
            class="qrcode-uploader"
            action="/api/upload"
            :show-file-list="false"
            :on-success="handleUploadSuccess"
            :on-error="handleUploadError"
            accept="image/*"
          >
            <el-button type="primary" text>
              <el-icon><Upload /></el-icon> 上传二维码图片
            </el-button>
          </el-upload>
          <div v-if="form.contact_wechat" class="qrcode-preview">
            <el-image :src="form.contact_wechat" fit="contain" style="width: 120px; height: 120px;" />
          </div>
        </el-form-item>
        <el-form-item label="简历开关">
          <el-switch v-model="form.resume_enable" active-value="1" inactive-value="0" />
        </el-form-item>
        <el-form-item label="简历 PDF">
          <el-input v-model="form.resume_pdf" placeholder="简历 PDF 下载链接" />
          <el-upload
            class="resume-uploader"
            action="/api/upload"
            :show-file-list="false"
            :on-success="handleResumeUploadSuccess"
            :on-error="handleUploadError"
            accept=".pdf"
          >
            <el-button type="primary" text>
              <el-icon><Upload /></el-icon> 上传简历 PDF
            </el-button>
          </el-upload>
          <div v-if="form.resume_pdf" class="resume-preview">
            <el-link :href="form.resume_pdf" target="_blank" type="primary">
              <el-icon><Document /></el-icon> 预览简历
            </el-link>
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSave">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Upload, Document } from '@element-plus/icons-vue'
import { getConfigAll, saveConfig } from '../../api/config'
import { useSiteStore } from '../../store/site'
import { ElMessage } from 'element-plus'

const siteStore = useSiteStore()

const form = ref({
  about_title: '',
  about_content: '',
  contact_email: '',
  contact_github: '',
  avatar_url: '',
  avatar_show: '1',
  contact_wechat: '',
  resume_enable: '0'
})

onMounted(async () => {
  const res = await getConfigAll()
  form.value = { ...form.value, ...res.data }
})

const handleUploadSuccess = (res) => {
  if (res.code === 200) {
    form.value.contact_wechat = res.data
    ElMessage.success('上传成功')
  } else {
    ElMessage.error(res.msg || '上传失败')
  }
}

const handleAvatarUploadSuccess = (res) => {
  if (res.code === 200) {
    form.value.avatar_url = res.data
    ElMessage.success('头像上传成功')
  } else {
    ElMessage.error(res.msg || '上传失败')
  }
}

const handleResumeUploadSuccess = (res) => {
  if (res.code === 200) {
    form.value.resume_pdf = res.data
    ElMessage.success('简历上传成功')
  } else {
    ElMessage.error(res.msg || '上传失败')
  }
}

const handleUploadError = () => {
  ElMessage.error('上传失败，请检查网络或 COS 配置')
}

const handleSave = async () => {
  for (const [key, value] of Object.entries(form.value)) {
    await saveConfig(key, value)
  }
  siteStore.clearCache()
  ElMessage.success('保存成功')
}
</script>

<style scoped>
.qrcode-uploader,
.resume-uploader,
.avatar-uploader {
  margin-top: 8px;
}
.qrcode-preview,
.resume-preview,
.avatar-preview {
  margin-top: 12px;
  padding: 8px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  display: inline-block;
}
</style>
