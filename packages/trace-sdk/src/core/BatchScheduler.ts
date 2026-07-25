import { EventBuffer } from './EventBuffer'
import type { TrackEventData } from '../types'
import type { ConcurrencyLimiter } from './ConcurrencyLimiter'

export interface BatchSchedulerConfig {
  /** 缓冲区最大容量，达到后立即触发上报 */
  maxBufferSize: number
  /** 定时上报间隔（毫秒） */
  flushInterval: number
  /** 上报回调，接收待上报的事件数组 */
  onFlush: (events: TrackEventData[]) => Promise<void>
  /** 并发限制器，用于控制同时进行的上报请求数 */
  limiter?: ConcurrencyLimiter
}

/**
 * 批量调度器，连接事件缓冲区与上报逻辑。
 *
 * 双触发机制：
 * - **定时触发**：每隔 `flushInterval` 毫秒自动上报
 * - **阈值触发**：缓冲区满时立即上报，并重置定时器防止连续触发
 *
 * 上报失败由底层 transporter 的重试/缓存机制处理，调度器仅静默忽略。
 */
export class BatchScheduler {
  private readonly buffer: EventBuffer<TrackEventData>
  private readonly maxBufferSize: number
  private readonly flushInterval: number
  private readonly onFlush: (events: TrackEventData[]) => Promise<void>
  private readonly limiter: ConcurrencyLimiter | undefined

  private timerId: ReturnType<typeof setTimeout> | null = null
  private flushing = false
  private destroyed = false

  constructor(config: BatchSchedulerConfig) {
    this.maxBufferSize = config.maxBufferSize
    this.flushInterval = config.flushInterval
    this.onFlush = config.onFlush
    this.limiter = config.limiter
    this.buffer = new EventBuffer<TrackEventData>(config.maxBufferSize)

    this.scheduleNext()
  }

  // ── 公开 API ──

  /**
   * 向缓冲区添加一条事件。
   * 若当前缓冲区数量达到 `maxBufferSize`，立即触发上报并重置定时器。
   *
   * @param event - 待添加的埋点事件
   */
  add(event: TrackEventData): void {
    this.buffer.push(event)

    if (this.buffer.size() >= this.maxBufferSize) {
      this.clearTimer()
      this.flushAndReschedule()
    }
  }

  /**
   * 手动立即触发上报，取出缓冲区中全部数据并传递给 `onFlush`。
   * 执行后重置定时器。
   */
  flush(): void {
    this.clearTimer()
    this.flushAndReschedule()
  }

  /**
   * 销毁调度器，清除定时器并清空缓冲区。
   * 销毁后 `add` / `flush` 无效果，定时器不再调度。
   */
  destroy(): void {
    this.destroyed = true
    this.clearTimer()
    this.buffer.clear()
  }

  // ── 私有方法 ──

  /**
   * 安排下一次定时上报。
   * 已销毁时跳过。
   */
  private scheduleNext(): void {
    if (this.destroyed) return
    this.timerId = setTimeout(() => this.flushAndReschedule(), this.flushInterval)
  }

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
   * 清除当前定时器。
   */
  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }

  /**
   * 执行上报：取出缓冲区全部数据，若非空则调用 `onFlush`。
   * 使用 `flushing` 锁防止并发上报。
   */
  private async doFlush(): Promise<void> {
    if (this.flushing) return

    const events = this.buffer.takeAll()
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
}
