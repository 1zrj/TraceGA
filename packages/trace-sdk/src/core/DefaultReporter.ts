// ─── 导入 ───────────────────────────────────────────────────

import type { EventPriority, ResolvedTraceConfig, TraceReporter, TrackEventData } from '../types'
import { deepClone, safeJsonStringify } from '../utils'

// ─── 常量 ───────────────────────────────────────────────────

/** 批量上报端点后缀 */
const BATCH_ENDPOINT = '/batch'

/** 最大重试次数 */
const MAX_RETRY_ATTEMPTS = 2

/** JSON 内容类型 */
const CONTENT_TYPE_JSON = 'application/json'

/** 错误上下文标识 */
const ERROR_CONTEXT = {
  TRANSPORT: 'report.transport',
  TRANSPORT_UNAVAILABLE: 'report.transport.unavailable',
  BEACON: 'report.beacon',
} as const

// ─── 类型 ───────────────────────────────────────────────────

/** 批量上报任务 */
interface BatchJob {
  /** 已重试次数 */
  attempts: number
  /** 待上报的事件列表 */
  events: TrackEventData[]
}

/** 错误处理器类型 */
type ReporterErrorHandler = (error: unknown, context: string) => void

// ─── 工具函数 ───────────────────────────────────────────────

/**
 * 根据上报地址构造批量上报 URL。
 * 始终将 pathname 结尾替换为 `/batch`，移除 hash。
 *
 * @param reportUrl - 原始上报地址
 * @returns 批量上报完整 URL
 */
