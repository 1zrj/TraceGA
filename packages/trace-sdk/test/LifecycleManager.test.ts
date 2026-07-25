import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LifecycleManager } from '../src/core/LifecycleManager'
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

/** 创建一条大体积事件，用于触发分片 */
function makeLargeEvent(name: string, extraSize: number): TrackEventData {
  return {
    eventType: 'custom',
    eventName: name,
    appId: 'test',
    timestamp: Date.now(),
    properties: { data: 'x'.repeat(extraSize) },
    url: 'http://localhost',
    referrer: '',
  }
}

describe('LifecycleManager', () => {
  let getRemainingEvents: ReturnType<typeof vi.fn>
  let pauseScheduler: ReturnType<typeof vi.fn>
  let destroyScheduler: ReturnType<typeof vi.fn>
  let sendBeaconSpy: ReturnType<typeof vi.fn>
  let instances: LifecycleManager[]

  beforeEach(() => {
    getRemainingEvents = vi.fn().mockReturnValue([])
    pauseScheduler = vi.fn()
    destroyScheduler = vi.fn()
    sendBeaconSpy = vi.fn().mockReturnValue(true)
    instances = []
    vi.stubGlobal('navigator', { sendBeacon: sendBeaconSpy })
  })

  afterEach(() => {
    for (const inst of instances) {
      inst.destroy()
    }
    vi.unstubAllGlobals()
  })

  /** 创建 LifecycleManager 实例 */
  function createManager(overrides?: { events?: TrackEventData[] }): LifecycleManager {
    if (overrides?.events) {
      getRemainingEvents.mockReturnValue(overrides.events)
    }
    const mgr = new LifecycleManager({
      reportUrl: 'https://api.example.com/report',
      getRemainingEvents,
      pauseScheduler,
      destroyScheduler,
    })
    instances.push(mgr)
    return mgr
  }

  /** 触发页面隐藏事件 */
  function triggerHidden(): void {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  // ── 页面隐藏 ──

  describe('页面隐藏', () => {
    it('visibilityState 变为 hidden 时暂停调度器并发送剩余数据', () => {
      createManager({ events: [makeEvent('e1'), makeEvent('e2')] })
      triggerHidden()

      expect(pauseScheduler).toHaveBeenCalled()
      expect(sendBeaconSpy).toHaveBeenCalledTimes(1)

      const [url, blob] = sendBeaconSpy.mock.calls[0]
      expect(url).toBe('https://api.example.com/report')
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/json')
    })

    it('pagehide 事件触发发送', () => {
      createManager({ events: [makeEvent('e1')] })
      window.dispatchEvent(new Event('pagehide'))

      expect(pauseScheduler).toHaveBeenCalled()
      expect(sendBeaconSpy).toHaveBeenCalledTimes(1)
    })

    it('缓冲区为空时不调用 sendBeacon', () => {
      createManager()
      triggerHidden()

      expect(pauseScheduler).toHaveBeenCalled()
      expect(sendBeaconSpy).not.toHaveBeenCalled()
    })
  })

  // ── sendBeacon 降级 ──

  describe('sendBeacon 降级', () => {
    it('sendBeacon 不可用时降级为 fetch + keepalive', () => {
      vi.stubGlobal('navigator', {})
      const fetchSpy = vi.fn().mockResolvedValue(new Response())
      vi.stubGlobal('fetch', fetchSpy)

      createManager({ events: [makeEvent('e1')] })
      triggerHidden()

      expect(fetchSpy).toHaveBeenCalled()
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://api.example.com/report')
      expect(init.keepalive).toBe(true)
      expect(init.method).toBe('POST')
    })
  })

  // ── 分片 ──

  describe('分片', () => {
    it('超 60KB 时分片发送', () => {
      const events: TrackEventData[] = []
      for (let i = 0; i < 100; i++) {
        events.push(makeLargeEvent(`event_${i}`, 1000))
      }
      createManager({ events })
      triggerHidden()

      expect(sendBeaconSpy.mock.calls.length).toBeGreaterThan(1)
    })

    it('单条事件不超 60KB 时不触发分片', () => {
      createManager({ events: [makeEvent('small')] })
      triggerHidden()

      expect(sendBeaconSpy).toHaveBeenCalledTimes(1)
    })
  })

  // ── destroy ──

  describe('destroy', () => {
    it('解绑事件并销毁调度器', () => {
      const removeDocSpy = vi.spyOn(document, 'removeEventListener')
      const removeWinSpy = vi.spyOn(window, 'removeEventListener')

      const mgr = createManager()
      mgr.destroy()

      expect(destroyScheduler).toHaveBeenCalled()
      expect(removeDocSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
      expect(removeWinSpy).toHaveBeenCalledWith('pagehide', expect.any(Function))
    })

    it('销毁后页面隐藏不再触发处理', () => {
      createManager({ events: [makeEvent('e1')] })
      instances[0].destroy()

      triggerHidden()
      window.dispatchEvent(new Event('pagehide'))

      // pauseScheduler 在构造时未被调用，destroy 后也不再调用
      expect(pauseScheduler).not.toHaveBeenCalled()
    })
  })
})
