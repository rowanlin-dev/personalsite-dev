import request from './request'

export const getConfigAll = () => request.get('/config/all')
export const getAbout = () => request.get('/config/about')
export const getContact = () => request.get('/config/contact')
export const getResume = () => request.get('/config/resume')
export const getAvatar = () => request.get('/config/avatar')
export const saveConfig = (key, value) => request.post('/config/save', null, { params: { key, value } })
