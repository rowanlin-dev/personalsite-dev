import request from './request'

// 博客合集接口。所有响应经 request 拦截器返回完整 { code, data, msg }，
// 故此处统一 .then(r => r.data) 取业务负载（与 assets.js 一致）。
//
// 后台写接口位于 /api/admin/collections/**，自动受登录拦截器保护；
// 读接口 getCollectionArticles 位于 /api/collections/**（公开）。
//
//   GET    /admin/collections                       -> 合集数组（含 articleCount）
//   POST   /admin/collections                       -> 新建合集（body 无 id）
//   POST   /admin/collections/save                  -> upsert（body 含 id 即重命名/改元数据）
//   DELETE /admin/collections/{id}                  -> 删除合集（级联清关联行）
//   POST   /admin/collections/{id}/articles         -> 批量加入文章 { articleIds:[...] }
//   DELETE /admin/collections/{id}/articles/{aid}   -> 移除单篇
//   PUT    /admin/collections/{id}/articles/sort    -> 排序 { orderedArticleIds:[...] }
//   GET    /collections/{id}/articles               -> 公开合集详情（元信息 + 排序标题列表）

export const getCollections = () =>
  request.get('/admin/collections').then(r => r.data || [])

export const createCollection = (data) =>
  request.post('/admin/collections', data).then(r => r.data)

export const saveCollection = (data) =>
  request.post('/admin/collections/save', data).then(r => r.data)

export const deleteCollection = (id) =>
  request.delete(`/admin/collections/${id}`).then(r => r.data)

export const addArticlesToCollection = (collectionId, articleIds) =>
  request
    .post(`/admin/collections/${collectionId}/articles`, { articleIds })
    .then(r => r.data)

export const removeArticleFromCollection = (collectionId, articleId) =>
  request
    .delete(`/admin/collections/${collectionId}/articles/${articleId}`)
    .then(r => r.data)

export const sortCollectionArticles = (collectionId, orderedArticleIds) =>
  request
    .put(`/admin/collections/${collectionId}/articles/sort`, { orderedArticleIds })
    .then(r => r.data)

export const getCollectionArticles = (id) =>
  request.get(`/collections/${id}/articles`).then(r => r.data)
