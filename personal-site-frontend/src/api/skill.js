import request from './request'

export const getSkillList = (params) => request.get('/skill/list', { params })
export const getSkillAll = () => request.get('/skill/all')
export const getSkillDetail = (id) => request.get('/skill/detail', { params: { id } })
export const getSkillRadar = () => request.get('/skill/radar')
export const saveSkill = (data) => request.post('/skill/save', data)
export const createSkillFromTag = (tagId, level = 0) => request.post('/skill/create-from-tag', { tagId, level })
export const deleteSkill = (id) => request.post('/skill/delete', null, { params: { id } })
export const getTechRelations = () => request.get('/tech-relation/list')
export const saveTechRelation = (sourceSkillId, targetSkillId, relationType) =>
  request.post('/tech-relation/save', { sourceSkillId, targetSkillId, relationType })
