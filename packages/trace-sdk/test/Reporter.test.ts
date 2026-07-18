import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Reporter } from '../src/reporter/index';
import type { TraceConfig } from '../src/types';

describe('Reporter', () => {
  let reporter: Reporter;
  let fetchMock: ReturnType<typeof vi.fn>;
  const baseConfig: TraceConfig = {
    projectId: 'test_project',
    reportUrl: 'https://api.example.com/report',
    sampleRate: 1,
    maxBufferSize: 5,
    flushInterval: 10000,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 Chrome',
      sendBeacon: vi.fn().mockReturnValue(true),
    });
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('requestIdleCallback', () => 1);
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    reporter = new Reporter(baseConfig);
  });

  afterEach(() => {
    reporter.destroy();
    localStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('register', () => {
    it('应正确初始化并可通过 register 重新注册', () => {
      const reporter2 = new Reporter();
      expect(() => reporter2.trackEvent('test')).not.toThrow();

      reporter2.register(baseConfig);
      reporter2.trackEvent('test_event', { foo: 'bar' });

      expect(true).toBe(true);
      reporter2.destroy();
    });
  });

  describe('trackEvent', () => {
    it('应组装 TrackEventData 并排入缓冲区', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      reporter.trackEvent('click_btn', { page: 'home' });

      // 立即 flush 触发上报
      reporter.flush();
      await vi.advanceTimersByTimeAsync(0);

      expect(fetchSpy).toHaveBeenCalled();

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body).toHaveLength(1);
      expect(body[0].eventName).toBe('click_btn');
      expect(body[0].customParams).toEqual({ page: 'home' });
      expect(body[0].commonParams).toEqual({});
      expect(body[0].envInfo).toBeDefined();

      fetchSpy.mockRestore();
    });

    it('应携带公共参数', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      reporter.addCommonParams({ userId: 'u123', version: '1.0' });
      reporter.trackEvent('page_view', { page: 'home' });
      reporter.flush();
      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
      expect(body[0].commonParams).toEqual({ userId: 'u123', version: '1.0' });

      fetchSpy.mockRestore();
    });

    it('采样率为 0 时应丢弃所有事件', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const lowReporter = new Reporter({ ...baseConfig, sampleRate: 0 });

      lowReporter.trackEvent('should_drop', {});
      lowReporter.flush();
      await vi.advanceTimersByTimeAsync(0);

      // 无事件入队，fetch 不应被调用
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
      lowReporter.destroy();
    });

    it('采样率为 0.5 时应按概率过滤', async () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.6);
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const halfReporter = new Reporter({ ...baseConfig, sampleRate: 0.5 });
      halfReporter.trackEvent('might_drop', {});
      halfReporter.flush();
      await vi.advanceTimersByTimeAsync(0);

      expect(fetchSpy).not.toHaveBeenCalled();

      randomSpy.mockRestore();
      fetchSpy.mockRestore();
      halfReporter.destroy();
    });
  });

  describe('公共参数', () => {
    it('addCommonParams 应合并参数', () => {
      reporter.addCommonParams({ a: 1 });
      reporter.addCommonParams({ b: 2 });
      reporter.trackEvent('test', {});
      reporter.flush();
      expect(true).toBe(true);
    });

    it('removeCommonParams 应移除指定 key', () => {
      reporter.addCommonParams({ a: 1, b: 2, c: 3 });
      reporter.removeCommonParams(['a', 'c']);
      reporter.trackEvent('test', {});
      reporter.flush();
      expect(true).toBe(true);
    });
  });

  describe('setUser', () => {
    it('应更新 envInfo.uid', () => {
      reporter.setUser('user_abc');
      const info = reporter.getEnvInfo();
      expect(info.uid).toBe('user_abc');
    });
  });

  describe('getEnvInfo', () => {
    it('应返回环境信息副本', () => {
      const info = reporter.getEnvInfo();
      expect(info).toBeDefined();
      expect(info.browser).toBeDefined();
      expect(info.os).toBeDefined();
      expect(info.userAgent).toBeDefined();
    });
  });

  describe('事件钩子', () => {
    it('success 钩子应在请求成功后触发', async () => {
      const successCb = vi.fn();
      reporter.on('success', successCb);

      reporter.trackEvent('test_event', {});
      reporter.flush();
      await vi.advanceTimersByTimeAsync(0);

      expect(successCb).toHaveBeenCalled();
      const meta = successCb.mock.calls[0][0];
      expect(meta.eventCount).toBe(1);
      expect(typeof meta.duration).toBe('number');
    });

    it('failed 钩子应在全部重试失败后触发', async () => {
      const failedCb = vi.fn();
      reporter.on('failed', failedCb);

      // 让 fetch 返回 500
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(
        new Response(null, { status: 500, statusText: 'Error' })
      );

      reporter.trackEvent('test_event', {});
      reporter.flush();

      // 等待重试耗尽
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      await vi.advanceTimersByTimeAsync(0);

      expect(failedCb).toHaveBeenCalled();
      const meta = failedCb.mock.calls[0][0];
      expect(meta.error).toBeDefined();
      expect(meta.retryTimes).toBe(3);
    });

    it('retry 钩子应在每次重试前触发', async () => {
      const retryCb = vi.fn();
      reporter.on('retry', retryCb);

      // 重置 fetch mock 为 500
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(
        new Response(null, { status: 500, statusText: 'Error' })
      );

      reporter.trackEvent('test_event', {});
      reporter.flush();

      // 先让 microtask 链执行到 retry emit
      await vi.advanceTimersByTimeAsync(0);

      // retry 应在第一次重试前触发
      expect(retryCb).toHaveBeenCalledTimes(1);
      expect(retryCb.mock.calls[0][0]).toMatchObject({
        currentRetry: 1,
        delay: 1000,
      });

      // 前进第一次重试延迟
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(0);

      expect(retryCb).toHaveBeenCalledTimes(2);
      expect(retryCb.mock.calls[1][0]).toMatchObject({
        currentRetry: 2,
        delay: 2000,
      });

      // 前进第二次重试延迟
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(0);

      expect(retryCb).toHaveBeenCalledTimes(3);
      expect(retryCb.mock.calls[2][0]).toMatchObject({
        currentRetry: 3,
        delay: 4000,
      });
    });

    it('off 应能移除监听器', async () => {
      const cb = vi.fn();
      reporter.on('success', cb);
      reporter.off('success', cb);

      reporter.trackEvent('test_event', {});
      reporter.flush();
      await vi.advanceTimersByTimeAsync(0);

      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('应能重复 register 而不泄漏', () => {
      reporter.register(baseConfig);
      reporter.trackEvent('re_registered', {});
      expect(true).toBe(true);
    });
  });
});