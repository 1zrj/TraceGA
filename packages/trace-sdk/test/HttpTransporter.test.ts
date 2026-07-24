import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpTransporter, TimeoutError } from '../src/core/HttpTransporter'
import type { SuccessMeta, FailedMeta, RetryMeta } from '../src/core/HttpTransporter'
import { StoragePersister } from '../src/utils/StoragePersister'

// ─── 测试辅助 ───

const BASE_URL = 'https://api.example.com/report'

/** 创建成功的 fetch mock */
function mockFetchOk(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(new Response(null, { status: 200, statusText: 'OK' }))
}

/** 创建 500 的 fetch mock */
function mockFetch500(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(new Response(null, { status: 500, statusText: 'Internal Server Error' }))
}

/** 创建超时的 fetch mock（AbortController 触发 AbortError） */
function mockFetchTimeout(): ReturnType<typeof vi.fn> {
  return vi.fn().mockImplementation(
    (_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      }),
  )
}

/** 创建先失败后成功的 fetch mock */
function mockFetchRetryThenOk(failures: number): ReturnType<typeof vi.fn> {
  const mock = vi.fn()
  for (let i = 0; i < failures; i++) {
    mock.mockResolvedValueOnce(new Response(null, { status: 500, statusText: 'Error' }))
  }
  mock.mockResolvedValueOnce(new Response(null, { status: 200, statusText: 'OK' }))
  return mock
}

