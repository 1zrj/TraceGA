import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PriorityScheduler } from '../src/core/PriorityScheduler';
import type { TrackEventData } from '../src/types';

function makeEvent(name: string): TrackEventData {
  return {
    eventName: name,
    timestamp: Date.now(),
    customParams: {},
    commonParams: {},
    envInfo: {
      browser: 'Chrome',
      os: 'Windows',
      screen: '1920x1080',
      viewport: '1920x1080',
      uid: 'test',
      url: 'http://localhost',
      userAgent: 'test',
    },
  };
}

describe('PriorityScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('add（按优先级存入队列）', () => {
    it('should add events to the correct buffer', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const scheduler = new PriorityScheduler({
        maxBufferSize: 10,
        flushInterval: 5000,
        onFlush,
      });

      scheduler.add('urgent', makeEvent('u1'));
      scheduler.add('high', makeEvent('h1'));
      scheduler.add('normal', makeEvent('n1'));

      // 手动 flush 触发全量上报
      scheduler.flush();
      await vi.advanceTimersByTimeAsync(0);

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith([
        expect.objectContaining({ eventName: 'u1' }),
        expect.objectContaining({ eventName: 'h1' }),
        expect.objectContaining({ eventName: 'n1' }),
      ]);
    });
  });

  describe('全量上报优先级排序', () => {
    it('should merge all queues in urgent → high → normal order', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const scheduler = new PriorityScheduler({
        maxBufferSize: 10,
        flushInterval: 5000,
        onFlush,
      });

      scheduler.add('normal', makeEvent('n1'));
      scheduler.add('normal', makeEvent('n2'));
      scheduler.add('high', makeEvent('h1'));
      scheduler.add('urgent', makeEvent('u1'));
      scheduler.add('high', makeEvent('h2'));
      scheduler.add('urgent', makeEvent('u2'));

      scheduler.flush();
      await vi.advanceTimersByTimeAsync(0);

      const events = onFlush.mock.calls[0][0];
      const names = events.map((e: TrackEventData) => e.eventName);
      expect(names).toEqual(['u1', 'u2', 'h1', 'h2', 'n1', 'n2']);
    });
  });

  describe('阈值触发', () => {
    it('should trigger full flush when urgent queue reaches its max', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const scheduler = new PriorityScheduler({
        maxBufferSize: 10,
        urgentMaxSize: 2,
        flushInterval: 10000,
        onFlush,
      });

      scheduler.add('urgent', makeEvent('u1'));
      scheduler.add('normal', makeEvent('n1'));
      expect(onFlush).not.toHaveBeenCalled();

      // 第 2 条 urgent 触发阈值
      scheduler.add('urgent', makeEvent('u2'));
      await vi.advanceTimersByTimeAsync(0);

      expect(onFlush).toHaveBeenCalledTimes(1);
      const names = onFlush.mock.calls[0][0].map((e: TrackEventData) => e.eventName);
      expect(names).toEqual(['u1', 'u2', 'n1']);
    });

    it('should trigger full flush when normal queue reaches its max', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const scheduler = new PriorityScheduler({
        maxBufferSize: 3,
        flushInterval: 10000,
        onFlush,
      });

      scheduler.add('normal', makeEvent('n1'));
      scheduler.add('normal', makeEvent('n2'));
      expect(onFlush).not.toHaveBeenCalled();

      scheduler.add('normal', makeEvent('n3'));
      await vi.advanceTimersByTimeAsync(0);

      expect(onFlush).toHaveBeenCalledTimes(1);
    });
  });

  describe('空闲调度（仅清空 normal 队列）', () => {
    it('should flush only normal queue on idle callback', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);

      // mock requestIdleCallback
      let idleCallback: ((deadline: IdleDeadline) => void) | null = null;
      vi.stubGlobal('requestIdleCallback', (cb: (d: IdleDeadline) => void) => {
        idleCallback = cb;
        return 1;
      });
      vi.stubGlobal('cancelIdleCallback', vi.fn());

      const scheduler = new PriorityScheduler({
        maxBufferSize: 10,
        flushInterval: 5000,
        onFlush,
      });

      scheduler.add('urgent', makeEvent('u1'));
      scheduler.add('high', makeEvent('h1'));
      scheduler.add('normal', makeEvent('n1'));
      scheduler.add('normal', makeEvent('n2'));

      // 触发空闲回调
      expect(idleCallback).not.toBeNull();
      idleCallback!({
        didTimeout: false,
        timeRemaining: () => 50,
      });
      await vi.advanceTimersByTimeAsync(0);

      // 仅 normal 队列被上报
      expect(onFlush).toHaveBeenCalledTimes(1);
      const names = onFlush.mock.calls[0][0].map((e: TrackEventData) => e.eventName);
      expect(names).toEqual(['n1', 'n2']);

      // 空闲回调后，urgent 和 high 仍保留在队列中
      // 手动 flush 验证它们还在
      onFlush.mockClear();
      scheduler.flush();
      await vi.advanceTimersByTimeAsync(0);

      expect(onFlush).toHaveBeenCalledTimes(1);
      const remainingNames = onFlush.mock.calls[0][0].map((e: TrackEventData) => e.eventName);
      expect(remainingNames).toEqual(['u1', 'h1']);
    });

    it('should fallback to setTimeout when requestIdleCallback is unavailable', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);

      // 确保 requestIdleCallback 不可用
      vi.stubGlobal('requestIdleCallback', undefined);

      const scheduler = new PriorityScheduler({
        maxBufferSize: 10,
        flushInterval: 5000,
        onFlush,
        idleTimeoutFallback: 2000,
      });

      scheduler.add('normal', makeEvent('n1'));
      scheduler.add('normal', makeEvent('n2'));

      // 推进降级超时时间
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(0);

      expect(onFlush).toHaveBeenCalledTimes(1);
      const names = onFlush.mock.calls[0][0].map((e: TrackEventData) => e.eventName);
      expect(names).toEqual(['n1', 'n2']);
    });

    it('should not affect urgent/high queues during idle flush', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);

      let idleCallback: ((deadline: IdleDeadline) => void) | null = null;
      vi.stubGlobal('requestIdleCallback', (cb: (d: IdleDeadline) => void) => {
        idleCallback = cb;
        return 1;
      });
      vi.stubGlobal('cancelIdleCallback', vi.fn());

      const scheduler = new PriorityScheduler({
        maxBufferSize: 10,
        flushInterval: 5000,
        onFlush,
      });

      // 只有 normal 队列有数据
      scheduler.add('normal', makeEvent('n1'));

      idleCallback!({
        didTimeout: false,
        timeRemaining: () => 50,
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith([
        expect.objectContaining({ eventName: 'n1' }),
      ]);

      // 再次空闲回调，normal 已空，不应触发 onFlush
      onFlush.mockClear();
      idleCallback!({
        didTimeout: false,
        timeRemaining: () => 50,
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(onFlush).not.toHaveBeenCalled();
    });
  });

  describe('定时触发', () => {
    it('should flush all queues on interval', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const scheduler = new PriorityScheduler({
        maxBufferSize: 10,
        flushInterval: 3000,
        onFlush,
      });

      scheduler.add('urgent', makeEvent('u1'));
      scheduler.add('normal', makeEvent('n1'));

      await vi.advanceTimersByTimeAsync(3000);
      await vi.advanceTimersByTimeAsync(0);

      expect(onFlush).toHaveBeenCalledTimes(1);
      const names = onFlush.mock.calls[0][0].map((e: TrackEventData) => e.eventName);
      expect(names).toEqual(['u1', 'n1']);
    });
  });

  describe('destroy', () => {
    it('should clear all queues and stop scheduling', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('cancelIdleCallback', vi.fn());

      const scheduler = new PriorityScheduler({
        maxBufferSize: 10,
        flushInterval: 3000,
        onFlush,
      });

      scheduler.add('urgent', makeEvent('u1'));
      scheduler.add('normal', makeEvent('n1'));
      scheduler.destroy();

      await vi.advanceTimersByTimeAsync(10000);
      await vi.advanceTimersByTimeAsync(0);
      expect(onFlush).not.toHaveBeenCalled();
    });
  });
});