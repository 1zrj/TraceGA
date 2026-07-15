import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpTransporter, TimeoutError } from '../src/core/HttpTransporter';
import { StoragePersister } from '../src/utils/StoragePersister';

describe('HttpTransporter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('send', () => {
    it('should send data successfully on first attempt', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(null, { status: 200, statusText: 'OK' })
      );
      vi.stubGlobal('fetch', mockFetch);

      const transporter = new HttpTransporter({
        baseURL: 'https://api.example.com/report',
      });

      const promise = transporter.send({ event: 'test' });
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed on the 3rd attempt', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, { status: 500, statusText: 'Internal Server Error' })
        )
        .mockResolvedValueOnce(
          new Response(null, { status: 500, statusText: 'Internal Server Error' })
        )
        .mockResolvedValueOnce(
          new Response(null, { status: 200, statusText: 'OK' })
        );
      vi.stubGlobal('fetch', mockFetch);

      const transporter = new HttpTransporter({
        baseURL: 'https://api.example.com/report',
      });

      const promise = transporter.send({ event: 'test' });

      // 第 1 次失败 → delay 1s
      await vi.advanceTimersByTimeAsync(1000);
      // 第 2 次失败 → delay 2s
      await vi.advanceTimersByTimeAsync(2000);
      // 第 3 次成功
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should reject after all retries exhausted', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(null, { status: 500, statusText: 'Internal Server Error' })
      );
      vi.stubGlobal('fetch', mockFetch);

      const transporter = new HttpTransporter({
        baseURL: 'https://api.example.com/report',
      });

      const promise = transporter.send({ event: 'test' });
      // 先挂上 reject 断言，再推进定时器，避免 unhandled rejection
      const assertion = expect(promise).rejects.toThrow('HTTP 500');

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      await vi.runAllTimersAsync();

      await assertion;
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should retry on 5xx response', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, { status: 500, statusText: 'Internal Server Error' })
        )
        .mockResolvedValueOnce(
          new Response(null, { status: 200, statusText: 'OK' })
        );
      vi.stubGlobal('fetch', mockFetch);

      const transporter = new HttpTransporter({
        baseURL: 'https://api.example.com/report',
      });

      const promise = transporter.send({ event: 'test' });

      await vi.advanceTimersByTimeAsync(1000);
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw TimeoutError on timeout', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(
          (_url: string, init?: RequestInit) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => {
                reject(new DOMException('Aborted', 'AbortError'));
              });
            })
        )
      );

      const transporter = new HttpTransporter({
        baseURL: 'https://api.example.com/report',
        timeout: 100,
      });

      const promise = transporter.send({ event: 'test' });
      // 先挂上 reject 断言，再推进定时器
      const assertion = expect(promise).rejects.toThrow(TimeoutError);

      // 第 1 次：超时 100ms → delay 1000ms
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(1000);
      // 第 2 次：超时 100ms → delay 2000ms
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(2000);
      // 第 3 次：超时 100ms → delay 4000ms
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(4000);
      // 第 4 次（最终）：超时 100ms → reject
      await vi.advanceTimersByTimeAsync(100);
      await vi.runAllTimersAsync();

      await assertion;
    });
  });

  describe('persister integration', () => {
    it('should cache data to localStorage after all retries exhausted', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(null, { status: 500, statusText: 'Internal Server Error' })
      );
      vi.stubGlobal('fetch', mockFetch);

      const persister = new StoragePersister();
      const transporter = new HttpTransporter({
        baseURL: 'https://api.example.com/report',
        persister,
      });

      const promise = transporter.send({ event: 'failed_test' });
      const assertion = expect(promise).rejects.toThrow('HTTP 500');

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      await vi.runAllTimersAsync();

      await assertion;

      // 验证 localStorage 中已缓存数据
      const cached = persister.load('trace_failed_cache');
      expect(cached).toEqual({ event: 'failed_test' });
    });
  });
});