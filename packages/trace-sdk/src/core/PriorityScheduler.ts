import { EventBuffer } from './EventBuffer';
import type { TrackEventData } from '../types';
import type { StoragePersister } from '../utils/StoragePersister';
import type { ConcurrencyLimiter } from './ConcurrencyLimiter';

export type Priority = 'urgent' | 'high' | 'normal';

export interface PrioritySchedulerConfig {
  /** 普通 & 高优先级队列的最大容量（默认值） */
  maxBufferSize: number;
  /** 紧急队列的独立最大容量，默认与 maxBufferSize 一致 */
  urgentMaxSize?: number;
  /** 定时上报间隔（毫秒） */
  flushInterval: number;
  /** 上报回调，接收按优先级排序的事件数组 */
  onFlush: (events: TrackEventData[]) => Promise<void>;
  /** requestIdleCallback 降级超时（毫秒），默认 3000 */
  idleTimeoutFallback?: number;
  /** 持久化工具，用于初始化时补发 localStorage 中残留的失败缓存 */
  persister?: StoragePersister;
  /** 并发限制器，用于控制同时进行的上报请求数 */
  limiter?: ConcurrencyLimiter;
}

/**
 * 优先级调度器，基于三队列实现优先级上报与空闲调度。
 *
 * 三队列优先级：urgent > high > normal
 *
 * 上报顺序：
 * - 每次 `onFlush` 时，按 urgent → high → normal 顺序拼接全部数据
 *
 * 触发机制：
 * - **定时触发**：每隔 `flushInterval` 毫秒执行全量上报
 * - **阈值触发**：任一队列满时立即全量上报，并重置定时器
 * - **空闲调度**：使用 `requestIdleCallback`（降级为 `setTimeout`）
 *   在浏览器空闲时仅上报 normal 队列，不触发 urgent/high
 */
export class PriorityScheduler {
  private urgentBuffer: EventBuffer<TrackEventData>;
  private highBuffer: EventBuffer<TrackEventData>;
  private normalBuffer: EventBuffer<TrackEventData>;
  private maxBufferSize: number;
  private urgentMaxSize: number;
  private flushInterval: number;
  private onFlush: (events: TrackEventData[]) => Promise<void>;
  private idleTimeoutFallback: number;
  private timerId: ReturnType<typeof setTimeout> | null;
  private idleId: number | null;
  private flushing: boolean;
  private persister: StoragePersister | undefined;
  private limiter: ConcurrencyLimiter | undefined;

  constructor(config: PrioritySchedulerConfig) {
    this.maxBufferSize = config.maxBufferSize;
    this.urgentMaxSize = config.urgentMaxSize ?? config.maxBufferSize;
    this.flushInterval = config.flushInterval;
    this.onFlush = config.onFlush;
    this.idleTimeoutFallback = config.idleTimeoutFallback ?? 3000;
    this.timerId = null;
    this.idleId = null;
    this.flushing = false;
    this.persister = config.persister;
    this.limiter = config.limiter;

    this.urgentBuffer = new EventBuffer<TrackEventData>(this.urgentMaxSize);
    this.highBuffer = new EventBuffer<TrackEventData>(this.maxBufferSize);
    this.normalBuffer = new EventBuffer<TrackEventData>(this.maxBufferSize);

    this.scheduleNext();
    this.scheduleIdle();
    this.recoverFailedCache();
  }

  /**
   * 按优先级向对应队列添加一条事件。
   * 若该队列达到容量上限，立即触发全量上报并重置定时器。
   *
   * @param priority - 优先级：`'urgent'` | `'high'` | `'normal'`
   * @param event - 待添加的埋点事件
   */
  add(priority: Priority, event: TrackEventData): void {
    const buffer = this.getBuffer(priority);
    buffer.push(event);

    if (this.shouldThresholdFlush(priority)) {
      this.clearTimer();
      this.doFlushAndSchedule();
    }
  }

  /**
   * 手动立即触发全量上报，取出所有队列数据合并后传递给 `onFlush`。
   * 执行后重置定时器。
   */
  flush(): void {
    this.clearTimer();
    this.doFlushAndSchedule();
  }

  /**
   * 暂停调度器定时器（不清空缓冲区），供页面隐藏时使用。
   */
  pause(): void {
    this.clearTimer();
  }

  /**
   * 取出所有队列中的全部数据（不触发上报），用于页面隐藏时通过 sendBeacon 发送。
   *
   * @returns 按 urgent → high → normal 顺序拼接的事件数组
   */
  takeAll(): TrackEventData[] {
    return [...this.urgentBuffer.takeAll(), ...this.highBuffer.takeAll(), ...this.normalBuffer.takeAll()];
  }

  /**
   * 销毁调度器，清除定时器、空闲回调并清空所有缓冲区。
   */
  destroy(): void {
    this.clearTimer();
    this.cancelIdle();
    this.urgentBuffer.clear();
    this.highBuffer.clear();
    this.normalBuffer.clear();
  }

  // ─── 定时器 ────────────────────────────────────────

