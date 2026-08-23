import request from './request'

export const getTagList = () => request.get('/tag/list')
export const getTagListWithAliases = () => request.get('/tag/list-with-aliases')
export const getTagCloud = () => request.get('/tag/cloud')
export const getTagTree = () => request.get('/tag/tree')
export const searchTags = (keyword) => request.get('/tag/search', { params: { keyword } })
export const saveTag = (data) => request.post('/tag/save', data)
export const deleteTag = (id) => request.post('/tag/delete', null, { params: { id } })

export const getTagAliases = (tagId) => request.get('/tag/alias', { params: { tagId } })
export const saveTagAlias = (data) => request.post('/tag/alias/save', data)
export const deleteTagAlias = (id) => request.post('/tag/alias/delete', null, { params: { id } })

export const getTechMapData = () => request.get('/tag/tech-map')
