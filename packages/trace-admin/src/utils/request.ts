import axios from 'axios'

interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
})

instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

const request = {
  get: async function <T>(url: string, config?: Parameters<typeof instance.get>[1]) {
    const response = await instance.get<ApiResponse<T>>(url, config)
    const res = response.data
    if (res.code !== 200) {
      console.error(res.message || 'Error')
      throw new Error(res.message || 'Error')
    }
    return res.data
  },
  post: async function <T>(url: string, data?: unknown, config?: Parameters<typeof instance.post>[2]) {
    const response = await instance.post<ApiResponse<T>>(url, data, config)
    const res = response.data
    if (res.code !== 200) {
      console.error(res.message || 'Error')
      throw new Error(res.message || 'Error')
    }
    return res.data
  },
  put: async function <T>(url: string, data?: unknown, config?: Parameters<typeof instance.put>[2]) {
    const response = await instance.put<ApiResponse<T>>(url, data, config)
    const res = response.data
    if (res.code !== 200) {
      console.error(res.message || 'Error')
      throw new Error(res.message || 'Error')
    }
    return res.data
  },
  delete: async function <T>(url: string, config?: Parameters<typeof instance.delete>[1]) {
    const response = await instance.delete<ApiResponse<T>>(url, config)
    const res = response.data
    if (res.code !== 200) {
      console.error(res.message || 'Error')
      throw new Error(res.message || 'Error')
    }
    return res.data
  },
}

export default request