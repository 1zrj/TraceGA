/**
 * 基于数组实现的泛型 FIFO 循环缓冲区。
 *
 * 用于暂存待上报的埋点事件，当缓冲区满时自动移除最早入队的数据。
 * 内部使用头指针实现 O(1) 出队，避免 `Array.shift()` 的 O(n) 开销。
 *
 * @template T - 缓冲区存储的元素类型
 */
export class EventBuffer<T> {
  private items: T[] = []
  private head = 0
  private readonly maxSize: number

  /**
   * 创建一个指定最大容量的缓冲区。
   *
   * @param maxSize - 缓冲区最大容量，必须为正整数
   * @throws 当 maxSize <= 0 时抛出 Error
   */
  constructor(maxSize: number) {
    if (maxSize <= 0) {
      throw new Error('maxSize must be greater than 0')
    }
    this.maxSize = maxSize
  }

  /**
   * 向缓冲区添加一条数据。
   * 若当前数量已达到最大容量，会先移除最旧的一条数据，再添加新数据。
   *
   * @param item - 待添加的数据
   */
  push(item: T): void {
    if (this.size() >= this.maxSize) {
      this.head++
    }
    this.items.push(item)
  }

  /**
   * 移除并返回缓冲区中最旧的一条数据（O(1)）。
   *
   * @returns 最旧的数据，若缓冲区为空则返回 `undefined`
   */
  pop(): T | undefined {
    if (this.head >= this.items.length) {
      return undefined
    }
    return this.items[this.head++]
  }

  /**
   * 返回当前缓冲区中的数据条数。
   *
   * @returns 缓冲区中元素的数量
   */
  size(): number {
    return this.items.length - this.head
  }

  /**
   * 清空缓冲区中的所有数据。
   */
  clear(): void {
    this.items = []
    this.head = 0
  }

  /**
   * 取出缓冲区中全部数据并以副本形式返回，同时清空缓冲区。
   *
   * 返回的是新数组，外部修改不会影响内部状态。
   * 适用于批量上报场景。
   *
   * @returns 包含缓冲区中所有数据的数组（按入队顺序排列）
   */
  takeAll(): T[] {
    const all = this.items.slice(this.head)
    this.items = []
    this.head = 0
    return all
  }
}
