import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchScheduler } from '../src/core/BatchScheduler';
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

describe('BatchScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('定时触发（时间到即发）', () => {
    it('should flush when interval elapses', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const scheduler = new BatchScheduler({
        maxBufferSize: 10,
        flushInterval: 5000,
        onFlush,
      });

      scheduler.add(makeEvent('e1'));
      scheduler.add(makeEvent('e2'));

      // 未到时间，不应触发
      await vi.advanceTimersByTimeAsync(4000);
      expect(onFlush).not.toHaveBeenCalled();

      // 到达 5000ms，触发上报
      await vi.advanceTimersByTimeAsync(1000);
      // 让异步 flush 完成
      await vi.advanceTimersByTimeAsync(0);
      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith([
        expect.objectContaining({ eventName: 'e1' }),
        expect.objectContaining({ eventName: 'e2' }),
      ]);
    });

    it('should flush multiple times at each interval', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const scheduler = new BatchScheduler({
        maxBufferSize: 10,
        flushInterval: 3000,
        onFlush,
      });

      scheduler.add(makeEvent('e1'));
      await vi.advanceTimersByTimeAsync(3000);
      await vi.advanceTimersByTimeAsync(0);
      expect(onFlush).toHaveBeenCalledTimes(1);

      scheduler.add(makeEvent('e2'));
      await vi.advanceTimersByTimeAsync(3000);
      await vi.advanceTimersByTimeAsync(0);
      expect(onFlush).toHaveBeenCalledTimes(2);
      expect(onFlush.mock.calls[1][0]).toEqual([
        expect.objectContaining({ eventName: 'e2' }),
      ]);
    });
  });

  describe('阈值触发（塞满即发）', () => {
    it('should flush immediately when buffer reaches maxBufferSize', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const scheduler = new BatchScheduler({
        maxBufferSize: 3,
        flushInterval: 10000,
        onFlush,
      });

      scheduler.add(makeEvent('e1'));
      scheduler.add(makeEvent('e2'));
      expect(onFlush).not.toHaveBeenCalled();

      scheduler.add(makeEvent('e3'));
      // 让异步阈值 flush 完成
      await vi.advanceTimersByTimeAsync(0);
      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith([
        expect.objectContaining({ eventName: 'e1' }),
        expect.objectContaining({ eventName: 'e2' }),
        expect.objectContaining({ eventName: 'e3' }),
      ]);
    });

    it('should reset timer after threshold flush', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const scheduler = new BatchScheduler({
        maxBufferSize: 3,
        flushInterval: 5000,
        onFlush,
      });

      // 塞满触发阈值上报
      scheduler.add(makeEvent('e1'));
      scheduler.add(makeEvent('e2'));
      scheduler.add(makeEvent('e3'));
      await vi.advanceTimersByTimeAsync(0);
      expect(onFlush).toHaveBeenCalledTimes(1);

      // 定时器已重置，距上次阈值 flush 后又过了 5000ms 才触发
      // 但缓冲区为空，takeAll 返回空数组，doFlush 跳过 onFlush
      onFlush.mockClear();
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(0);
      expect(onFlush).not.toHaveBeenCalled();
    });
  });

  describe('flush（手动触发）', () => {
    it('should manually flush and reset timer', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const scheduler = new BatchScheduler({
        maxBufferSize: 10,
        flushInterval: 5000,
        onFlush,
      });

      scheduler.add(makeEvent('e1'));
      scheduler.flush();
      await vi.advanceTimersByTimeAsync(0);

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith([
        expect.objectContaining({ eventName: 'e1' }),
      ]);

      // 手动 flush 后定时器已重置，未到 5000ms 不触发
      onFlush.mockClear();
      await vi.advanceTimersByTimeAsync(4000);
      expect(onFlush).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clear timer and stop flushing', async () => {
      const onFlush = vi.fn().mockResolvedValue(undefined);
      const scheduler = new BatchScheduler({
        maxBufferSize: 10,
        flushInterval: 3000,
        onFlush,
      });

      scheduler.add(makeEvent('e1'));
      scheduler.destroy();

      await vi.advanceTimersByTimeAsync(10000);
      await vi.advanceTimersByTimeAsync(0);
      expect(onFlush).not.toHaveBeenCalled();
    });
  });
});