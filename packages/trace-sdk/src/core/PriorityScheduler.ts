import { EventBuffer } from './EventBuffer'
import type { TrackEventData } from '../types'
import type { StoragePersister } from '../utils/StoragePersister'
import type { ConcurrencyLimiter } from './ConcurrencyLimiter'

// ─── 常量 ───────────────────────────────────────────────────

/** 失败缓存键名 */
const FAILED_CACHE_KEY = 'trace_failed_cache'
/** 空闲调度降级超时默认值（毫秒） */
const DEFAULT_IDLE_TIMEOUT = 3000

// ─── 类型 ───────────────────────────────────────────────────

export type Priority = 'urgent' | 'high' | 'normal'

export interface PrioritySchedulerConfig {
  /** 普通 & 高优先级队列的最大容量 */
  maxBufferSize: number
  /** 紧急队列的独立最大容量，默认与 maxBufferSize 一致 */
  urgentMaxSize?: number
  /** 定时上报间隔（毫秒） */
  flushInterval: number
  /** 上报回调，接收按优先级排序的事件数组 */
  onFlush: (events: TrackEventData[]) => Promise<void>
  /** requestIdleCallback 降级超时（毫秒），默认 3000 */
  idleTimeoutFallback?: number
  /** 持久化工具，用于初始化时补发 localStorage 中残留的失败缓存 */
  persister?: StoragePersister
  /** 并发限制器，用于控制同时进行的上报请求数 */
  limiter?: ConcurrencyLimiter
}

// ─── PriorityScheduler ──────────────────────────────────────

/**
 * 优先级调度器，基于三队列实现优先级上报与空闲调度。
 *
 * 三队列优先级：urgent > high > normal
 *
 * 上报顺序：每次 `onFlush` 按 urgent → high → normal 顺序拼接全部数据
 *
 * 触发机制：
 * - **定时触发**：每隔 `flushInterval` 毫秒执行全量上报
 * - **阈值触发**：任一队列满时立即全量上报，并重置定时器
 * - **空闲调度**：使用 `requestIdleCallback`（降级为 `setTimeout`）
 *   在浏览器空闲时仅上报 normal 队列，不触发 urgent/high
 */
export class PriorityScheduler {
  private readonly urgentBuffer: EventBuffer<TrackEventData>
  private readonly highBuffer: EventBuffer<TrackEventData>
  private readonly normalBuffer: EventBuffer<TrackEventData>

  private readonly maxBufferSize: number
  private readonly urgentMaxSize: number
  private readonly flushInterval: number
  private readonly onFlush: (events: TrackEventData[]) => Promise<void>
  private readonly idleTimeoutFallback: number
  private readonly persister: StoragePersister | undefined
  private readonly limiter: ConcurrencyLimiter | undefined

  private timerId: ReturnType<typeof setTimeout> | null = null
  private idleId: number | null = null
  private flushing = false
  private destroyed = false

  constructor(config: PrioritySchedulerConfig) {
    this.maxBufferSize = config.maxBufferSize
    this.urgentMaxSize = config.urgentMaxSize ?? config.maxBufferSize
    this.flushInterval = config.flushInterval
    this.onFlush = config.onFlush
    this.idleTimeoutFallback = config.idleTimeoutFallback ?? DEFAULT_IDLE_TIMEOUT
    this.persister = config.persister
    this.limiter = config.limiter

    this.urgentBuffer = new EventBuffer<TrackEventData>(this.urgentMaxSize)
    this.highBuffer = new EventBuffer<TrackEventData>(this.maxBufferSize)
    this.normalBuffer = new EventBuffer<TrackEventData>(this.maxBufferSize)

    this.scheduleNext()
    this.scheduleIdle()
    this.recoverFailedCache()
  }

  // ── 公开 API ──

  /**
   * 按优先级向对应队列添加一条事件。
   * 若该队列达到容量上限，立即触发全量上报并重置定时器。
   *
   * @param priority - 优先级：`'urgent'` | `'high'` | `'normal'`
   * @param event - 待添加的埋点事件
   */
  add(priority: Priority, event: TrackEventData): void {
    const buffer = this.getBuffer(priority)
    buffer.push(event)

    if (this.shouldThresholdFlush(priority)) {
      this.clearTimer()
      this.flushAndReschedule()
    }
  }

  /**
   * 手动立即触发全量上报，取出所有队列数据合并后传递给 `onFlush`。
   * 执行后重置定时器。
   */
  flush(): void {
    this.clearTimer()
    this.flushAndReschedule()
  }

  /**
   * 暂停调度器定时器（不清空缓冲区），供页面隐藏时使用。
   */
  pause(): void {
    this.clearTimer()
  }

  /**
   * 取出所有队列中的全部数据（不触发上报），用于页面隐藏时通过 sendBeacon 发送。
   *
   * @returns 按 urgent → high → normal 顺序拼接的事件数组
   */
  takeAll(): TrackEventData[] {
    return [...this.urgentBuffer.takeAll(), ...this.highBuffer.takeAll(), ...this.normalBuffer.takeAll()]
  }

