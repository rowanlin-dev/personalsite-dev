import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getZones, listAssets, uploadAssets, removeAssets, signAsset } from '../api/assets'

// 素材库全局状态：供 AssetLibrary 页面与 ArticleEdit/ProjectEdit「选用回写」共享。
export const useAssetsStore = defineStore('assets', () => {
  const zones = ref([])           // 分区定义（来自 /zones）
  const currentPrefix = ref('')   // 当前选中的 COS 前缀
  const items = ref([])           // 当前前缀下的文件列表
  const selectedKeys = ref([])    // 网格中选中的 key
  const lastPickedUrl = ref('')   // AssetLibrary「选用」写入、编辑页读取后清空

  const setLastPickedUrl = (url) => {
    lastPickedUrl.value = url || ''
  }

  const clearLastPickedUrl = () => {
    lastPickedUrl.value = ''
  }

  const loadZones = async () => {
    zones.value = await getZones()
    return zones.value
  }

  const loadItems = async (prefix) => {
    currentPrefix.value = prefix || ''
    selectedKeys.value = []
    items.value = await listAssets(currentPrefix.value)
    return items.value
  }

  // 上传 files(File[]) 到 prefix，刷新列表，返回后端回执（含 key）
  const upload = async (prefix, files) => {
    const receipts = await uploadAssets(prefix, files)
    await loadItems(prefix)
    return receipts
  }

  // 批量删除 keys
  const remove = async (keys) => {
    if (!keys || keys.length === 0) return
    await removeAssets(keys)
    await loadItems(currentPrefix.value)
  }

  // 获取签名/公开 URL（私密对象用）
  const sign = async (key) => signAsset(key)

  return {
    zones, currentPrefix, items, selectedKeys, lastPickedUrl,
    setLastPickedUrl, clearLastPickedUrl,
    loadZones, loadItems, upload, remove, sign
  }
})
