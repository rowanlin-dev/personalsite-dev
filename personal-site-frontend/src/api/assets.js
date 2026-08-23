import request from './request'

// 素材库后端接口（/api/admin/assets/**）。所有响应经 request 拦截器返回完整 { code, data, msg }，
// 故此处统一 .then(r => r.data) 取业务负载。
//
// 约定的响应结构（需与 personal-site-backend 的 AssetController 对齐）：
//   GET    /zones            -> 分区数组：{ key, label, group, dynamic, source? }
//   GET    /list?prefix=     -> 文件数组：{ key, url, size, lastModified, owner }
//   POST   /upload?prefix=   -> 成功数组：[{ key, url }]（multipart 字段名 "files"）
//   DELETE /objects          -> 删除结果（body 为 key 字符串数组）
//   GET    /sign?key=        -> 签名/公开 URL 字符串（私密对象用）
//   POST   /copy?fromPrefix=&toPrefix= -> 复制前缀下对象，返回 [{ oldKey, oldUrl, newKey, newUrl }]（只复制不删源）
//   POST   /import-url?url=&prefix=    -> 收录同桶外部 URL，返回 { key, url }

export const getZones = () =>
  request.get('/admin/assets/zones').then(r => r.data || [])

export const listAssets = (prefix) =>
  request.get('/admin/assets/list', { params: { prefix } }).then(r => r.data || [])

export const uploadAssets = (prefix, files) => {
  const formData = new FormData()
  // files: File 数组，统一走 "files" 字段（后端一次性接收多个）
  for (const f of files) formData.append('files', f)
  // 注意：不要手动设置 Content-Type。浏览器对 FormData 会自动补上
  // `multipart/form-data; boundary=...`，缺 boundary 会导致 Spring 解析失败（P0）。
  return request
    .post('/admin/assets/upload', formData, {
      params: { prefix }
    })
    .then(r => r.data || [])
}

export const removeAssets = (keys) =>
  request.delete('/admin/assets/objects', { data: keys }).then(r => r.data)

export const signAsset = (key) =>
  request.get('/admin/assets/sign', { params: { key } }).then(r => r.data)

// Q3：迁移前缀（draft-xxx -> <id>），返回 [{ oldKey, oldUrl, newKey, newUrl }]
// 注意：后端未提供 /move 端点，迁移语义由「copy（本接口）+ 前端后续 removeAssets 删源」两步实现。
// 故此处调用 /admin/assets/copy，与 AssetController.copyPrefix 对齐（只复制不删源）。
export const moveAssets = (fromPrefix, toPrefix) =>
  request.post('/admin/assets/copy', null, { params: { fromPrefix, toPrefix } }).then(r => r.data || [])

// Q4：收录同桶外部 URL 到目标前缀，返回 { key, url }
export const importAssetUrl = (url, prefix) =>
  request.post('/admin/assets/import-url', null, { params: { url, prefix } }).then(r => r.data || {})
