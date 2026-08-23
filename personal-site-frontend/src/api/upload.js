import axios from 'axios'

export const uploadFile = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return axios.post('/api/upload', formData).then(res => res.data)
}
