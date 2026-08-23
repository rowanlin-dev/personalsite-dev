import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAdminStore = defineStore('admin', () => {
  const username = ref(localStorage.getItem('admin_username') || '')
  // 是否必须修改初始账号密码（来自后端登录响应；持久化避免刷新后丢失遮罩态）
  const forceChange = ref(localStorage.getItem('admin_force_change') === 'true')

  const setUsername = (name) => {
    username.value = name
    localStorage.setItem('admin_username', name)
  }

  const setForceChange = (val) => {
    forceChange.value = !!val
    localStorage.setItem('admin_force_change', forceChange.value ? 'true' : 'false')
  }

  const clear = () => {
    username.value = ''
    forceChange.value = false
    localStorage.removeItem('admin_username')
    localStorage.removeItem('admin_force_change')
  }

  return { username, forceChange, setUsername, setForceChange, clear }
})
