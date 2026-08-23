import request from './request'

export const getArticleList = (params) => request.get('/article/list', { params })
export const getArticleDetail = (id) => request.get('/article/detail', { params: { id } })
export const getArticleInfo = (id) => request.get('/article/info', { params: { id } })
export const saveArticle = (data) => request.post('/article/save', data)
export const deleteArticle = (id) => request.post('/article/delete', null, { params: { id } })
export const getArticleLiked = (id) => request.get('/article/liked', { params: { id } })
export const likeArticle = (id) => request.post('/article/like', null, { params: { id } })
