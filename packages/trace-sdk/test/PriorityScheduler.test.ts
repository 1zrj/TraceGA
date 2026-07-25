import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PriorityScheduler } from '../src/core/PriorityScheduler'
import { StoragePersister } from '../src/utils/StoragePersister'
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

/** 从 onFlush mock 调用中提取事件名数组 */
function eventNames(onFlush: ReturnType<typeof vi.fn>, callIndex = 0): string[] {
  return onFlush.mock.calls[callIndex][0].map((e: TrackEventData) => e.eventName)
}

/** 创建 requestIdleCallback mock 并返回可触发的回调引用 */
function mockIdleCallback(): { trigger: (idleId?: number) => void } {
  let cb: (() => void) | null = null
  vi.stubGlobal('requestIdleCallback', (fn: () => void) => {
    cb = fn
    return 1
  })
  vi.stubGlobal('cancelIdleCallback', vi.fn())
  return {
    trigger: () => cb?.(),
  }
}

describe('PriorityScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // ── 基本功能：按优先级存入队列 ──

  describe('按优先级存入队列', () => {
    it('add 将事件存入对应队列，flush 按 urgent→high→normal 顺序上报', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new PriorityScheduler({ maxBufferSize: 10, flushInterval: 5000, onFlush })

      scheduler.add('urgent', makeEvent('u1'))
      scheduler.add('high', makeEvent('h1'))
      scheduler.add('normal', makeEvent('n1'))

      scheduler.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(onFlush).toHaveBeenCalledTimes(1)
      expect(eventNames(onFlush)).toEqual(['u1', 'h1', 'n1'])
    })

    it('混合优先级事件按 urgent→high→normal 排序', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new PriorityScheduler({ maxBufferSize: 10, flushInterval: 5000, onFlush })

      scheduler.add('normal', makeEvent('n1'))
      scheduler.add('normal', makeEvent('n2'))
      scheduler.add('high', makeEvent('h1'))
      scheduler.add('urgent', makeEvent('u1'))
      scheduler.add('high', makeEvent('h2'))
      scheduler.add('urgent', makeEvent('u2'))

      scheduler.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(eventNames(onFlush)).toEqual(['u1', 'u2', 'h1', 'h2', 'n1', 'n2'])
    })
  })

  // ── 阈值触发 ──

  describe('阈值触发', () => {
    it('urgent 队列达到 urgentMaxSize 时触发全量上报', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new PriorityScheduler({ maxBufferSize: 10, urgentMaxSize: 2, flushInterval: 10000, onFlush })

      scheduler.add('urgent', makeEvent('u1'))
      scheduler.add('normal', makeEvent('n1'))
      expect(onFlush).not.toHaveBeenCalled()

      scheduler.add('urgent', makeEvent('u2'))
      await vi.advanceTimersByTimeAsync(0)

      expect(onFlush).toHaveBeenCalledTimes(1)
      expect(eventNames(onFlush)).toEqual(['u1', 'u2', 'n1'])
    })

    it('normal 队列达到 maxBufferSize 时触发全量上报', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new PriorityScheduler({ maxBufferSize: 3, flushInterval: 10000, onFlush })

      scheduler.add('normal', makeEvent('n1'))
      scheduler.add('normal', makeEvent('n2'))
      expect(onFlush).not.toHaveBeenCalled()

      scheduler.add('normal', makeEvent('n3'))
      await vi.advanceTimersByTimeAsync(0)

      expect(onFlush).toHaveBeenCalledTimes(1)
    })
  })

  // ── 空闲调度 ──

  describe('空闲调度', () => {
    it('空闲回调仅上报 normal 队列，保留 urgent 和 high', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const idle = mockIdleCallback()

      const scheduler = new PriorityScheduler({ maxBufferSize: 10, flushInterval: 5000, onFlush })

      scheduler.add('urgent', makeEvent('u1'))
      scheduler.add('high', makeEvent('h1'))
      scheduler.add('normal', makeEvent('n1'))
      scheduler.add('normal', makeEvent('n2'))

      idle.trigger()
      await vi.advanceTimersByTimeAsync(0)

      expect(onFlush).toHaveBeenCalledTimes(1)
      expect(eventNames(onFlush)).toEqual(['n1', 'n2'])

      // 验证 urgent 和 high 还留在队列
      onFlush.mockClear()
      scheduler.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(onFlush).toHaveBeenCalledTimes(1)
      expect(eventNames(onFlush)).toEqual(['u1', 'h1'])
    })

    it('requestIdleCallback 不可用时降级为 setTimeout', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('requestIdleCallback', undefined)

      const scheduler = new PriorityScheduler({ maxBufferSize: 10, flushInterval: 5000, onFlush, idleTimeoutFallback: 2000 })

      scheduler.add('normal', makeEvent('n1'))
      scheduler.add('normal', makeEvent('n2'))

      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(0)

      expect(onFlush).toHaveBeenCalledTimes(1)
      expect(eventNames(onFlush)).toEqual(['n1', 'n2'])
    })

    it('normal 队列为空时空闲回调不触发 onFlush', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const idle = mockIdleCallback()

      const scheduler = new PriorityScheduler({ maxBufferSize: 10, flushInterval: 5000, onFlush })

      scheduler.add('normal', makeEvent('n1'))

      idle.trigger()
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).toHaveBeenCalledTimes(1)

      // 第二次空闲回调，normal 已空
      onFlush.mockClear()
      idle.trigger()
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).not.toHaveBeenCalled()
    })
  })

  // ── 定时触发 ──

  describe('定时触发', () => {
    it('到达间隔时间后全量上报所有队列', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new PriorityScheduler({ maxBufferSize: 10, flushInterval: 3000, onFlush })

      scheduler.add('urgent', makeEvent('u1'))
      scheduler.add('normal', makeEvent('n1'))

      await vi.advanceTimersByTimeAsync(3000)
      await vi.advanceTimersByTimeAsync(0)

      expect(onFlush).toHaveBeenCalledTimes(1)
      expect(eventNames(onFlush)).toEqual(['u1', 'n1'])
    })
  })

  // ── pause ──

  describe('pause', () => {
    it('暂停后定时器不再触发，flush 仍可手动触发', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      // 阻止 idle 回调干扰
      vi.stubGlobal('requestIdleCallback', () => 1)
      vi.stubGlobal('cancelIdleCallback', vi.fn())

      const scheduler = new PriorityScheduler({ maxBufferSize: 10, flushInterval: 3000, onFlush })

      scheduler.add('urgent', makeEvent('u1'))
      scheduler.pause()

      await vi.advanceTimersByTimeAsync(10000)
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).not.toHaveBeenCalled()

      // 手动 flush 仍有效
      scheduler.flush()
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).toHaveBeenCalledTimes(1)
    })
  })

  // ── takeAll ──

  describe('takeAll', () => {
    it('返回所有队列数据且清空缓冲区，不触发 onFlush', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new PriorityScheduler({ maxBufferSize: 10, flushInterval: 5000, onFlush })

      scheduler.add('urgent', makeEvent('u1'))
      scheduler.add('high', makeEvent('h1'))
      scheduler.add('normal', makeEvent('n1'))

      const all = scheduler.takeAll()

      expect(all.map(e => e.eventName)).toEqual(['u1', 'h1', 'n1'])
      expect(onFlush).not.toHaveBeenCalled()

      // 队列已清空
      scheduler.flush()
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).not.toHaveBeenCalled()
    })
  })

  // ── destroy ──

  describe('destroy', () => {
    it('销毁后定时器和空闲回调均停止', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('cancelIdleCallback', vi.fn())

      const scheduler = new PriorityScheduler({ maxBufferSize: 10, flushInterval: 3000, onFlush })

      scheduler.add('urgent', makeEvent('u1'))
      scheduler.add('normal', makeEvent('n1'))
      scheduler.destroy()

      await vi.advanceTimersByTimeAsync(10000)
      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).not.toHaveBeenCalled()
    })

    it('销毁后 add 不触发阈值上报', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('cancelIdleCallback', vi.fn())

      const scheduler = new PriorityScheduler({ maxBufferSize: 2, flushInterval: 5000, onFlush })

      scheduler.add('normal', makeEvent('n1'))
      scheduler.destroy()
      scheduler.add('normal', makeEvent('n2'))

      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).not.toHaveBeenCalled()
    })
  })

  // ── persister 缓存恢复 ──

  describe('persister 缓存恢复', () => {
    it('初始化时恢复单条缓存并以 urgent 优先级上报', async () => {
      const persister = new StoragePersister()
      persister.save('trace_failed_cache', makeEvent('cached'))

      const onFlush = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('requestIdleCallback', () => 1)
      vi.stubGlobal('cancelIdleCallback', vi.fn())

      new PriorityScheduler({ maxBufferSize: 10, flushInterval: 5000, onFlush, persister })

      await vi.advanceTimersByTimeAsync(0)

      expect(onFlush).toHaveBeenCalledTimes(1)
      expect(eventNames(onFlush)).toContain('cached')
      expect(persister.load('trace_failed_cache')).toBeNull()
    })

    it('初始化时恢复多条缓存并以 urgent 优先级上报', async () => {
      const persister = new StoragePersister()
      persister.save('trace_failed_cache', [makeEvent('f1'), makeEvent('f2')])

      const onFlush = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('requestIdleCallback', () => 1)
      vi.stubGlobal('cancelIdleCallback', vi.fn())

      new PriorityScheduler({ maxBufferSize: 10, flushInterval: 5000, onFlush, persister })

      await vi.advanceTimersByTimeAsync(0)

      expect(onFlush).toHaveBeenCalledTimes(1)
      expect(eventNames(onFlush)).toEqual(['f1', 'f2'])
      expect(persister.load('trace_failed_cache')).toBeNull()
    })
  })

  // ── 并发安全 ──

  describe('并发安全', () => {
    it('flushing 锁防止并发全量上报', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined)
      const scheduler = new PriorityScheduler({ maxBufferSize: 2, flushInterval: 5000, onFlush })

      scheduler.add('normal', makeEvent('n1'))
      scheduler.add('normal', makeEvent('n2')) // 阈值触发
      scheduler.flush() // 手动 flush 竞争

      await vi.advanceTimersByTimeAsync(0)
      expect(onFlush).toHaveBeenCalledTimes(1)
    })
  })
})