describe('HttpTransporter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // ── send ──

  describe('send', () => {
    it('首次请求成功，返回 undefined', async () => {
      vi.stubGlobal('fetch', mockFetchOk())

      const transporter = new HttpTransporter({ baseURL: BASE_URL })
      const promise = transporter.send({ event: 'test' })

      await vi.runAllTimersAsync()
      await expect(promise).resolves.toBeUndefined()
    })

    it('携带自定义 headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
      vi.stubGlobal('fetch', mockFetch)

      const transporter = new HttpTransporter({
        baseURL: BASE_URL,
        headers: { 'X-Custom': 'value' },
      })

      const promise = transporter.send({ event: 'test' })
      await vi.runAllTimersAsync()
      await promise

      const [, init] = mockFetch.mock.calls[0]
      expect(init.headers).toMatchObject({ 'X-Custom': 'value' })
    })

    it('5xx 响应后重试，第 3 次成功', async () => {
      const mockFetch = mockFetchRetryThenOk(2)
      vi.stubGlobal('fetch', mockFetch)

      const transporter = new HttpTransporter({ baseURL: BASE_URL })
      const promise = transporter.send({ event: 'test' })

      await vi.advanceTimersByTimeAsync(1000) // 第 1 次重试延迟
      await vi.advanceTimersByTimeAsync(2000) // 第 2 次重试延迟
      await vi.runAllTimersAsync()

      await expect(promise).resolves.toBeUndefined()
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('全部重试耗尽后 reject', async () => {
      vi.stubGlobal('fetch', mockFetch500())

      const transporter = new HttpTransporter({ baseURL: BASE_URL })
      const promise = transporter.send({ event: 'test' })

      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)
      await vi.runAllTimersAsync()

      await expect(promise).rejects.toThrow('HTTP 500')
    })

    it('网络错误（TypeError）后重试', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValue(new Response(null, { status: 200 }))
      vi.stubGlobal('fetch', mockFetch)

      const transporter = new HttpTransporter({ baseURL: BASE_URL })
      const promise = transporter.send({ event: 'test' })

      await vi.advanceTimersByTimeAsync(1000)
      await vi.runAllTimersAsync()

      await expect(promise).resolves.toBeUndefined()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('超时后抛出 TimeoutError，全部重试后 reject', async () => {
      vi.stubGlobal('fetch', mockFetchTimeout())

      const transporter = new HttpTransporter({ baseURL: BASE_URL, timeout: 100 })
      const promise = transporter.send({ event: 'test' })

      // 4 次超时 + 3 次重试延迟
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(4000)
      await vi.advanceTimersByTimeAsync(100)
      await vi.runAllTimersAsync()

      await expect(promise).rejects.toThrow(TimeoutError)
    })
  })

  // ── 事件钩子 ──

  describe('事件钩子', () => {
    it('成功时触发 success 钩子，携带 eventCount 和 duration', async () => {
      vi.stubGlobal('fetch', mockFetchOk())

      const transporter = new HttpTransporter({ baseURL: BASE_URL })
      const successCb = vi.fn()
      transporter.on('success', successCb)

      const promise = transporter.send({ event: 'test' }, 3)
      await vi.runAllTimersAsync()
      await promise

      expect(successCb).toHaveBeenCalledTimes(1)
      const meta = successCb.mock.calls[0][0] as SuccessMeta
      expect(meta.eventCount).toBe(3)
      expect(typeof meta.duration).toBe('number')
    })

    it('每次重试前触发 retry 钩子，携带 currentRetry 和 delay', async () => {
      vi.stubGlobal('fetch', mockFetch500())

      const transporter = new HttpTransporter({ baseURL: BASE_URL })
      const retryCb = vi.fn()
      transporter.on('retry', retryCb)

      const promise = transporter.send({ event: 'test' })
      const assertion = expect(promise).rejects.toThrow()

      await vi.advanceTimersByTimeAsync(0) // 让 microtask 链执行到 retry emit

      expect(retryCb).toHaveBeenCalledTimes(1)
      expect(retryCb.mock.calls[0][0] as RetryMeta).toMatchObject({ currentRetry: 1, delay: 1000 })

      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(0)

      expect(retryCb).toHaveBeenCalledTimes(2)
      expect(retryCb.mock.calls[1][0] as RetryMeta).toMatchObject({ currentRetry: 2, delay: 2000 })

      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(0)

      expect(retryCb).toHaveBeenCalledTimes(3)
      expect(retryCb.mock.calls[2][0] as RetryMeta).toMatchObject({ currentRetry: 3, delay: 4000 })

      await vi.advanceTimersByTimeAsync(4000)
      await vi.runAllTimersAsync()
      await assertion
    })

    it('全部重试失败后触发 failed 钩子，携带 error 和 retryTimes', async () => {
      vi.stubGlobal('fetch', mockFetch500())

      const transporter = new HttpTransporter({ baseURL: BASE_URL })
      const failedCb = vi.fn()
      transporter.on('failed', failedCb)

      const promise = transporter.send({ event: 'test' })
      const assertion = expect(promise).rejects.toThrow()

      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)
      await vi.runAllTimersAsync()
      await assertion

      expect(failedCb).toHaveBeenCalledTimes(1)
      const meta = failedCb.mock.calls[0][0] as FailedMeta
      expect(meta.error).toBeDefined()
      expect(meta.retryTimes).toBe(3)
    })
  })

  // ── on / off ──

  describe('on / off', () => {
    it('off 后回调不再触发', async () => {
      vi.stubGlobal('fetch', mockFetchOk())

      const transporter = new HttpTransporter({ baseURL: BASE_URL })
      const cb = vi.fn()
      transporter.on('success', cb)
      transporter.off('success', cb)

      const promise = transporter.send({ event: 'test' })
      await vi.runAllTimersAsync()
      await promise

      expect(cb).not.toHaveBeenCalled()
    })

    it('off 未注册的事件不报错', () => {
      const transporter = new HttpTransporter({ baseURL: BASE_URL })
      expect(() => transporter.off('success', vi.fn())).not.toThrow()
    })
  })

  // ── destroy ──

  describe('destroy', () => {
    it('销毁后已注册的回调不再触发', async () => {
      vi.stubGlobal('fetch', mockFetchOk())

      const transporter = new HttpTransporter({ baseURL: BASE_URL })
      const cb = vi.fn()
      transporter.on('success', cb)
      transporter.destroy()

      const promise = transporter.send({ event: 'test' })
      await vi.runAllTimersAsync()
      await promise

      expect(cb).not.toHaveBeenCalled()
    })
  })

  // ── persister 集成 ──

  describe('persister 集成', () => {
    it('全部重试失败后将数据缓存到 localStorage', async () => {
      vi.stubGlobal('fetch', mockFetch500())

      const persister = new StoragePersister()
      const transporter = new HttpTransporter({
        baseURL: BASE_URL,
        persister,
      })

      const promise = transporter.send({ event: 'failed_test' })
      const assertion = expect(promise).rejects.toThrow()

      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)
      await vi.runAllTimersAsync()
      await assertion

      expect(persister.load('trace_failed_cache')).toEqual({ event: 'failed_test' })
    })
  })

  // ── 集成场景 ──

  describe('集成场景', () => {
    it('多个 send 并发调用互不干扰', async () => {
      vi.stubGlobal('fetch', mockFetchOk())

      const transporter = new HttpTransporter({ baseURL: BASE_URL })
      const successCb = vi.fn()
      transporter.on('success', successCb)

      const p1 = transporter.send({ id: 1 }, 1)
      const p2 = transporter.send({ id: 2 }, 1)

      await vi.runAllTimersAsync()
      await Promise.all([p1, p2])

      expect(successCb).toHaveBeenCalledTimes(2)
      const meta1 = successCb.mock.calls[0][0] as SuccessMeta
      const meta2 = successCb.mock.calls[1][0] as SuccessMeta
      expect(meta1.eventCount).toBe(1)
      expect(meta2.eventCount).toBe(1)
    })
  })
})
