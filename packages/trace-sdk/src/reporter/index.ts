// ─── 导入 ───────────────────────────────────────────────────

import type { TraceConfig, CommonParams, TrackEventData, EnvInfo, TrackEventParams } from '../types'
import { PriorityScheduler } from '../core/PriorityScheduler'
import { HttpTransporter } from '../core/HttpTransporter'
import type { SuccessMeta, FailedMeta, RetryMeta } from '../core/HttpTransporter'
import { LifecycleManager } from '../core/LifecycleManager'
import { StoragePersister } from '../utils/StoragePersister'
import { ConcurrencyLimiter } from '../core/ConcurrencyLimiter'

// ─── 常量 ───────────────────────────────────────────────────

/** 默认配置 */
const DEFAULT_CONFIG: Readonly<Partial<TraceConfig>> = Object.freeze({
  sampleRate: 1,
  maxBufferSize: 30,
  flushInterval: 5000,
})

/** 最大并发请求数 */
const MAX_CONCURRENT_REQUESTS = 5

/** 传输超时时间（毫秒） */
const TRANSPORT_TIMEOUT = 10_000

// ─── 类型 ───────────────────────────────────────────────────

/** 事件钩子类型 */
export type ReporterEvent = 'success' | 'failed' | 'retry'

/** 事件回调类型，根据事件类型约束 meta 参数 */
export type ReporterCallback<T extends ReporterEvent = ReporterEvent> = (meta: T extends 'success' ? SuccessMeta : T extends 'failed' ? FailedMeta : RetryMeta) => void

/** 扩展的埋点事件，包含额外元数据（用于序列化传输） */
interface EnrichedTrackEvent extends TrackEventData {
  customParams: TrackEventParams
  commonParams: CommonParams
  envInfo: EnvInfo
}

export { SuccessMeta, FailedMeta, RetryMeta }

// ─── Reporter 类 ────────────────────────────────────────────

/**
 * Reporter 主类，实现 ITraceCore 接口，组合所有核心模块。
 *
 * 架构：
 * ```
 * Reporter
 *   ├── PriorityScheduler  — 三队列优先级调度
 *   ├── HttpTransporter    — Fetch + 重试 + 事件钩子
 *   ├── LifecycleManager   — 页面隐藏时 sendBeacon 兜底
 *   ├── StoragePersister   — 失败缓存
 *   └── ConcurrencyLimiter — 并发控制
 * ```
 */
export class Reporter {
  // ── 私有属性 ──────────────────────────────────────────

  private config!: Readonly<TraceConfig>
  private scheduler!: PriorityScheduler
  private transporter!: HttpTransporter
  private lifecycle!: LifecycleManager
  private persister!: StoragePersister
  private limiter!: ConcurrencyLimiter
  private commonParams: CommonParams = {}
  private envInfo!: EnvInfo
  private readonly listeners = new Map<ReporterEvent, ReporterCallback[]>()
  private registered = false

  // ── 构造器 ────────────────────────────────────────────

  /**
   * @param config - 可选，传入后自动调用 register 初始化
   */
  constructor(config?: TraceConfig) {
    if (config) {
      this.register(config)
    }
  }

  // ── 公有方法 ──────────────────────────────────────────

  /**
   * 注册（或重新注册）Reporter，初始化所有子模块。
   * 若已注册会先销毁旧实例。
   *
   * @param config - SDK 配置
   */
  register(config: TraceConfig): void {
    if (this.registered) {
      this.destroy()
    }

    this.config = Object.freeze({ ...DEFAULT_CONFIG, ...config })
    this.commonParams = {}
    this.envInfo = this.collectEnvInfo()

    this.initSubModules()
    this.bindTransporterEvents()

    this.registered = true
  }

