import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConcurrencyLimiter } from '../src/core/ConcurrencyLimiter';

describe('ConcurrencyLimiter', () => {
  describe('constructor', () => {
    it('should throw if maxConcurrent < 1', () => {
      expect(() => new ConcurrencyLimiter(0)).toThrow('maxConcurrent must be at least 1');
      expect(() => new ConcurrencyLimiter(-1)).toThrow('maxConcurrent must be at least 1');
    });
  });

  describe('acquire / release', () => {
    it('should allow acquiring up to maxConcurrent', async () => {
      const limiter = new ConcurrencyLimiter(2);

      await limiter.acquire();
      expect(limiter.getActiveCount()).toBe(1);

      await limiter.acquire();
      expect(limiter.getActiveCount()).toBe(2);
    });

    it('should queue when at capacity', async () => {
      const limiter = new ConcurrencyLimiter(1);

      await limiter.acquire();
      expect(limiter.getActiveCount()).toBe(1);

      // 第二个 acquire 应该排队
      const promise = limiter.acquire();
      expect(limiter.getWaitingCount()).toBe(1);

      // 释放后等待的应该被唤醒
      limiter.release();
      await promise;
      expect(limiter.getActiveCount()).toBe(1);
    });

    it('should wake up queued tasks in FIFO order', async () => {
      const limiter = new ConcurrencyLimiter(1);
      const order: number[] = [];

      await limiter.acquire();

      const p1 = limiter.acquire().then(() => { order.push(1); });
      const p2 = limiter.acquire().then(() => { order.push(2); });
      const p3 = limiter.acquire().then(() => { order.push(3); });

      expect(limiter.getWaitingCount()).toBe(3);

      limiter.release();
      await p1;
      expect(order).toEqual([1]);

      limiter.release();
      await p2;
      expect(order).toEqual([1, 2]);

      limiter.release();
      await p3;
      expect(order).toEqual([1, 2, 3]);
    });

    it('should not go negative when releasing extra times', () => {
      const limiter = new ConcurrencyLimiter(3);
      limiter.release();
      limiter.release();
      expect(limiter.getActiveCount()).toBe(0);
    });

    it('should handle mixed sequential operations', async () => {
      const limiter = new ConcurrencyLimiter(2);
      const results: string[] = [];

      async function task(name: string, delay: number): Promise<void> {
        await limiter.acquire();
        results.push(`start-${name}`);
        await new Promise((r) => setTimeout(r, delay));
        results.push(`end-${name}`);
        limiter.release();
      }

      task('A', 10);
      task('B', 10);
      task('C', 10);

      await new Promise((r) => setTimeout(r, 0));
      // A 和 B 应该同时开始（并发数 = 2），C 排队
      expect(results).toContain('start-A');
      expect(results).toContain('start-B');
      expect(results).not.toContain('start-C');

      await new Promise((r) => setTimeout(r, 20));
      // A 和 B 完成后，C 开始
      expect(results).toContain('end-A');
      expect(results).toContain('end-B');
      expect(results).toContain('start-C');

      await new Promise((r) => setTimeout(r, 20));
      expect(results).toContain('end-C');
    });
  });
});