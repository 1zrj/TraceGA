import { EventBuffer } from './EventBuffer';
import type { TrackEventData } from '../types';

export interface BatchSchedulerConfig {
  /** 缓冲区最大容量，达到后立即触发上报 */
  maxBufferSize: number;
  /** 定时上报间隔（毫秒） */
  flushInterval: number;
  /** 上报回调，接收待上报的事件数组 */
  onFlush: (events: TrackEventData[]) => Promise<void>;
}

/**
 * 批量调度器，连接事件缓冲区与上报逻辑。
 *
 * 双触发机制：
 * - **定时触发**：每隔 `flushInterval` 毫秒自动上报
 * - **阈值触发**：缓冲区满时立即上报，并重置定时器防止连续触发
 */
export class BatchScheduler {
  private buffer: EventBuffer<TrackEventData>;
  private maxBufferSize: number;
  private flushInterval: number;
  private onFlush: (events: TrackEventData[]) => Promise<void>;
  private timerId: ReturnType<typeof setTimeout> | null;
  private flushing: boolean;

  constructor(config: BatchSchedulerConfig) {
    this.maxBufferSize = config.maxBufferSize;
    this.buffer = new EventBuffer<TrackEventData>(config.maxBufferSize);
    this.flushInterval = config.flushInterval;
    this.onFlush = config.onFlush;
    this.timerId = null;
    this.flushing = false;

    this.scheduleNext();
  }

  /**
   * 向缓冲区添加一条事件。
   * 若当前缓冲区数量达到 `maxBufferSize`，立即触发上报并重置定时器。
   *
   * @param event - 待添加的埋点事件
   */
  add(event: TrackEventData): void {
    this.buffer.push(event);

    if (this.buffer.size() >= this.maxBufferSize) {
      this.clearTimer();
      this.doFlushAndSchedule();
    }
  }

  /**
   * 手动立即触发上报，取出缓冲区中全部数据并传递给 `onFlush`。
   * 执行后重置定时器。
   */
  flush(): void {
    this.clearTimer();
    this.doFlushAndSchedule();
  }

  /**
   * 销毁调度器，清除定时器并清空缓冲区。
   */
  destroy(): void {
    this.clearTimer();
    this.buffer.clear();
  }

  /**
   * 安排下一次定时上报。
   */
  private scheduleNext(): void {
    this.timerId = setTimeout(() => {
      this.doScheduledFlush();
    }, this.flushInterval);
  }

  /**
   * 定时触发的上报：执行上报后安排下一次。
   */
  private async doScheduledFlush(): Promise<void> {
    await this.doFlush();
    this.scheduleNext();
  }

  /**
   * 阈值/手动触发后，执行上报并重新安排定时器。
   */
  private async doFlushAndSchedule(): Promise<void> {
    await this.doFlush();
    this.scheduleNext();
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
   * 执行上报：取出缓冲区全部数据，若非空则调用 `onFlush`。
   * 使用 `flushing` 锁防止并发上报。
   */
  private async doFlush(): Promise<void> {
    if (this.flushing) return;

    const events = this.buffer.takeAll();
    if (events.length === 0) return;

    this.flushing = true;
    try {
      await this.onFlush(events);
    } finally {
      this.flushing = false;
    }
  }
}