  /**
   * 安排下一次定时全量上报。
   */
  private scheduleNext(): void {
    this.timerId = setTimeout(() => {
      this.doScheduledFlush();
    }, this.flushInterval);
  }

  /**
   * 清除当前定时器。
   */
  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * 初始化时检查 localStorage 残留缓存，若存在则立即以 urgent 优先级补发。
   * 补发后清除缓存，防止重复上报。
   */
  private recoverFailedCache(): void {
    if (!this.persister) return;

    const cached = this.persister.load('trace_failed_cache');
    if (!cached) return;

    // 支持单个事件或事件数组
    const events: TrackEventData[] = Array.isArray(cached) ? cached : [cached];
    for (const event of events) {
      this.urgentBuffer.push(event);
    }

    // 清除已读取的缓存
    this.persister.clear('trace_failed_cache');

    // 若有缓存数据，立即触发一次全量上报
    if (this.urgentBuffer.size() > 0) {
      this.clearTimer();
      this.doFlushAndSchedule();
    }
  }

  /**
   * 定时触发的全量上报，完成后安排下一次。
   * 上报失败静默处理（已在 transporter 中完成重试/缓存）。
   */
  private async doScheduledFlush(): Promise<void> {
    try {
      await this.doFlush();
    } catch {
      // 上报失败已在 transporter 中处理
    }
    this.scheduleNext();
  }

  /**
   * 阈值/手动触发后的全量上报，完成后重新安排定时器。
   * 上报失败静默处理（已在 transporter 中完成重试/缓存）。
   */
  private async doFlushAndSchedule(): Promise<void> {
    try {
      await this.doFlush();
    } catch {
      // 上报失败已在 transporter 中处理
    }
    this.scheduleNext();
  }

  // ─── 空闲调度 ──────────────────────────────────────

  /**
   * 注册空闲回调：使用 `requestIdleCallback`，降级为 `setTimeout`。
   */
  private scheduleIdle(): void {
    if (typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function') {
      this.idleId = (window as any).requestIdleCallback((deadline: IdleDeadline) => this.onIdle(deadline), { timeout: this.idleTimeoutFallback });
    } else {
      this.idleId = setTimeout(() => {
        this.onIdleFallback();
      }, this.idleTimeoutFallback) as unknown as number;
    }
  }

  /**
   * 取消当前空闲回调。
   */
  private cancelIdle(): void {
    if (this.idleId !== null) {
      if (typeof window !== 'undefined' && typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(this.idleId);
      } else {
        clearTimeout(this.idleId);
      }
      this.idleId = null;
    }
  }

  /**
   * 空闲回调：仅取出 normal 队列数据上报，upper 级别不受影响。
   */
  private async onIdle(_deadline: IdleDeadline): Promise<void> {
    void _deadline;
    await this.flushNormalOnly();
    this.scheduleIdle();
  }

  /**
   * 降级方案的空闲回调（setTimeout 模式）。
   */
  private async onIdleFallback(): Promise<void> {
    await this.flushNormalOnly();
    this.scheduleIdle();
  }

  /**
   * 仅上报 normal 队列数据，不触及 urgent/high。
   */
  private async flushNormalOnly(): Promise<void> {
    if (this.flushing) return;

    const events = this.normalBuffer.takeAll();
    if (events.length === 0) return;

    this.flushing = true;
    try {
      await this.limiter?.acquire();
      try {
        await this.onFlush(events);
      } finally {
        this.limiter?.release();
      }
    } finally {
      this.flushing = false;
    }
  }

  // ─── 全量上报 ──────────────────────────────────────

  /**
   * 执行全量上报：按 urgent → high → normal 顺序拼接所有队列数据。
   * 使用 `flushing` 锁防止并发。
   */
  private async doFlush(): Promise<void> {
    if (this.flushing) return;

    const events = [...this.urgentBuffer.takeAll(), ...this.highBuffer.takeAll(), ...this.normalBuffer.takeAll()];

    if (events.length === 0) return;

    this.flushing = true;
    try {
      await this.limiter?.acquire();
      try {
        await this.onFlush(events);
      } finally {
        this.limiter?.release();
      }
    } finally {
      this.flushing = false;
    }
  }

  // ─── 辅助 ──────────────────────────────────────────

  /**
   * 根据优先级返回对应的缓冲区。
   */
  private getBuffer(priority: Priority): EventBuffer<TrackEventData> {
    switch (priority) {
      case 'urgent':
        return this.urgentBuffer;
      case 'high':
        return this.highBuffer;
      case 'normal':
        return this.normalBuffer;
    }
  }

  /**
   * 判断对应优先级队列是否已达到阈值，应触发全量上报。
   */
  private shouldThresholdFlush(priority: Priority): boolean {
    switch (priority) {
      case 'urgent':
        return this.urgentBuffer.size() >= this.urgentMaxSize;
      case 'high':
        return this.highBuffer.size() >= this.maxBufferSize;
      case 'normal':
        return this.normalBuffer.size() >= this.maxBufferSize;
    }
  }
}
