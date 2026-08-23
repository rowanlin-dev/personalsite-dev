import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getCollections } from '../api/collection'

// 合集全局状态：供 CollectionPickerModal 与管理页共用。
// list 为合集数组（每项含实时 articleCount），load() 拉取最新数据。
export const useCollectionsStore = defineStore('collections', () => {
  const list = ref([])

  const load = async () => {
    list.value = await getCollections()
    return list.value
  }

  return { list, load }
})
