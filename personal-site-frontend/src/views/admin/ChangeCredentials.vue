<template>
  <div class="force-change-page">
    <el-card class="force-change-card">
      <h2>首次登录必须修改账号密码</h2>
      <p class="tip">检测到你使用的是默认账号，出于安全考虑，首次登录后必须修改账号密码；改密成功前无法进入后台。</p>
      <el-form :model="form" label-width="90px" :rules="rules" ref="formRef">
        <el-form-item label="原密码" prop="oldPassword">
          <el-input v-model="form.oldPassword" type="password" show-password placeholder="请输入当前登录密码" />
        </el-form-item>
        <el-form-item label="新用户名" prop="newUsername">
          <el-input v-model="form.newUsername" placeholder="可沿用当前用户名，也可修改" />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="form.newPassword" type="password" show-password placeholder="请设置强密码" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" style="width: 100%">确认修改</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../../store/admin'
import { changeCredentials } from '../../api/admin'

const router = useRouter()
const adminStore = useAdminStore()
const formRef = ref()

const form = reactive({
  oldUsername: adminStore.username,
  oldPassword: '',
  newUsername: adminStore.username,
  newPassword: '',
  confirmPassword: ''
})

const validateConfirm = (rule, value, callback) => {
  if (value !== form.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newUsername: [{ required: true, message: '请输入新用户名', trigger: 'blur' }],
  newPassword: [{ required: true, message: '请输入新密码', trigger: 'blur' }],
  confirmPassword: [{ required: true, validator: validateConfirm, trigger: 'blur' }]
}

const handleSubmit = async () => {
  // 先过表单校验，失败直接返回（字段内联报错）
  try {
    await formRef.value.validate()
  } catch (e) {
    return
  }
  try {
    await changeCredentials({
      oldUsername: form.oldUsername,
      oldPassword: form.oldPassword,
      newUsername: form.newUsername,
      newPassword: form.newPassword
    })
    // 改密成功：清除强制改密态，进入正常后台
    adminStore.setForceChange(false)
    router.push('/admin/dashboard')
  } catch (e) {
    // 失败原因已由 request 拦截器以 ElMessage 提示（如「原密码错误」）
  }
}
</script>

<style scoped>
.force-change-page {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f5f7fa;
}
.force-change-card {
  width: 460px;
}
.force-change-card h2 {
  text-align: center;
  margin-bottom: 8px;
}
.tip {
  color: #e6a23c;
  font-size: 13px;
  margin-bottom: 16px;
  text-align: center;
  line-height: 1.6;
}
</style>
