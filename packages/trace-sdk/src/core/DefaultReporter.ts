import type { EventPriority, ResolvedTraceConfig, TraceReporter, TrackEventData } from '../types';
import { deepClone, safeJsonStringify } from '../utils';

interface BatchJob {
  attempts: number;
  events: TrackEventData[];
}

type ReporterErrorHandler = (error: unknown, context: string) => void;

const MAX_RETRY_ATTEMPTS = 2;

function getBatchUrl(reportUrl: string): string {
  const baseUrl = typeof window !== 'undefined' && window.location?.href ? window.location.href : 'http://tracega.local/';
  const parsedUrl = new URL(reportUrl, baseUrl);

  if (!parsedUrl.pathname.endsWith('/batch')) {
    parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/$/, '')}/batch`;
  }
  parsedUrl.hash = '';
  return parsedUrl.href;
}

export class DefaultReporter implements TraceReporter {
  private readonly batchUrl: string;
  private readonly maxBufferSize: number;
  private readonly flushInterval: number;
  private readonly maxConcurrentRequests: number;
  private readonly fetchImpl: typeof fetch | null;

  private eventQueue: TrackEventData[] = [];
  private jobQueue: BatchJob[] = [];
  private activeJobs = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private transportUnavailableReported = false;

  constructor(
    config: Readonly<ResolvedTraceConfig>,
    private readonly handleError: ReporterErrorHandler,
  ) {
    this.batchUrl = getBatchUrl(config.reportUrl);
    this.maxBufferSize = config.maxBufferSize;
    this.flushInterval = config.flushInterval;
    this.maxConcurrentRequests = config.maxConcurrentRequests;
    this.fetchImpl = this.captureFetch();

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.handlePageHide);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  report(event: TrackEventData, priority: EventPriority): void {
    if (this.destroyed) {
      return;
    }

    if (!this.fetchImpl && !this.canUseBeacon()) {
      if (!this.transportUnavailableReported) {
        this.transportUnavailableReported = true;
        this.handleError(new Error('TraceGA reporting requires fetch or sendBeacon'), 'report.transport.unavailable');
      }
      return;
    }

    this.eventQueue.push(deepClone(event));

    if (priority === 'urgent' || this.eventQueue.length >= this.maxBufferSize) {
      this.flush();
      return;
    }

    this.scheduleFlush(this.flushInterval);
  }

  flush(): void {
    if (this.destroyed || (!this.fetchImpl && !this.canUseBeacon())) {
      return;
    }

    this.clearTimer();
    this.createBatchJobs();
    this.pumpJobs();
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.flushWithBeacon();
    this.destroyed = true;
    this.clearTimer();

    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.handlePageHide);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // sendBeacon 未发出的剩余事件，最后用 fetch + keepalive 兜底
    if (this.jobQueue.length > 0 && this.fetchImpl) {
      this.sendJobsWithFetch();
    }

    this.eventQueue = [];
    this.jobQueue = [];
  }

  /**
   * 迁移事件到新 reporter（用于 re-register 场景）。
   * 取出所有未发送的事件并返回，同时解绑生命周期监听器并标记为已销毁。
   * 调用方负责将返回的事件写入新 reporter。
   */
  drainEvents(): Array<{ event: TrackEventData; priority: EventPriority }> {
    if (this.destroyed) {
      return [];
    }

    this.clearTimer();
    this.destroyed = true;

    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.handlePageHide);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    const events: Array<{ event: TrackEventData; priority: EventPriority }> = [];
    for (const event of this.eventQueue) {
      events.push({ event, priority: 'normal' });
    }
    for (const job of this.jobQueue) {
      for (const event of job.events) {
        events.push({ event, priority: 'normal' });
      }
    }

    this.eventQueue = [];
    this.jobQueue = [];
    return events;
  }

  private captureFetch(): typeof fetch | null {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      return window.fetch.bind(window);
    }
    return null;
  }

  private createBatchJobs(): void {
    while (this.eventQueue.length > 0) {
      this.jobQueue.push({
        attempts: 0,
        events: this.eventQueue.splice(0, this.maxBufferSize),
      });
    }
  }

  private pumpJobs(): void {
    if (this.destroyed) {
      return;
    }

    if (!this.fetchImpl) {
      // fetch 不可用但 sendBeacon 可用时，降级使用 sendBeacon 发送
      if (this.canUseBeacon()) {
        this.sendJobsWithBeacon();
      }
      return;
    }

    while (this.activeJobs < this.maxConcurrentRequests && this.jobQueue.length > 0) {
      const job = this.jobQueue.shift();
      if (!job) {
        break;
      }

      this.activeJobs += 1;
      void this.sendJob(job).finally(() => {
        this.activeJobs -= 1;

        if (this.jobQueue.length > 0) {
          this.pumpJobs();
        } else if (this.eventQueue.length > 0) {
          this.scheduleFlush(this.flushInterval);
        }
      });
    }
  }

  private async sendJob(job: BatchJob): Promise<void> {
    try {
      const response = await this.fetchImpl!(this.batchUrl, {
        body: safeJsonStringify({ events: job.events }),
        headers: { 'content-type': 'application/json' },
        keepalive: true,
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`TraceGA report failed with status ${response.status}`);
      }

      // 批量接口即使业务失败也返回 200，需解析响应体检查
      // 后端 TransformInterceptor 将结果包装在 { code, message, data } 中
      try {
        const body = await response.json();
        const result = body?.data ?? body;
        if (result && typeof result === 'object' && result.failedCount > 0) {
          // 部分事件业务校验失败（如 eventName 未注册、缺少必填字段等）
          // 成功的事件已由服务端存储，失败事件无法修复，直接丢弃不重试
          const reasons = Array.isArray(result.failures)
            ? result.failures.map((f: { reason?: string; index?: number }) => `[${f.index ?? '?'}] ${f.reason ?? 'unknown'}`).join('; ')
            : `failedCount=${result.failedCount}`;
          this.handleError(new Error(`TraceGA batch partial failure (${result.failedCount}/${job.events.length}): ${reasons}`), 'report.batch.validation');
          return;
        }
      } catch (parseError) {
        this.handleError(new Error('TraceGA batch response is not valid JSON'), 'report.transport');
      }
    } catch (error) {
      if (!this.destroyed && job.attempts < MAX_RETRY_ATTEMPTS) {
        const attempts = job.attempts + 1;
        const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
        setTimeout(() => {
          if (this.destroyed) return;
          this.jobQueue.push({ ...job, attempts });
          this.pumpJobs();
        }, delay);
        return;
      }

      this.handleError(error, 'report.transport');
    }
  }

  private scheduleFlush(delay: number): void {
    if (this.destroyed || this.timer) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, delay);
  }

  private clearTimer(): void {
    if (!this.timer) {
      return;
    }

    clearTimeout(this.timer);
    this.timer = null;
  }

  private readonly handlePageHide = (): void => {
    this.flushWithBeacon();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.flushWithBeacon();
    }
  };

  private canUseBeacon(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function';
  }

  private flushWithBeacon(): void {
    if (this.destroyed) return;

    this.clearTimer();
    this.createBatchJobs();

    // beacon 不可用时，降级为 fetch + keepalive，避免走 flush() 的 fetchImpl 空判断导致静默丢事件
    if (!this.canUseBeacon()) {
      this.sendJobsWithFetch();
      return;
    }

    this.trySendQueuedJobsWithBeacon();
  }

  /** 降级方案：使用 sendBeacon 发送所有 job（pumpJobs 中 fetch 不可用时的兜底） */
  private sendJobsWithBeacon(): void {
    this.trySendQueuedJobsWithBeacon();
  }

  /** 遍历 jobQueue，使用 sendBeacon 逐个发送，失败/异常则保留在队列中 */
  private trySendQueuedJobsWithBeacon(): void {
    const unsentJobs: BatchJob[] = [];

    this.jobQueue.forEach(job => {
      try {
        const payload = safeJsonStringify({ events: job.events });
        const body = new Blob([payload], { type: 'application/json' });

        if (!navigator.sendBeacon(this.batchUrl, body)) {
          unsentJobs.push(job);
        }
      } catch (error) {
        unsentJobs.push(job);
        this.handleError(error, 'report.beacon');
      }
    });

    this.jobQueue = unsentJobs;
    if (this.jobQueue.length > 0) {
      this.scheduleFlush(this.flushInterval);
    }
  }

  /** 降级方案：使用 fetch + keepalive 发送所有 job */
  private sendJobsWithFetch(): void {
    if (!this.fetchImpl) {
      this.handleError(new Error('TraceGA: no transport available (fetch + beacon both missing)'), 'report.transport.unavailable');
      return;
    }

    this.jobQueue.forEach(job => {
      try {
        this.fetchImpl!(this.batchUrl, {
          body: safeJsonStringify({ events: job.events }),
          headers: { 'content-type': 'application/json' },
          keepalive: true,
          method: 'POST',
        }).catch(error => {
          this.handleError(error, 'report.beacon.fallback');
        });
      } catch (error) {
        this.handleError(error, 'report.beacon.fallback');
      }
    });

    this.jobQueue = [];
  }
}
