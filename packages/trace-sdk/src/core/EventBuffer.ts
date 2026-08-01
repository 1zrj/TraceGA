/**
 * 固定容量的环形缓冲区，用于暂存埋点事件。
 *
 * 使用 head 索引实现 O(1) 溢出移除，避免 shift() 的 O(n) 开销。
 *
 * @template T - 缓冲区存储的元素类型
 */
export class EventBuffer<T> {
  private items: T[] = [];
  private readonly maxSize: number;
  private head = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  /**
   * 向缓冲区添加一条数据。
   * 若当前数量已达到最大容量，会先移除最旧的一条数据（O(1)），再添加新数据。
   *
   * @param item - 待添加的数据
   */
  push(item: T): void {
    if (this.size() >= this.maxSize) {
      this.head++;
    }
    this.items.push(item);
  }

  /**
   * 移除并返回缓冲区中最旧的一条数据（O(1)）。
   *
   * @returns 最旧的数据，若缓冲区为空则返回 `undefined`
   */
  pop(): T | undefined {
    if (this.head >= this.items.length) return undefined;
    return this.items[this.head++];
  }

  /**
   * 当前缓冲区中的事件数。
   */
  size(): number {
    return this.items.length - this.head;
  }

  /**
   * 清空缓冲区。
   */
  clear(): void {
    this.items = [];
    this.head = 0;
  }

  /**
   * 取出缓冲区中全部数据并以数组形式返回，同时清空缓冲区。
   * 适用于批量上报场景。
   *
   * @returns 包含缓冲区中所有数据的数组（按入队顺序排列）
   */
  takeAll(): T[] {
    const all = this.items.slice(this.head);
    this.items = [];
    this.head = 0;
    return all;
  }
}
