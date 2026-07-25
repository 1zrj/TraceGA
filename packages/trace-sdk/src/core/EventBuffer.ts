/**
 * 基于数组实现的泛型 FIFO 循环缓冲区，用于暂存待上报的埋点事件。
 * 当缓冲区满时，最早入队的事件会被自动移除。
 *
 * @template T - 缓冲区存储的元素类型
 */
export class EventBuffer<T> {
  private items: T[];
  private maxSize: number;

  /**
   * 创建一个指定最大容量的缓冲区。
   *
   * @param maxSize - 缓冲区最大容量，必须为正整数
   */
  constructor(maxSize: number) {
    if (maxSize <= 0) {
      throw new Error('maxSize must be greater than 0');
    }
    this.maxSize = maxSize;
    this.items = [];
  }

  /**
   * 向缓冲区添加一条数据。
   * 若当前数量已达到最大容量，会先移除最旧的一条数据，再添加新数据。
   *
   * @param item - 待添加的数据
   */
  push(item: T): void {
    if (this.items.length >= this.maxSize) {
      this.pop();
    }
    this.items.push(item);
  }

  /**
   * 移除并返回缓冲区中最旧的一条数据。
   *
   * @returns 最旧的数据，若缓冲区为空则返回 `undefined`
   */
  pop(): T | undefined {
    return this.items.shift();
  }

  /**
   * 返回当前缓冲区中的数据条数。
   *
   * @returns 缓冲区中元素的数量
   */
  size(): number {
    return this.items.length;
  }

  /**
   * 清空缓冲区中的所有数据。
   */
  clear(): void {
    this.items = [];
  }

  /**
   * 取出缓冲区中全部数据并以数组形式返回，同时清空缓冲区。
   * 适用于批量上报场景。
   *
   * @returns 包含缓冲区中所有数据的数组（按入队顺序排列）
   */
  takeAll(): T[] {
    const all = this.items;
    this.items = [];
    return all;
  }
}
