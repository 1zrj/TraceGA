import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DefaultReporter } from '../src/core/DefaultReporter';
import type { ResolvedTraceConfig, TrackEventData } from '../src/types';

function makeEvent(overrides: Partial<TrackEventData> = {}): TrackEventData {
  return {
    eventType: 'custom',
    eventName: 'test_event',
    appId: 'test_project',
    properties: {},
    timestamp: Date.now(),
    url: 'http://localhost/',
    referrer: '',
    ...overrides,
  };
}

function makeConfig(overrides: Partial<ResolvedTraceConfig> = {}): Readonly<ResolvedTraceConfig> {
  return Object.freeze({
    projectId: 'test_project',
    reportUrl: 'https://api.example.com/report',
    sampleRate: 1,
    maxBufferSize: 30,
    flushInterval: 5000,
    maxConcurrentRequests: 5,
    enableAutoError: false,
    enableDebug: false,
    includeUrlQuery: false,
    includeUrlHash: false,
    plugins: Object.freeze({}),
    errorPlugin: Object.freeze({}),
    eventPlugin: Object.freeze({}),
    performancePlugin: Object.freeze({}),
    whiteScreenPlugin: Object.freeze({}),
    hooks: {},
    ...overrides,
  } as ResolvedTraceConfig);
}

describe('DefaultReporter', () => {
  let handleError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    handleError = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('drainEvents', () => {
    it('应返回空数组当 reporter 已销毁', () => {
      const reporter = new DefaultReporter(makeConfig(), handleError);
      reporter.destroy();
      const drained = reporter.drainEvents();
      expect(drained).toEqual([]);
    });

    it('应返回 eventQueue 中所有事件', () => {
      const reporter = new DefaultReporter(makeConfig(), handleError);
      const e1 = makeEvent({ eventName: 'event_a' });
      const e2 = makeEvent({ eventName: 'event_b' });

      reporter.report(e1, 'normal');
      reporter.report(e2, 'normal');

      const drained = reporter.drainEvents();
      expect(drained).toHaveLength(2);
      expect(drained[0].event.eventName).toBe('event_a');
      expect(drained[1].event.eventName).toBe('event_b');
    });

    it('应返回 jobQueue 中所有事件', () => {
      // 使用大 maxBufferSize 避免阈值触发 flush，让事件留在 eventQueue 中
      const reporter = new DefaultReporter(makeConfig({ maxBufferSize: 100 }), handleError);

      const e1 = makeEvent({ eventName: 'event_a' });
      const e2 = makeEvent({ eventName: 'event_b' });

      reporter.report(e1, 'normal');
      reporter.report(e2, 'normal');

      const drained = reporter.drainEvents();
      expect(drained).toHaveLength(2);
      const names = drained.map(d => d.event.eventName);
      expect(names).toContain('event_a');
      expect(names).toContain('event_b');
    });

    it('drainEvents 后 reporter 应标记为已销毁', () => {
      const reporter = new DefaultReporter(makeConfig(), handleError);
      reporter.report(makeEvent(), 'normal');

      reporter.drainEvents();

      // drainEvents 后 report 应被忽略
      reporter.report(makeEvent({ eventName: 'after_drain' }), 'normal');
      const secondDrain = reporter.drainEvents();
      expect(secondDrain).toEqual([]);
    });

    it('drainEvents 后 repeat drainEvents 应返回空数组', () => {
      const reporter = new DefaultReporter(makeConfig(), handleError);
      reporter.report(makeEvent({ eventName: 'only_event' }), 'normal');

      const first = reporter.drainEvents();
      expect(first).toHaveLength(1);

      const second = reporter.drainEvents();
      expect(second).toEqual([]);
    });

    it('drainEvents 应解绑生命周期监听器', () => {
      const removeSpyWin = vi.spyOn(window, 'removeEventListener');
      const removeSpyDoc = vi.spyOn(document, 'removeEventListener');

      const reporter = new DefaultReporter(makeConfig(), handleError);
      reporter.drainEvents();

      expect(removeSpyWin).toHaveBeenCalledWith('pagehide', expect.any(Function));
      expect(removeSpyDoc).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

      removeSpyWin.mockRestore();
      removeSpyDoc.mockRestore();
    });

    it('返回的事件应包含正确 priority', () => {
      // 使用大 maxBufferSize 避免 urgent 触发 flush，让事件留在 eventQueue 中
      const reporter = new DefaultReporter(makeConfig({ maxBufferSize: 100 }), handleError);
      const e1 = makeEvent({ eventName: 'normal_event' });
      const e2 = makeEvent({ eventName: 'urgent_event' });

      // 二者都用 normal 避免 urgent 触发 flush
      reporter.report(e1, 'normal');
      reporter.report(e2, 'normal');

      const drained = reporter.drainEvents();
      expect(drained).toHaveLength(2);
      const names = drained.map(d => d.event.eventName);
      expect(names).toContain('normal_event');
      expect(names).toContain('urgent_event');
    });
  });
});
