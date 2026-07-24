import type { StoragePersister } from '../utils/StoragePersister'

// ─── 常量 ───────────────────────────────────────────────────

/** 默认超时时间（毫秒） */
const DEFAULT_TIMEOUT = 10_000
/** 最大重试次数 */
const MAX_RETRIES = 3
/** 指数退避重试间隔（毫秒）：1s → 2s → 4s */
const RETRY_DELAYS = Object.freeze([1000, 2000, 4000])
/** 失败缓存键名 */
const FAILED_CACHE_KEY = 'trace_failed_cache'

// ─── 类型 ───────────────────────────────────────────────────

/** 事件类型 */
export type TransporterEvent = 'success' | 'failed' | 'retry'

/** 成功事件元数据 */
export interface SuccessMeta {
  eventCount: number
  duration: number
}

/** 失败事件元数据 */
export interface FailedMeta {
  error: unknown
  retryTimes: number
}

/** 重试事件元数据 */
export interface RetryMeta {
  currentRetry: number
  delay: number
}

/** 事件回调，根据事件类型分发对应元数据 */
export type TransporterCallback<T extends TransporterEvent = TransporterEvent> = (meta: T extends 'success' ? SuccessMeta : T extends 'failed' ? FailedMeta : RetryMeta) => void

export interface HttpTransporterConfig {
  baseURL: string
  headers?: Record<string, string>
  /** 超时时间（毫秒），默认 10_000 */
  timeout?: number
  /** 持久化工具，用于重试全部失败后缓存数据 */
  persister?: StoragePersister
}

// ─── 错误类 ─────────────────────────────────────────────────

/**
 * 超时错误，当请求超过配置的超时时间时抛出。
 */
export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`请求超时：${timeout}ms`)
    this.name = 'TimeoutError'
  }
}

// ─── HttpTransporter ────────────────────────────────────────

/**
 * 基于 Fetch API 的 HTTP 传输器，内置超时控制与指数退避重试。
 *
 * 重试策略：
 * - 遇到网络断裂、5xx 响应或超时时自动重试
 * - 间隔依次为 1s → 2s → 4s，最多重试 3 次
 * - 全部重试失败后 reject 最终错误，并缓存数据到 localStorage
 *
 * 事件钩子：
 * - `success`：请求成功时触发，携带 `{ eventCount, duration }`
 * - `failed`：全部重试失败后触发，携带 `{ error, retryTimes }`
 * - `retry`：每次重试前触发，携带 `{ currentRetry, delay }`
 */
export class HttpTransporter {
  private readonly baseURL: string
  private readonly headers: Record<string, string>
  private readonly timeout: number
  private readonly persister: StoragePersister | undefined
  private readonly listeners: Map<TransporterEvent, TransporterCallback[]>

  constructor(config: HttpTransporterConfig) {
    this.baseURL = config.baseURL
    this.headers = config.headers ?? {}
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT
    this.persister = config.persister
    this.listeners = new Map()
  }

  // ── 公开 API ──

  /**
   * 注册事件监听器。
   *
   * @param event - 事件类型：`'success'` | `'failed'` | `'retry'`
   * @param callback - 回调函数，接收事件元数据
   */
  on(event: TransporterEvent, callback: TransporterCallback): void {
    let cbs = this.listeners.get(event)
    if (!cbs) {
      cbs = []
      this.listeners.set(event, cbs)
    }
    cbs.push(callback)
  }

  /**
   * 移除事件监听器。
   *
   * @param event - 事件类型
   * @param callback - 要移除的回调函数引用
   */
  off(event: TransporterEvent, callback: TransporterCallback): void {
    const cbs = this.listeners.get(event)
    if (!cbs) return
    const idx = cbs.indexOf(callback)
    if (idx !== -1) cbs.splice(idx, 1)
  }

  /**
   * 发送数据到服务端，失败时自动重试。
   *
   * @param data - 待发送的 JSON 数据
   * @param eventCount - 本次上报的事件数量，用于 success 钩子，默认 1
   * @returns 请求成功时 resolve 的 Promise
   * @throws 全部重试失败后 reject 最终错误
   */
  send(data: unknown, eventCount = 1): Promise<void> {
    const startTime = Date.now()
    return this.requestWithRetry(data, 0, startTime, eventCount)
  }

  /**
   * 销毁实例，清除所有事件监听器。
   */
  destroy(): void {
    this.listeners.clear()
  }

  // ── 私有方法 ──

  /**
   * 触发事件通知。
   * 监听器内部异常被静默捕获，不影响主流程。
   */
  private emit(event: TransporterEvent, meta: unknown): void {
    const cbs = this.listeners.get(event)
    if (!cbs) return
    for (const cb of cbs) {
      try {
        cb(meta as never)
      } catch {
        // 监听器异常不影响主流程
      }
    }
  }

  /**
   * 带重试的请求执行。
   *
   * @param data - 待发送的数据
   * @param attempt - 当前尝试次数（从 0 开始）
   * @param startTime - 请求开始时间戳
   * @param eventCount - 事件数量
   */
  private async requestWithRetry(data: unknown, attempt: number, startTime: number, eventCount: number): Promise<void> {
    try {
      await this.doRequest(data)

      this.emit('success', {
        eventCount,
        duration: Date.now() - startTime,
      } satisfies SuccessMeta)
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt]

        this.emit('retry', {
          currentRetry: attempt + 1,
          delay,
        } satisfies RetryMeta)

        await this.delay(delay)
        return this.requestWithRetry(data, attempt + 1, startTime, eventCount)
      }

      this.emit('failed', {
        error,
        retryTimes: MAX_RETRIES,
      } satisfies FailedMeta)

      this.persister?.save(FAILED_CACHE_KEY, data)
      throw error
    }
  }

  /**
   * 执行单次 HTTP 请求，带超时控制。
   *
   * @param data - 待发送的 JSON 数据
   * @throws TimeoutError 超时时抛出
   * @throws Error HTTP 非 2xx 响应时抛出
   */
  private async doRequest(data: unknown): Promise<void> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TimeoutError(this.timeout)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * 返回一个在指定毫秒后 resolve 的 Promise。
   *
   * @param ms - 延迟毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
