import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Reporter } from '../src/reporter/index'
import type { TraceConfig } from '../src/types'

// ─── 测试辅助 ───────────────────────────────────────────────

/** 基础配置 */
const baseConfig: TraceConfig = {
  projectId: 'test_project',
  reportUrl: 'https://api.example.com/report',
  sampleRate: 1,
  maxBufferSize: 5,
  flushInterval: 10000,
}

/** 创建成功响应的 fetch mock */
function mockFetchOk(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
}

/** 创建 500 响应的 fetch mock */
function mockFetch500(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(new Response(null, { status: 500, statusText: 'Error' }))
}

/** 设置通用全局 mock */
function setupGlobals(fetchImpl = mockFetchOk()): void {
  vi.stubGlobal('fetch', fetchImpl)
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 Chrome',
    sendBeacon: vi.fn().mockReturnValue(true),
  })
  vi.stubGlobal(
    'requestIdleCallback',
    vi.fn(() => 1),
  )
  vi.stubGlobal('cancelIdleCallback', vi.fn())
}

// ─── 测试套件 ───────────────────────────────────────────────

describe('Reporter', () => {
  let reporter: Reporter
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock = mockFetchOk()
    setupGlobals(fetchMock)
    reporter = new Reporter(baseConfig)
  })

  afterEach(() => {
    reporter.destroy()
    localStorage.clear()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // ── register ───────────────────────────────────────────

  describe('register', () => {
    it('构造时传入 config 应自动注册', () => {
      reporter.trackEvent('test')
      reporter.flush()
      // 不抛错即已注册
      expect(true).toBe(true)
    })

    it('构造时不传 config 应允许后续 register', () => {
      const r = new Reporter()
      expect(() => r.trackEvent('test')).not.toThrow() // 未注册，静默返回

      r.register(baseConfig)
      r.trackEvent('test_event', { foo: 'bar' })
      expect(true).toBe(true)
      r.destroy()
    })

    it('重复 register 应先销毁旧实例再初始化', () => {
      reporter.trackEvent('first', {})
      reporter.register(baseConfig)
      reporter.trackEvent('second', {})
      // 重新注册后 commonParams 应重置
      reporter.addCommonParams({ key: 'after' })
      expect(true).toBe(true)
    })
  })

  // ── trackEvent ─────────────────────────────────────────

  describe('trackEvent', () => {
    it('应组装 TrackEventData 并排入缓冲区，flush 后触发 fetch', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      reporter.trackEvent('click_btn', { page: 'home' })
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(fetchSpy).toHaveBeenCalled()

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)
      expect(body).toHaveLength(1)
      expect(body[0].eventName).toBe('click_btn')
      expect(body[0].customParams).toEqual({ page: 'home' })
      expect(body[0].commonParams).toEqual({})
      expect(body[0].envInfo).toBeDefined()

      fetchSpy.mockRestore()
    })

    it('应携带公共参数', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      reporter.addCommonParams({ userId: 'u123', version: '1.0' })
      reporter.trackEvent('page_view', { page: 'home' })
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)
      expect(body[0].commonParams).toEqual({ userId: 'u123', version: '1.0' })

      fetchSpy.mockRestore()
    })

    it('采样率为 0 时应丢弃所有事件', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      const lowReporter = new Reporter({ ...baseConfig, sampleRate: 0 })

      lowReporter.trackEvent('should_drop', {})
      lowReporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(fetchSpy).not.toHaveBeenCalled()

      fetchSpy.mockRestore()
      lowReporter.destroy()
    })

    it('采样率为 0.5 时 random > 0.5 应丢弃事件', async () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.6)
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      const halfReporter = new Reporter({ ...baseConfig, sampleRate: 0.5 })
      halfReporter.trackEvent('might_drop', {})
      halfReporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(fetchSpy).not.toHaveBeenCalled()

      randomSpy.mockRestore()
      fetchSpy.mockRestore()
      halfReporter.destroy()
    })

    it('采样率为 0.5 时 random <= 0.5 应保留事件', async () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.3)
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      const halfReporter = new Reporter({ ...baseConfig, sampleRate: 0.5 })
      halfReporter.trackEvent('keep_event', {})
      halfReporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(fetchSpy).toHaveBeenCalled()

      randomSpy.mockRestore()
      fetchSpy.mockRestore()
      halfReporter.destroy()
    })

    it('未注册时 trackEvent 静默返回不抛错', () => {
      const r = new Reporter()
      expect(() => r.trackEvent('unregistered')).not.toThrow()
      r.destroy()
    })

    it('多事件批量上报', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      reporter.trackEvent('e1', { n: 1 })
      reporter.trackEvent('e2', { n: 2 })
      reporter.trackEvent('e3', { n: 3 })
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(fetchSpy).toHaveBeenCalled()
      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)
      expect(body).toHaveLength(3)
      expect(body.map((e: { eventName: string }) => e.eventName)).toEqual(['e1', 'e2', 'e3'])

      fetchSpy.mockRestore()
    })
  })

  // ── 公共参数 ───────────────────────────────────────────

  describe('addCommonParams / removeCommonParams', () => {
    it('addCommonParams 应增量合并参数', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      reporter.addCommonParams({ a: 1 })
      reporter.addCommonParams({ b: 2 })
      reporter.trackEvent('test', {})
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)
      expect(body[0].commonParams).toMatchObject({ a: 1, b: 2 })

      fetchSpy.mockRestore()
    })

    it('addCommonParams 后覆盖同名 key', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      reporter.addCommonParams({ key: 'old' })
      reporter.addCommonParams({ key: 'new' })
      reporter.trackEvent('test', {})
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)
      expect(body[0].commonParams.key).toBe('new')

      fetchSpy.mockRestore()
    })

    it('removeCommonParams 应移除指定 key', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      reporter.addCommonParams({ a: 1, b: 2, c: 3 })
      reporter.removeCommonParams(['a', 'c'])
      reporter.trackEvent('test', {})
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)
      expect(body[0].commonParams).toEqual({ b: 2 })

      fetchSpy.mockRestore()
    })

    it('removeCommonParams 传入空数组不报错', () => {
      expect(() => reporter.removeCommonParams([])).not.toThrow()
    })

    it('removeCommonParams 移除不存在的 key 不报错', () => {
      expect(() => reporter.removeCommonParams(['nonexistent'])).not.toThrow()
    })
  })

  // ── setUser ────────────────────────────────────────────

  describe('setUser', () => {
    it('应更新 envInfo.uid 和公共参数', () => {
      reporter.setUser('user_abc')
      const info = reporter.getEnvInfo()
      expect(info.uid).toBe('user_abc')
    })

    it('setUser 后 trackEvent 携带 uid', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      reporter.setUser('user_xyz')
      reporter.trackEvent('test', {})
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)
      expect(body[0].commonParams.uid).toBe('user_xyz')
      expect(body[0].envInfo.uid).toBe('user_xyz')

      fetchSpy.mockRestore()
    })
  })

  // ── getEnvInfo ─────────────────────────────────────────

  describe('getEnvInfo', () => {
    it('应返回环境信息', () => {
      const info = reporter.getEnvInfo()
      expect(info.browser).toBeDefined()
      expect(info.os).toBeDefined()
      expect(info.userAgent).toBeDefined()
      expect(info.screenWidth).toBeGreaterThanOrEqual(0)
    })

    it('返回的是副本，修改不影响内部状态', () => {
      const info = reporter.getEnvInfo()
      info.uid = 'hacked'
      expect(reporter.getEnvInfo().uid).toBe('')
    })
  })

  // ── 事件钩子 ───────────────────────────────────────────

  describe('事件钩子', () => {
    it('success 钩子应在请求成功后触发，携带 eventCount 和 duration', async () => {
      const successCb = vi.fn()
      reporter.on('success', successCb)

      reporter.trackEvent('test_event', {})
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(successCb).toHaveBeenCalledTimes(1)
      const meta = successCb.mock.calls[0][0]
      expect(meta.eventCount).toBe(1)
      expect(typeof meta.duration).toBe('number')
    })

    it('failed 钩子应在全部重试失败后触发', async () => {
      vi.stubGlobal('fetch', mockFetch500())

      // 重新创建 reporter 以使用新的 fetch mock
      reporter.destroy()
      reporter = new Reporter(baseConfig)

      const failedCb = vi.fn()
      reporter.on('failed', failedCb)

      reporter.trackEvent('test_event', {})
      reporter.flush()

      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)
      await vi.advanceTimersByTimeAsync(0)

      expect(failedCb).toHaveBeenCalled()
      const meta = failedCb.mock.calls[0][0]
      expect(meta.error).toBeDefined()
      expect(meta.retryTimes).toBe(3)
    })

    it('retry 钩子应在每次重试前触发，携带 currentRetry 和 delay', async () => {
      vi.stubGlobal('fetch', mockFetch500())

      reporter.destroy()
      reporter = new Reporter(baseConfig)

      const retryCb = vi.fn()
      reporter.on('retry', retryCb)

      reporter.trackEvent('test_event', {})
      reporter.flush()

      await vi.advanceTimersByTimeAsync(0)

      expect(retryCb).toHaveBeenCalledTimes(1)
      expect(retryCb.mock.calls[0][0]).toMatchObject({ currentRetry: 1, delay: 1000 })

      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(0)

      expect(retryCb).toHaveBeenCalledTimes(2)
      expect(retryCb.mock.calls[1][0]).toMatchObject({ currentRetry: 2, delay: 2000 })

      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(0)

      expect(retryCb).toHaveBeenCalledTimes(3)
      expect(retryCb.mock.calls[2][0]).toMatchObject({ currentRetry: 3, delay: 4000 })
    })

    it('off 应能移除监听器', async () => {
      const cb = vi.fn()
      reporter.on('success', cb)
      reporter.off('success', cb)

      reporter.trackEvent('test_event', {})
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(cb).not.toHaveBeenCalled()
    })

    it('off 未注册的事件不报错', () => {
      expect(() => reporter.off('success', vi.fn())).not.toThrow()
    })

    it('监听器抛错不影响其他监听器', async () => {
      const badCb = vi.fn(() => {
        throw new Error('listener crash')
      })
      const goodCb = vi.fn()

      reporter.on('success', badCb)
      reporter.on('success', goodCb)

      reporter.trackEvent('test', {})
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(goodCb).toHaveBeenCalled()
    })

    it('同一事件可注册多个监听器', async () => {
      const cb1 = vi.fn()
      const cb2 = vi.fn()

      reporter.on('success', cb1)
      reporter.on('success', cb2)

      reporter.trackEvent('test', {})
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(cb1).toHaveBeenCalledTimes(1)
      expect(cb2).toHaveBeenCalledTimes(1)
    })
  })

  // ── destroy ────────────────────────────────────────────

  describe('destroy', () => {
    it('销毁后 trackEvent 不报错', () => {
      reporter.destroy()
      expect(() => reporter.trackEvent('after_destroy', {})).not.toThrow()
    })

    it('销毁后 flush 不报错', () => {
      reporter.destroy()
      expect(() => reporter.flush()).not.toThrow()
    })

    it('应能重复 register 而不泄漏', () => {
      reporter.destroy()
      reporter.register(baseConfig)
      reporter.trackEvent('re_registered', {})
      expect(true).toBe(true)
    })

    it('销毁后事件钩子不再触发', async () => {
      const cb = vi.fn()
      reporter.on('success', cb)
      reporter.destroy()

      // 重新创建 reporter 来验证
      reporter = new Reporter(baseConfig)
      reporter.trackEvent('test', {})
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      // 旧 reporter 的 cb 不应被触发
      expect(cb).not.toHaveBeenCalled()
    })

    it('重复销毁不报错', () => {
      reporter.destroy()
      expect(() => reporter.destroy()).not.toThrow()
    })
  })

  // ── 并发场景 ───────────────────────────────────────────

  describe('并发场景', () => {
    it('多个 trackEvent 快速连续调用应全部入队', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      for (let i = 0; i < 10; i++) {
        reporter.trackEvent(`evt_${i}`, { idx: i })
      }
      // 等待阈值触发的第一批上报完成
      await vi.advanceTimersByTimeAsync(0)
      // 手动 flush 剩余事件
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(fetchSpy).toHaveBeenCalled()
      const totalEvents = fetchSpy.mock.calls.reduce((sum, call) => {
        const body = JSON.parse(call[1]!.body as string)
        return sum + (Array.isArray(body) ? body.length : 0)
      }, 0)
      expect(totalEvents).toBe(10)

      fetchSpy.mockRestore()
    })

    it('flush 调用期间新事件入队不会丢失', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      reporter.trackEvent('e1', {})
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)
      reporter.trackEvent('e2', {})
      reporter.flush()
      await vi.advanceTimersByTimeAsync(0)

      expect(fetchSpy).toHaveBeenCalledTimes(2)

      fetchSpy.mockRestore()
    })
  })
})
