import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { message } from 'antd'
import { ErrorCode } from '@/types'

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
})

// 请求拦截器：自动添加 JWT Token
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
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

// 响应拦截器：统一处理响应格式 { code, data, msg }
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data

    // 成功
    if (res.code === ErrorCode.SUCCESS) {
      return res.data
    }

    // 未授权：清除 Token 并跳转登录
    if (res.code === ErrorCode.UNAUTHORIZED) {
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      message.error('登录已过期，请重新登录')
      window.location.href = '/login'
      return Promise.reject(new Error(res.msg || '未授权'))
    }

    // 其他错误
    message.error(res.msg || '请求失败')
    return Promise.reject(new Error(res.msg || '请求失败'))
  },
  (error) => {
    // 网络错误
    if (error.message?.includes('timeout')) {
      message.error('请求超时，请稍后重试')
    } else if (error.message?.includes('Network Error')) {
      message.error('网络异常，请检查网络连接')
    } else {
      message.error(error.message || '服务器异常')
    }
    return Promise.reject(error)
  },
)

// 重写返回类型，因为拦截器已解包 res.data
interface RequestInstance {
  get<T = unknown>(url: string, config?: Record<string, unknown>): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<T>
  delete<T = unknown>(url: string, config?: Record<string, unknown>): Promise<T>
}

export default service as unknown as RequestInstance