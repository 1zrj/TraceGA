import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LifecycleManager } from '../src/core/LifecycleManager';
import type { TrackEventData } from '../src/types';

function makeEvent(name: string): TrackEventData {
  return {
    eventName: name,
    timestamp: Date.now(),
    customParams: {},
    commonParams: {},
    envInfo: {} as any,
  };
}

describe('LifecycleManager', () => {
  let getRemainingEvents: ReturnType<typeof vi.fn>;
  let pauseScheduler: ReturnType<typeof vi.fn>;
  let destroyScheduler: ReturnType<typeof vi.fn>;
  let sendBeaconSpy: ReturnType<typeof vi.fn>;
  let instances: LifecycleManager[];

  beforeEach(() => {
    getRemainingEvents = vi.fn().mockReturnValue([]);
    pauseScheduler = vi.fn();
    destroyScheduler = vi.fn();
    sendBeaconSpy = vi.fn().mockReturnValue(true);
    instances = [];
    vi.stubGlobal('navigator', { sendBeacon: sendBeaconSpy });
  });

  afterEach(() => {
    // 销毁所有实例，解绑事件监听器
    for (const inst of instances) {
      inst.destroy();
    }
    vi.unstubAllGlobals();
  });

  function createManager(overrides?: Partial<{ events: TrackEventData[] }>) {
    if (overrides?.events) {
      getRemainingEvents.mockReturnValue(overrides.events);
    }
    const mgr = new LifecycleManager({
      reportUrl: 'https://api.example.com/report',
      getRemainingEvents: getRemainingEvents as () => TrackEventData[],
      pauseScheduler,
      destroyScheduler,
    });
    instances.push(mgr);
    return mgr;
  }

  describe('页面隐藏', () => {
    it('应在 visibilityState 变为 hidden 时暂停调度器并发送剩余数据', () => {
      const events = [makeEvent('e1'), makeEvent('e2')];
      createManager({ events });

      // 模拟页面隐藏
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(pauseScheduler).toHaveBeenCalled();
      expect(sendBeaconSpy).toHaveBeenCalledTimes(1);

      const [url, blob] = sendBeaconSpy.mock.calls[0];
      expect(url).toBe('https://api.example.com/report');
      expect(blob).toBeInstanceOf(Blob);
    });

    it('应在 pagehide 事件时触发发送', () => {
      const events = [makeEvent('e1')];
      createManager({ events });

      window.dispatchEvent(new Event('pagehide'));

      expect(pauseScheduler).toHaveBeenCalled();
      expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
    });

    it('缓冲区为空时不应调用 sendBeacon', () => {
      createManager();

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(pauseScheduler).toHaveBeenCalled();
      expect(sendBeaconSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendBeacon 降级', () => {
    it('sendBeacon 不可用时应降级为 fetch keepalive', () => {
      vi.stubGlobal('navigator', {});
      const fetchSpy = vi.fn().mockResolvedValue(new Response());
      const originalFetch = globalThis.fetch;
      globalThis.fetch = fetchSpy as any;

      const events = [makeEvent('e1')];
      createManager({ events });

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(fetchSpy).toHaveBeenCalled();
      const fetchArg = fetchSpy.mock.calls[0];
      expect(fetchArg[0]).toBe('https://api.example.com/report');
      expect(fetchArg[1].keepalive).toBe(true);
      expect(fetchArg[1].method).toBe('POST');

      globalThis.fetch = originalFetch;
    });
  });

  describe('分片', () => {
    it('超 60KB 时应分片发送', () => {
      const events: TrackEventData[] = [];
      const bigString = 'x'.repeat(1000);
      for (let i = 0; i < 100; i++) {
        events.push({
          eventName: `event_${i}`,
          timestamp: Date.now(),
          customParams: { data: bigString },
          commonParams: {},
          envInfo: {} as any,
        });
      }
      createManager({ events });

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(sendBeaconSpy.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('destroy', () => {
    it('应解绑事件并销毁调度器', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      const removeSpyWin = vi.spyOn(window, 'removeEventListener');

      const mgr = createManager();
      mgr.destroy();

      expect(destroyScheduler).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(removeSpyWin).toHaveBeenCalledWith('pagehide', expect.any(Function));

      removeSpy.mockRestore();
      removeSpyWin.mockRestore();
    });
  });
});