import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { message } from 'antd'
import { ErrorCode } from '@/types'

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
})

// ─── 错误码中文映射 ───────────────────────────────────────
const ERROR_MESSAGES: Record<number, string> = {
  [ErrorCode.BAD_REQUEST]: '请求参数错误',
  [ErrorCode.UNAUTHORIZED]: '登录已过期，请重新登录',
  [ErrorCode.FORBIDDEN]: '没有操作权限',
  [ErrorCode.NOT_FOUND]: '请求的资源不存在',
  [ErrorCode.INTERNAL_ERROR]: '服务器异常，请稍后重试',
  [ErrorCode.EVENT_NOT_FOUND]: '事件不存在',
  [ErrorCode.EVENT_NAME_EXISTS]: '事件名称已存在',
  [ErrorCode.TRACK_VALIDATION_ERROR]: '埋点数据校验失败',
  [ErrorCode.TRACK_RATE_LIMIT]: '请求频率过高，请稍后重试',
  [ErrorCode.ANALYSIS_QUERY_ERROR]: '数据分析查询失败',
  [ErrorCode.ALARM_RULE_NOT_FOUND]: '告警规则不存在',
  [ErrorCode.AI_SERVICE_ERROR]: 'AI 服务异常，请稍后重试',
}

function getErrorMessage(code: number, fallback: string): string {
  return ERROR_MESSAGES[code] || fallback
}

// ─── 请求拦截器 ──────────────────────────────────────────
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ─── 响应拦截器 ──────────────────────────────────────────
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data

    if (res.code === ErrorCode.SUCCESS) {
      return res.data
    }

    // 未授权：清除 Token 并跳转登录
    if (res.code === ErrorCode.UNAUTHORIZED) {
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      message.error(ERROR_MESSAGES[ErrorCode.UNAUTHORIZED])
      window.location.href = '/login'
      return Promise.reject(new Error(ERROR_MESSAGES[ErrorCode.UNAUTHORIZED]))
    }

    const errMsg = getErrorMessage(res.code, res.msg || '请求失败')
    message.error(errMsg)
    return Promise.reject(new Error(errMsg))
  },
  (error) => {
    if (axios.isCancel(error)) {
      // 请求被手动取消（AbortController），静默处理
      return Promise.reject(error)
    }

    if (error.code === 'ERR_NETWORK') {
      message.error('网络异常，请检查网络连接')
    } else if (error.code === 'ECONNABORTED') {
      message.error('请求超时，请稍后重试')
    } else {
      const status = error.response?.status
      if (status && ERROR_MESSAGES[status]) {
        message.error(ERROR_MESSAGES[status])
      } else {
        message.error(error.message || '服务器异常')
      }
    }
    return Promise.reject(error)
  },
)

// ─── 类型安全的请求方法 ──────────────────────────────────
interface RequestInstance {
  get<T = unknown>(url: string, config?: Record<string, unknown>): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<T>
  delete<T = unknown>(url: string, config?: Record<string, unknown>): Promise<T>
}

// ─── 请求取消工具 ─────────────────────────────────────────
/**
 * 创建一个可取消的请求控制器
 *
 * 使用示例（React 组件）：
 * ```tsx
 * useEffect(() => {
 *   const [signal, cancel] = createCancelToken()
 *   fetchData(signal)
 *   return () => cancel('组件卸载，取消请求')
 * }, [])
 * ```
 */
export function createCancelToken() {
  const controller = new AbortController()
  return [controller.signal, () => controller.abort()] as const
}

export default service as unknown as RequestInstance