  /**
   * 销毁调度器，清除定时器、空闲回调并清空所有缓冲区。
   * 销毁后不再触发任何上报。
   */
  destroy(): void {
    this.destroyed = true
    this.clearTimer()
    this.cancelIdle()
    this.urgentBuffer.clear()
    this.highBuffer.clear()
    this.normalBuffer.clear()
  }

  // ── 定时器 ──

  /**
   * 安排下一次定时全量上报。
   * 已销毁时跳过。
   */
  private scheduleNext(): void {
    if (this.destroyed) return
    this.timerId = setTimeout(() => this.flushAndReschedule(), this.flushInterval)
  }

  /**
   * 清除当前定时器。
   */
  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }

  // ── 失败缓存恢复 ──

  /**
   * 初始化时检查 localStorage 残留缓存，若存在则立即以 urgent 优先级补发。
   * 补发后清除缓存，防止重复上报。
   */
  private recoverFailedCache(): void {
    if (!this.persister) return

    const cached = this.persister.load(FAILED_CACHE_KEY)
    if (!cached) return

    const events: TrackEventData[] = Array.isArray(cached) ? (cached as TrackEventData[]) : [cached as TrackEventData]
    for (const event of events) {
      this.urgentBuffer.push(event)
    }

    this.persister.clear(FAILED_CACHE_KEY)

    if (this.urgentBuffer.size() > 0) {
      this.clearTimer()
      this.flushAndReschedule()
    }
  }

  // ── 上报 ──

  /**
   * 执行上报并重新安排定时器。
   * 上报失败静默处理（已在 transporter 中完成重试/缓存）。
   * 已销毁时跳过定时器调度。
   */
  private async flushAndReschedule(): Promise<void> {
    try {
      await this.doFlush()
    } catch {
      // 上报失败已在 transporter 中处理
    }
    if (!this.destroyed) {
      this.scheduleNext()
    }
  }

  /**
   * 执行全量上报：按 urgent → high → normal 顺序拼接所有队列数据。
   * 使用 `flushing` 锁防止并发。
   */
  private async doFlush(): Promise<void> {
    if (this.flushing) return

    const events = [...this.urgentBuffer.takeAll(), ...this.highBuffer.takeAll(), ...this.normalBuffer.takeAll()]

    if (events.length === 0) return

    this.flushing = true
    try {
      await this.limiter?.acquire()
      try {
        await this.onFlush(events)
      } finally {
        this.limiter?.release()
      }
    } finally {
      this.flushing = false
    }
  }

  // ── 空闲调度 ──

  /**
   * 注册空闲回调：使用 `requestIdleCallback`，降级为 `setTimeout`。
   * 已销毁时跳过。
   */
  private scheduleIdle(): void {
    if (this.destroyed) return

    if (typeof requestIdleCallback === 'function') {
      this.idleId = requestIdleCallback(() => this.onIdleFlush(), { timeout: this.idleTimeoutFallback })
    } else {
      this.idleId = setTimeout(() => this.onIdleFlush(), this.idleTimeoutFallback) as unknown as number
    }
  }

  /**
   * 取消当前空闲回调。
   */
  private cancelIdle(): void {
    if (this.idleId === null) return

    if (typeof cancelIdleCallback === 'function') {
      cancelIdleCallback(this.idleId)
    } else {
      clearTimeout(this.idleId)
    }
    this.idleId = null
  }

  /**
   * 空闲回调处理：仅上报 normal 队列，不触及 urgent/high。
   * 完成后重新注册空闲回调。
   */
  private async onIdleFlush(): Promise<void> {
    await this.flushNormalOnly()
    this.scheduleIdle()
  }

  /**
   * 仅上报 normal 队列数据，不触及 urgent/high。
   */
  private async flushNormalOnly(): Promise<void> {
    if (this.flushing) return

    const events = this.normalBuffer.takeAll()
    if (events.length === 0) return

    this.flushing = true
    try {
      await this.limiter?.acquire()
      try {
        await this.onFlush(events)
      } finally {
        this.limiter?.release()
      }
    } finally {
      this.flushing = false
    }
  }

  // ── 辅助 ──

  /**
   * 根据优先级返回对应的缓冲区。
   */
  private getBuffer(priority: Priority): EventBuffer<TrackEventData> {
    switch (priority) {
      case 'urgent':
        return this.urgentBuffer
      case 'high':
        return this.highBuffer
      case 'normal':
        return this.normalBuffer
    }
  }

  /**
   * 判断对应优先级队列是否已达到阈值，应触发全量上报。
   */
  private shouldThresholdFlush(priority: Priority): boolean {
    switch (priority) {
      case 'urgent':
        return this.urgentBuffer.size() >= this.urgentMaxSize
      case 'high':
        return this.highBuffer.size() >= this.maxBufferSize
      case 'normal':
        return this.normalBuffer.size() >= this.maxBufferSize
    }
  }
}
