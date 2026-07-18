// ═══════════════════════════════════════════════════════════════
// 请求工具 — 基于 axios 二次封装
// 自动注入 token + 统一错误处理（401/403/500/网络断开）
// ═══════════════════════════════════════════════════════════════

import axios, { type AxiosRequestConfig, type AxiosInstance } from 'axios'

// ─── 类型 ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface RequestError {
  message: string
  code: number
  url: string
}

// ─── 实例 ──────────────────────────────────────────────────────

const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
})

// ─── 请求拦截器 — 注入 token ───────────────────────────────────

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

// ─── 响应拦截器 — 统一错误处理 ─────────────────────────────────

instance.interceptors.response.use(
  (response) => {
    const res = response.data as ApiResponse
    // 业务层 code !== 200 视为错误
    if (res.code !== 200) {
      return Promise.reject({
        message: res.message || '请求失败',
        code: res.code,
        url: response.config.url ?? '',
      } satisfies RequestError)
    }
    return response
  },
  (error) => {
    // 网络层错误 — 按 HTTP 状态码分发
    if (error.response) {
      const { status, config } = error.response
      const url = config?.url ?? ''

      if (status === 401) {
        // 未授权 → 清 token 并跳转登录页
        localStorage.removeItem('token')
        window.location.href = '/login'
        return Promise.reject({
          message: '登录已过期，请重新登录',
          code: 401,
          url,
        } satisfies RequestError)
      }

      if (status === 403) {
        return Promise.reject({
          message: '无权限访问',
          code: 403,
          url,
        } satisfies RequestError)
      }

      if (status >= 500) {
        return Promise.reject({
          message: '服务器异常，请稍后重试',
          code: status,
          url,
        } satisfies RequestError)
      }
    }

    // 网络断开 / 超时
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return Promise.reject({
        message: '请求超时，请检查网络后重试',
        code: 0,
        url: error.config?.url ?? '',
      } satisfies RequestError)
    }

    if (!error.response) {
      return Promise.reject({
        message: '网络异常，请检查连接',
        code: 0,
        url: error.config?.url ?? '',
      } satisfies RequestError)
    }

    return Promise.reject(error)
  },
)

// ─── 请求方法 ──────────────────────────────────────────────────

async function get<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await instance.get<ApiResponse<T>>(url, config)
  return response.data.data
}

async function post<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await instance.post<ApiResponse<T>>(url, data, config)
  return response.data.data
}

async function put<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await instance.put<ApiResponse<T>>(url, data, config)
  return response.data.data
}

async function del<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await instance.delete<ApiResponse<T>>(url, config)
  return response.data.data
}

// ─── 导出 ──────────────────────────────────────────────────────

const request = { get, post, put, delete: del }
export default request
export { instance as requestInstance }
