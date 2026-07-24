/**
 * 并发控制类，限制同时进行的异步操作数量。
 *
 * 当活跃请求数达到 `maxConcurrent` 上限时，后续 `acquire()` 调用
 * 会排队等待，直到有槽位被 `release()` 释放。
 *
 * 排队遵循 FIFO 顺序，释放时优先唤醒等待最久的调用者。
 */
export class ConcurrencyLimiter {
  private readonly maxConcurrent: number
  private active = 0
  private waitQueue: Array<() => void> = []

  /**
   * @param maxConcurrent - 最大并发数，必须 >= 1
   * @throws 当 maxConcurrent < 1 时抛出 Error
   */
  constructor(maxConcurrent: number) {
    if (maxConcurrent < 1) {
      throw new Error('maxConcurrent must be at least 1')
    }
    this.maxConcurrent = maxConcurrent
  }

  /**
   * 获取一个执行槽位。
   * 若当前活跃数已满，则返回一个 pending 的 Promise，等待 release 唤醒。
   *
   * @returns 获取到槽位时 resolve 的 Promise
   */
  acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++
      return Promise.resolve()
    }

    return new Promise<void>(resolve => {
      this.waitQueue.push(() => {
        this.active++
        resolve()
      })
    })
  }

  /**
   * 释放一个执行槽位，并唤醒等待队列中的下一个（若存在）。
   */
  release(): void {
    if (this.active > 0) {
      this.active--
    }

    const next = this.waitQueue.shift()
    if (next) {
      next()
    }
  }

  /**
   * 返回当前活跃的请求数。
   */
  getActiveCount(): number {
    return this.active
  }

  /**
   * 返回当前排队等待的请求数。
   */
  getWaitingCount(): number {
    return this.waitQueue.length
  }

  /**
   * 销毁实例，清空等待队列并重置计数值。
   * 销毁后等待中的 Promise 不会 resolve，调用方应自行处理超时。
   */
  destroy(): void {
    this.waitQueue = []
    this.active = 0
  }
}
