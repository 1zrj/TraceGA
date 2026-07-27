/**
 * 固定容量的环形缓冲区，用于暂存埋点事件。
 *
 * 当事件数量达到容量上限时，最旧的事件会被丢弃（FIFO）。
 */
export class EventBuffer<T> {
  private items: T[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  /**
   * 向缓冲区添加一条事件。若已满则丢弃最早的事件。
   */
  push(event: T): void {
    if (this.items.length >= this.maxSize) {
      this.items.shift();
    }
    this.items.push(event);
  }

  /**
   * 取出全部事件并清空缓冲区。
   */
  takeAll(): T[] {
    const result = this.items;
    this.items = [];
    return result;
  }

  /**
   * 当前缓冲区中的事件数。
   */
  size(): number {
    return this.items.length;
  }

  /**
   * 清空缓冲区。
   */
  clear(): void {
    this.items = [];
  }
}
