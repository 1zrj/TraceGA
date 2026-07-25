import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BatchScheduler } from '../src/core/BatchScheduler'
import type { TrackEventData } from '../src/types'

/** 创建一条测试事件 */
function makeEvent(name: string): TrackEventData {
  return {
    eventType: 'custom',
    eventName: name,
    appId: 'test',
    timestamp: Date.now(),
    properties: {},
    url: 'http://localhost',
    referrer: '',
  }
}

describe('BatchScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── 定时触发 ──

  describe('定时触发', () => {
    it('到达间隔时间后触发上报，携带缓冲区全部事件', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new BatchScheduler({ maxBufferSize: 10, flushInterval: 5000, onFlush })

      scheduler.add(makeEvent('e1'))
      scheduler.add(makeEvent('e2'))

      await vi.advanceTimersByTimeAsync(4000)
      expect(onFlush).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).toHaveBeenCalledTimes(1)
      expect(onFlush).toHaveBeenCalledWith([expect.objectContaining({ eventName: 'e1' }), expect.objectContaining({ eventName: 'e2' })])
    })

    it('多个间隔周期各自触发上报', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new BatchScheduler({ maxBufferSize: 10, flushInterval: 3000, onFlush })

      scheduler.add(makeEvent('e1'))
      await vi.advanceTimersByTimeAsync(3000)
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).toHaveBeenCalledTimes(1)

      scheduler.add(makeEvent('e2'))
      await vi.advanceTimersByTimeAsync(3000)
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).toHaveBeenCalledTimes(2)
      expect(onFlush.mock.calls[1][0]).toEqual([expect.objectContaining({ eventName: 'e2' })])
    })

    it('缓冲区为空时定时触发不调用 onFlush', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new BatchScheduler({ maxBufferSize: 10, flushInterval: 3000, onFlush })

      await vi.advanceTimersByTimeAsync(3000)
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).not.toHaveBeenCalled()

      // 下一个周期仍正常触发
      scheduler.add(makeEvent('e1'))
      await vi.advanceTimersByTimeAsync(3000)
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).toHaveBeenCalledTimes(1)
    })
  })

  // ── 阈值触发 ──

  describe('阈值触发', () => {
    it('缓冲区满时立即触发上报', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new BatchScheduler({ maxBufferSize: 3, flushInterval: 10000, onFlush })

      scheduler.add(makeEvent('e1'))
      scheduler.add(makeEvent('e2'))
      expect(onFlush).not.toHaveBeenCalled()

      scheduler.add(makeEvent('e3'))
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).toHaveBeenCalledTimes(1)
      expect(onFlush).toHaveBeenCalledWith([
        expect.objectContaining({ eventName: 'e1' }),
        expect.objectContaining({ eventName: 'e2' }),
        expect.objectContaining({ eventName: 'e3' }),
      ])
    })

    it('阈值触发后定时器重置，空缓冲区不再触发', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new BatchScheduler({ maxBufferSize: 3, flushInterval: 5000, onFlush })

      scheduler.add(makeEvent('e1'))
      scheduler.add(makeEvent('e2'))
      scheduler.add(makeEvent('e3'))
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).toHaveBeenCalledTimes(1)

      onFlush.mockClear()
      await vi.advanceTimersByTimeAsync(5000)
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).not.toHaveBeenCalled()
    })
  })

  // ── 手动 flush ──

  describe('手动 flush', () => {
    it('手动调用 flush 立即上报并重置定时器', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new BatchScheduler({ maxBufferSize: 10, flushInterval: 5000, onFlush })

      scheduler.add(makeEvent('e1'))
      scheduler.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(onFlush).toHaveBeenCalledTimes(1)
      expect(onFlush).toHaveBeenCalledWith([expect.objectContaining({ eventName: 'e1' })])

      onFlush.mockClear()
      await vi.advanceTimersByTimeAsync(4000)
      expect(onFlush).not.toHaveBeenCalled()
    })

    it('空缓冲区 flush 不调用 onFlush', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new BatchScheduler({ maxBufferSize: 10, flushInterval: 5000, onFlush })

      scheduler.flush()
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).not.toHaveBeenCalled()
    })
  })

  // ── destroy ──

  describe('destroy', () => {
    it('销毁后定时器不再触发上报', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new BatchScheduler({ maxBufferSize: 10, flushInterval: 3000, onFlush })

      scheduler.add(makeEvent('e1'))
      scheduler.destroy()

      await vi.advanceTimersByTimeAsync(10000)
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).not.toHaveBeenCalled()
    })

    it('销毁后 add 不触发阈值上报', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new BatchScheduler({ maxBufferSize: 2, flushInterval: 5000, onFlush })

      scheduler.add(makeEvent('e1'))
      scheduler.destroy()
      scheduler.add(makeEvent('e2'))

      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).not.toHaveBeenCalled()
    })
  })

  // ── 并发安全 ──

  describe('并发安全', () => {
    it('flushing 锁防止并发上报', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new BatchScheduler({ maxBufferSize: 2, flushInterval: 5000, onFlush })

      scheduler.add(makeEvent('e1'))
      scheduler.add(makeEvent('e2')) // 阈值触发
      scheduler.flush() // 手动 flush 与阈值 flush 竞争

      await vi.advanceTimersByTimeAsync(0)
      // 阈值触发吃掉了事件，手动 flush 取到空数组
      expect(onFlush).toHaveBeenCalledTimes(1)
    })
  })
})