function getBatchUrl(reportUrl: string): string {
  const baseUrl = typeof window !== 'undefined' && window.location?.href ? window.location.href : 'http://tracega.local/'
  const parsedUrl = new URL(reportUrl, baseUrl)

  if (!parsedUrl.pathname.endsWith(BATCH_ENDPOINT)) {
    parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/$/, '')}${BATCH_ENDPOINT}`
  }
  parsedUrl.hash = ''
  return parsedUrl.href
}

// ─── DefaultReporter 类 ─────────────────────────────────────

/**
 * 默认上报器实现，负责批量发送埋点事件。
 *
 * 特性：
 * - 批量聚合：按缓冲区大小分批，并发控制发送
 * - 失败重试：指数退避，最多重试 2 次
 * - 页面关闭兜底：pagehide / visibilitychange 时使用 sendBeacon
 * - 传输降级：fetch 不可用时使用 sendBeacon
 */
export class DefaultReporter implements TraceReporter {
  // ── 私有属性 ──────────────────────────────────────────

  private readonly batchUrl: string
  private readonly maxBufferSize: number
  private readonly flushInterval: number
  private readonly maxConcurrentRequests: number
  private readonly fetchImpl: typeof fetch | null

  private eventQueue: TrackEventData[] = []
  private jobQueue: BatchJob[] = []
  private activeJobs = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false
  private transportUnavailableReported = false

  // ── 构造器 ────────────────────────────────────────────

  /**
   * @param config      - 解析后的完整配置
   * @param handleError - 错误处理回调
   */
  constructor(
    config: Readonly<ResolvedTraceConfig>,
    private readonly handleError: ReporterErrorHandler,
  ) {
    this.batchUrl = getBatchUrl(config.reportUrl)
    this.maxBufferSize = config.maxBufferSize
    this.flushInterval = config.flushInterval
    this.maxConcurrentRequests = config.maxConcurrentRequests
    this.fetchImpl = this.captureFetch()

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.handlePageHide)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange)
    }
  }

  // ── 公有方法 ──────────────────────────────────────────

  /**
   * 接收一条埋点事件并加入队列。
   *
   * @param event    - 埋点事件数据
   * @param priority - 事件优先级，urgent 时立即触发上报
   */
  report(event: TrackEventData, priority: EventPriority): void {
    if (this.destroyed) {
      return
    }

    if (!this.fetchImpl && !this.canUseBeacon()) {
      if (!this.transportUnavailableReported) {
        this.transportUnavailableReported = true
        this.handleError(new Error('TraceGA reporting requires fetch or sendBeacon'), ERROR_CONTEXT.TRANSPORT_UNAVAILABLE)
      }
      return
    }

    this.eventQueue.push(deepClone(event))

    if (priority === 'urgent' || this.eventQueue.length >= this.maxBufferSize) {
      this.flush()
      return
    }

    this.scheduleFlush(this.flushInterval)
  }

  /**
   * 手动触发上报，将当前队列中的事件分批发送。
   */
  flush(): void {
    if (this.destroyed || (!this.fetchImpl && !this.canUseBeacon())) {
      return
    }

    this.clearTimer()
    this.createBatchJobs()
    this.pumpJobs()
  }

  /**
   * 销毁上报器，释放所有资源。
   * 销毁前会尝试使用 sendBeacon 发送剩余事件。
   */
  destroy(): void {
    if (this.destroyed) {
      return
    }

    this.flushWithBeacon()
    this.destroyed = true
    this.clearTimer()

    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.handlePageHide)
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    }

    this.eventQueue = []
    this.jobQueue = []
  }

  // ── 私有方法：初始化 ──────────────────────────────────

  /**
   * 捕获 window.fetch 引用，保存 bind 后的版本。
   * 若 fetch 不可用则返回 null。
   */
  private captureFetch(): typeof fetch | null {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      return window.fetch.bind(window)
    }
    return null
  }

  // ── 私有方法：批量处理 ────────────────────────────────

  /**
   * 将事件队列按 maxBufferSize 拆分为批量任务。
   */
  private createBatchJobs(): void {
    while (this.eventQueue.length > 0) {
      this.jobQueue.push({
        attempts: 0,
        events: this.eventQueue.splice(0, this.maxBufferSize),
      })
    }
  }

  /**
   * 并发调度批量任务，受 maxConcurrentRequests 限制。
   * 任务完成后自动检查是否有新任务或新事件。
   */
  private pumpJobs(): void {
    if (this.destroyed || !this.fetchImpl) {
      return
    }

    while (this.activeJobs < this.maxConcurrentRequests && this.jobQueue.length > 0) {
      const job = this.jobQueue.shift()
      if (!job) {
        break
      }

      this.activeJobs += 1
      void this.sendJob(job).finally(() => {
        this.activeJobs -= 1

        if (this.jobQueue.length > 0) {
          this.pumpJobs()
        } else if (this.eventQueue.length > 0) {
          this.scheduleFlush(this.flushInterval)
        }
      })
    }
  }

  /**
   * 发送单个批量任务，失败时自动重试。
   *
   * @param job - 批量任务
   */
  private async sendJob(job: BatchJob): Promise<void> {
    try {
      const response = await this.fetchImpl!(this.batchUrl, {
        body: safeJsonStringify({ events: job.events }),
        headers: { 'content-type': CONTENT_TYPE_JSON },
        keepalive: true,
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`TraceGA report failed with status ${response.status}`)
      }
    } catch (error) {
      if (!this.destroyed && job.attempts < MAX_RETRY_ATTEMPTS) {
        const attempts = job.attempts + 1
        this.jobQueue.push({ ...job, attempts })
        return
      }

      this.handleError(error, ERROR_CONTEXT.TRANSPORT)
    }
  }

  // ── 私有方法：定时器 ──────────────────────────────────

  /**
   * 安排延迟上报，已有定时器时跳过。
   *
   * @param delay - 延迟毫秒数
   */
  private scheduleFlush(delay: number): void {
    if (this.destroyed || this.timer) {
      return
    }

    this.timer = setTimeout(() => {
      this.timer = null
      this.flush()
    }, delay)
  }

  /** 清除定时器 */
  private clearTimer(): void {
    if (!this.timer) {
      return
    }

    clearTimeout(this.timer)
    this.timer = null
  }

  // ── 私有方法：页面生命周期 ────────────────────────────

  /** pagehide 事件处理：尝试 sendBeacon 发送剩余事件 */
  private readonly handlePageHide = (): void => {
    this.flushWithBeacon()
  }

  /** visibilitychange 事件处理：页面隐藏时尝试 sendBeacon */
  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.flushWithBeacon()
    }
  }

  // ── 私有方法：Beacon 兜底 ─────────────────────────────

  /** 检查 sendBeacon 是否可用 */
  private canUseBeacon(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
  }

  /**
   * 使用 sendBeacon 发送批量任务。
   * 发送失败的任务保留在 jobQueue 中，等待后续定时上报。
   */
  private flushWithBeacon(): void {
    if (this.destroyed || !this.canUseBeacon()) {
      this.flush()
      return
    }

    this.clearTimer()
    this.createBatchJobs()

    const unsentJobs: BatchJob[] = []
    this.jobQueue.forEach(job => {
      try {
        const payload = safeJsonStringify({ events: job.events })
        const body = new Blob([payload], { type: CONTENT_TYPE_JSON })

        if (!navigator.sendBeacon(this.batchUrl, body)) {
          unsentJobs.push(job)
        }
      } catch (error) {
        unsentJobs.push(job)
        this.handleError(error, ERROR_CONTEXT.BEACON)
      }
    })

    this.jobQueue = unsentJobs
    if (this.jobQueue.length > 0) {
      this.scheduleFlush(this.flushInterval)
    }
  }
}
