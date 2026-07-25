import type { TrackEventData } from '../types'

// ─── 常量 ───────────────────────────────────────────────────

/** sendBeacon 单次 payload 上限（字节），超过则分片 */
const MAX_BEACON_PAYLOAD = 60 * 1024 // 60KB

// ─── 类型 ───────────────────────────────────────────────────

export interface LifecycleManagerConfig {
  /** 上报地址 */
  reportUrl: string
  /** 获取所有缓冲区剩余事件（用于页面隐藏时清空） */
  getRemainingEvents: () => TrackEventData[]
  /** 暂停调度器定时器 */
  pauseScheduler: () => void
  /** 销毁调度器 */
  destroyScheduler: () => void
}

// ─── LifecycleManager ───────────────────────────────────────

/**
 * 页面生命周期管理器。
 *
 * 监听 `visibilitychange` 和 `pagehide` 事件，在页面隐藏时：
 * 1. 暂停主调度器定时器
 * 2. 取出缓冲区所有剩余数据
 * 3. 优先使用 `navigator.sendBeacon()` 发送（单次不超过 60KB，超长分片）
 * 4. 若 `sendBeacon` 不可用，降级为 `fetch` + `keepalive: true`
 */
export class LifecycleManager {
  private readonly reportUrl: string
  private readonly getRemainingEvents: () => TrackEventData[]
  private readonly pauseScheduler: () => void
  private readonly destroyScheduler: () => void

  private onVisibilityChange: (() => void) | null = null
  private onPageHide: (() => void) | null = null

  constructor(config: LifecycleManagerConfig) {
    this.reportUrl = config.reportUrl
    this.getRemainingEvents = config.getRemainingEvents
    this.pauseScheduler = config.pauseScheduler
    this.destroyScheduler = config.destroyScheduler

    this.bindEvents()
  }

  /**
   * 解绑事件并销毁调度器。
   */
  destroy(): void {
    this.unbindEvents()
    this.destroyScheduler()
  }

  // ── 事件绑定 ──

  /**
   * 绑定 visibilitychange 和 pagehide 事件。
   * SSR 环境下跳过。
   */
  private bindEvents(): void {
    if (typeof document === 'undefined') return

    this.onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.handlePageHidden()
      }
    }

    this.onPageHide = () => this.handlePageHidden()

    document.addEventListener('visibilitychange', this.onVisibilityChange)
    window.addEventListener('pagehide', this.onPageHide)
  }

  /**
   * 解绑所有事件监听器。
   */
  private unbindEvents(): void {
    if (typeof document === 'undefined') return

    if (this.onVisibilityChange) {
      document.removeEventListener('visibilitychange', this.onVisibilityChange)
      this.onVisibilityChange = null
    }
    if (this.onPageHide) {
      window.removeEventListener('pagehide', this.onPageHide)
      this.onPageHide = null
    }
  }

  // ── 页面隐藏处理 ──

  /**
   * 页面隐藏时的处理逻辑：暂停调度器 → 取出剩余数据 → 通过 sendBeacon/keepalive 发送。
   */
  private handlePageHidden(): void {
    this.pauseScheduler()

    const events = this.getRemainingEvents()
    if (events.length === 0) return

    this.sendWithBeacon(events)
  }

  // ── 发送 ──

  /**
   * 使用 sendBeacon 发送事件数据，超长时分片。
   * 若 sendBeacon 不可用，降级为 fetch + keepalive。
   */
  private sendWithBeacon(events: TrackEventData[]): void {
    const json = JSON.stringify(events)

    if (json.length <= MAX_BEACON_PAYLOAD) {
      this.dispatch(json)
      return
    }

    // 超长分片发送
    const chunks = this.chunkEvents(events)
    for (const chunk of chunks) {
      this.dispatch(JSON.stringify(chunk))
    }
  }

  /**
   * 根据 sendBeacon 可用性选择发送方式。
   */
  private dispatch(json: string): void {
    if (this.isBeaconAvailable()) {
      navigator.sendBeacon(this.reportUrl, new Blob([json], { type: 'application/json' }))
    } else {
      this.sendKeepalive(json)
    }
  }

  /**
   * 将事件数组按 60KB 限制分片。
   * 每个分片尽量装填事件，直到加上下一条会超出 60KB 为止。
   */
  private chunkEvents(events: TrackEventData[]): TrackEventData[][] {
    const chunks: TrackEventData[][] = []
    let current: TrackEventData[] = []
    let currentSize = 0

    for (const event of events) {
      const eventSize = JSON.stringify(event).length

      if (currentSize + eventSize > MAX_BEACON_PAYLOAD && current.length > 0) {
        chunks.push(current)
        current = []
        currentSize = 0
      }

      current.push(event)
      currentSize += eventSize
    }

    if (current.length > 0) {
      chunks.push(current)
    }

    return chunks
  }

  /**
   * 降级方案：使用 fetch + keepalive 发送数据（fire-and-forget）。
   */
  private sendKeepalive(json: string): void {
    try {
      void fetch(this.reportUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
        keepalive: true,
      })
    } catch {
      // 页面即将关闭，静默失败
    }
  }

  // ── 工具 ──

  /**
   * 检查 sendBeacon 是否可用。
   */
  private isBeaconAvailable(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
  }
}
