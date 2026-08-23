import request from './request'

export const getProjectList = (params) => request.get('/project/list', { params })
export const getProjectAll = () => request.get('/project/all')
export const getProjectDetail = (id) => request.get('/project/detail', { params: { id } })
export const saveProject = (data) => request.post('/project/save', data)
export const deleteProject = (id) => request.post('/project/delete', null, { params: { id } })
