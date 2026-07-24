import { describe, it, expect } from 'vitest'
import { ConcurrencyLimiter } from '../src/core/ConcurrencyLimiter'

describe('ConcurrencyLimiter', () => {
  // ── 构造函数 ──

  describe('constructor', () => {
    it('maxConcurrent 为 0 时抛出 Error', () => {
      expect(() => new ConcurrencyLimiter(0)).toThrow('maxConcurrent must be at least 1')
    })

    it('maxConcurrent 为负数时抛出 Error', () => {
      expect(() => new ConcurrencyLimiter(-1)).toThrow('maxConcurrent must be at least 1')
    })

    it('maxConcurrent = 1 正常创建，初始计数为 0', () => {
      const limiter = new ConcurrencyLimiter(1)
      expect(limiter.getActiveCount()).toBe(0)
      expect(limiter.getWaitingCount()).toBe(0)
    })
  })

  // ── acquire / release ──

  describe('acquire / release', () => {
    it('未满时 acquire 立即 resolve，active 递增', async () => {
      const limiter = new ConcurrencyLimiter(2)

      await limiter.acquire()
      expect(limiter.getActiveCount()).toBe(1)

      await limiter.acquire()
      expect(limiter.getActiveCount()).toBe(2)
    })

    it('达到最大并发时 acquire 排队，release 后唤醒', async () => {
      const limiter = new ConcurrencyLimiter(1)

      await limiter.acquire()
      expect(limiter.getActiveCount()).toBe(1)

      // 第二个 acquire 排队
      const promise = limiter.acquire()
      expect(limiter.getWaitingCount()).toBe(1)

      // release 唤醒排队的
      limiter.release()
      await promise
      expect(limiter.getActiveCount()).toBe(1)
    })

    it('排队任务按 FIFO 顺序唤醒', async () => {
      const limiter = new ConcurrencyLimiter(1)
      const order: number[] = []

      await limiter.acquire()

      const p1 = limiter.acquire().then(() => order.push(1))
      const p2 = limiter.acquire().then(() => order.push(2))
      const p3 = limiter.acquire().then(() => order.push(3))

      expect(limiter.getWaitingCount()).toBe(3)

      limiter.release()
      await p1
      expect(order).toEqual([1])

      limiter.release()
      await p2
      expect(order).toEqual([1, 2])

      limiter.release()
      await p3
      expect(order).toEqual([1, 2, 3])
    })

    it('连续 release 多次，active 不降为负数', () => {
      const limiter = new ConcurrencyLimiter(3)
      limiter.release()
      limiter.release()
      expect(limiter.getActiveCount()).toBe(0)
    })
  })

  // ── 混合顺序操作 ──

  describe('混合操作', () => {
    it('maxConcurrent=2 时前两个任务并发执行，第三个排队', async () => {
      const limiter = new ConcurrencyLimiter(2)
      const results: string[] = []

      async function task(name: string, delay: number): Promise<void> {
        await limiter.acquire()
        results.push(`start-${name}`)
        await new Promise(r => setTimeout(r, delay))
        results.push(`end-${name}`)
        limiter.release()
      }

      task('A', 10)
      task('B', 10)
      task('C', 10)

      await new Promise(r => setTimeout(r, 0))
      expect(results).toContain('start-A')
      expect(results).toContain('start-B')
      expect(results).not.toContain('start-C')

      await new Promise(r => setTimeout(r, 20))
      expect(results).toContain('end-A')
      expect(results).toContain('end-B')
      expect(results).toContain('start-C')

      await new Promise(r => setTimeout(r, 20))
      expect(results).toContain('end-C')
    })
  })

  // ── destroy ──

  describe('destroy', () => {
    it('销毁后清空等待队列，active 归零', () => {
      const limiter = new ConcurrencyLimiter(1)
      limiter.acquire() // 占住槽位
      limiter.acquire() // 排队
      limiter.acquire() // 排队

      expect(limiter.getActiveCount()).toBe(1)
      expect(limiter.getWaitingCount()).toBe(2)

      limiter.destroy()

      expect(limiter.getActiveCount()).toBe(0)
      expect(limiter.getWaitingCount()).toBe(0)
    })

    it('销毁后重新 acquire 正常', async () => {
      const limiter = new ConcurrencyLimiter(2)
      limiter.destroy()

      await limiter.acquire()
      expect(limiter.getActiveCount()).toBe(1)
    })
  })
})
