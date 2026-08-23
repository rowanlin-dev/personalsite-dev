<script setup>
/**
 * 变异测试夹具（非产品代码，勿引用）。
 * 复刻 BUG-1 修复前的写法，用于验证 qa-test-keepalive-seo.mjs 的用例7
 * 确实能够识别出「缺少同步守卫」的错误实现。
 */
const loadedId = ref(null)

const loadArticle = async (id) => {
  const [detailRes, listRes] = await Promise.all([
    getArticleDetail(id),
    getArticleList({ page: 1, size: 5 })
  ])
  article.value = detailRes.data
  hotArticles.value = listRes.data.list
  loadedId.value = String(id)
  setArticleSeo(article.value)
}

onMounted(async () => {
  await loadArticle(route.params.id)
})

onActivated(async () => {
  const id = route.params.id
  if (id && String(id) !== loadedId.value) {
    article.value = null
    await loadArticle(id)
  } else if (article.value) {
    setArticleSeo(article.value)
  }
})
</script>