  /**
   * 注册事件监听器，支持 `'success'`、`'failed'`、`'retry'` 三种事件。
   *
   * @param event    - 事件类型
   * @param callback - 回调函数，meta 参数类型由事件类型决定
   */
  on<T extends ReporterEvent>(event: T, callback: ReporterCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback as ReporterCallback)
  }

  /**
   * 移除事件监听器。
   *
   * @param event    - 事件类型
   * @param callback - 待移除的回调函数
   */
  off<T extends ReporterEvent>(event: T, callback: ReporterCallback<T>): void {
    const cbs = this.listeners.get(event)
    if (!cbs) return
    const idx = cbs.indexOf(callback as ReporterCallback)
    if (idx !== -1) cbs.splice(idx, 1)
  }

  /**
   * 埋点上报：组装 TrackEventData 并以 normal 优先级入队。
   *
   * @param eventName - 事件名称
   * @param params    - 自定义参数
   */
  trackEvent(eventName: string, params?: TrackEventParams): void {
    if (!this.registered) return

    // 采样过滤
    if (this.config.sampleRate !== undefined && this.config.sampleRate < 1 && Math.random() > this.config.sampleRate) {
      return
    }

    const event: EnrichedTrackEvent = {
      eventType: 'custom',
      eventName,
      appId: this.config.projectId,
      properties: { ...this.commonParams, ...(params ?? {}) },
      timestamp: Date.now(),
      url: this.envInfo.url,
      referrer: this.envInfo.referrer,
      customParams: params ?? {},
      commonParams: { ...this.commonParams },
      envInfo: this.envInfo,
    }

    this.scheduler.add('normal', event)
  }

  /**
   * 添加公共参数，后续所有 trackEvent 调用都会携带。
   *
   * @param params - 键值对参数
   */
  addCommonParams(params: CommonParams): void {
    Object.assign(this.commonParams, params)
  }

  /**
   * 移除指定 key 的公共参数。
   *
   * @param keys - 待移除的 key 列表
   */
  removeCommonParams(keys: string[]): void {
    for (const key of keys) {
      delete this.commonParams[key]
    }
  }

  /**
   * 设置用户 ID，会同时更新 envInfo 和公共参数。
   *
   * @param userId - 用户 ID
   */
  setUser(userId: string): void {
    this.envInfo.uid = userId
    this.commonParams['uid'] = userId
  }

  /**
   * 获取当前环境信息（返回副本，防止外部篡改）。
   *
   * @returns 环境信息副本
   */
  getEnvInfo(): EnvInfo {
    return { ...this.envInfo }
  }

  /**
   * 手动立即刷新上报所有缓冲数据。
   */
  flush(): void {
    this.scheduler?.flush()
  }

  /**
   * 销毁 Reporter 及所有子模块，释放资源。
   * 销毁后不再响应任何操作。
   */
  destroy(): void {
    if (!this.registered) return

    this.lifecycle?.destroy()
    this.scheduler?.destroy()
    this.transporter?.destroy()
    this.limiter?.destroy()
    this.listeners.clear()
    this.registered = false
  }

  // ── 私有方法 ──────────────────────────────────────────

  /**
   * 触发事件，通知所有注册的监听器。
   * 单个监听器异常不影响其他监听器。
   */
  private emit(event: ReporterEvent, meta: SuccessMeta | FailedMeta | RetryMeta): void {
    const cbs = this.listeners.get(event)
    if (!cbs) return
    for (const cb of cbs) {
      try {
        cb(meta)
      } catch {
        // 监听器异常不影响主流程
      }
    }
  }

  /** 初始化所有子模块 */
  private initSubModules(): void {
    this.persister = new StoragePersister()
    this.limiter = new ConcurrencyLimiter(MAX_CONCURRENT_REQUESTS)
    this.transporter = this.createTransporter()
    this.scheduler = this.createScheduler()
    this.lifecycle = this.createLifecycleManager()
  }

  /** 创建 HttpTransporter 实例 */
  private createTransporter(): HttpTransporter {
    return new HttpTransporter({
      baseURL: this.config.reportUrl,
      timeout: TRANSPORT_TIMEOUT,
      persister: this.persister,
    })
  }

  /** 创建 PriorityScheduler 实例 */
  private createScheduler(): PriorityScheduler {
    return new PriorityScheduler({
      maxBufferSize: this.config.maxBufferSize!,
      flushInterval: this.config.flushInterval!,
      onFlush: async (events: TrackEventData[]) => {
        await this.transporter.send(events, events.length)
      },
      persister: this.persister,
      limiter: this.limiter,
    })
  }

  /** 创建 LifecycleManager 实例 */
  private createLifecycleManager(): LifecycleManager {
    return new LifecycleManager({
      reportUrl: this.config.reportUrl,
      getRemainingEvents: () => this.scheduler.takeAll(),
      pauseScheduler: () => this.scheduler.pause(),
      destroyScheduler: () => this.scheduler.destroy(),
    })
  }

  /** 将 transporter 的事件钩子转发为 Reporter 事件 */
  private bindTransporterEvents(): void {
    this.transporter.on('success', (meta: SuccessMeta) => this.emit('success', meta))
    this.transporter.on('failed', (meta: FailedMeta) => this.emit('failed', meta))
    this.transporter.on('retry', (meta: RetryMeta) => this.emit('retry', meta))
  }

  /**
   * 采集当前浏览器环境信息。
   */
  private collectEnvInfo(): EnvInfo {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const screenWidth = typeof screen !== 'undefined' ? screen.width : 0
    const screenHeight = typeof screen !== 'undefined' ? screen.height : 0
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0

    return {
      browser: this.detectBrowser(ua),
      browserVersion: '',
      os: this.detectOS(ua),
      osVersion: '',
      screenWidth,
      screenHeight,
      viewportWidth,
      viewportHeight,
      uid: '',
      url: typeof location !== 'undefined' ? location.href : '',
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      userAgent: ua,
    }
  }

  /**
   * 简易浏览器检测。
   */
  private detectBrowser(ua: string): string {
    if (ua.includes('Edg/')) return 'Edge'
    if (ua.includes('Chrome/')) return 'Chrome'
    if (ua.includes('Firefox/')) return 'Firefox'
    if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari'
    return 'Unknown'
  }

  /**
   * 简易操作系统检测。
   */
  private detectOS(ua: string): string {
    if (ua.includes('Windows')) return 'Windows'
    if (ua.includes('Mac OS')) return 'macOS'
    if (ua.includes('Linux')) return 'Linux'
    if (ua.includes('Android')) return 'Android'
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
    return 'Unknown'
  }
}
