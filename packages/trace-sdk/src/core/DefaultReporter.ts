import type { EventPriority, ResolvedTraceConfig, TraceReporter, TrackEventData } from '../types';
import { deepClone, safeJsonStringify } from '../utils';

interface BatchJob {
  attempts: number;
  events: TrackEventData[];
}

type ReporterErrorHandler = (error: unknown, context: string) => void;
type ReporterState = 'active' | 'draining' | 'destroyed';

const MAX_RETRY_ATTEMPTS = 2;
const MAX_QUEUED_EVENTS = 1000;
const REQUEST_TIMEOUT = 10000;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function getRetryDelay(attempts: number): number {
  const base = Math.min(1000 * 2 ** attempts, 30000);
  return base * (0.5 + Math.random() * 0.5);
}

function getBatchUrl(reportUrl: string): string {
  const baseUrl = typeof window !== 'undefined' && window.location?.href ? window.location.href : 'http://tracega.local/';
  const parsedUrl = new URL(reportUrl, baseUrl);

  if (!parsedUrl.pathname.endsWith('/batch')) {
    parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/$/, '')}/batch`;
  }
  parsedUrl.hash = '';
  return parsedUrl.href;
}

export interface ReporterMetrics {
  queuedEvents: number;
  activeJobs: number;
  retryCount: number;
  droppedEvents: number;
  persistedEvents: number;
  totalSent: number;
  totalFailed: number;
}

export class DefaultReporter implements TraceReporter {
  private readonly batchUrl: string;
  private readonly maxBufferSize: number;
  private readonly flushInterval: number;
  private readonly maxConcurrentRequests: number;
  private readonly fetchImpl: typeof fetch | null;

  private eventQueue: TrackEventData[] = [];
  private queueHead = 0;
  private jobQueue: BatchJob[] = [];
  private activeJobRefs: BatchJob[] = [];
  private activeJobs = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private state: ReporterState = 'active';
  private transportUnavailableReported = false;
  private pendingRetries = new Map<ReturnType<typeof setTimeout>, BatchJob>();

  // Metrics
  private totalRetries = 0;
  private droppedEvents = 0;
  private persistedEvents = 0;
  private totalSent = 0;
  private totalFailed = 0;

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
    if (this.state !== 'active') {
      return;
    }

    if (!this.fetchImpl && !this.canUseBeacon()) {
      if (!this.transportUnavailableReported) {
        this.transportUnavailableReported = true;
        this.handleError(new Error('TraceGA reporting requires fetch or sendBeacon'), 'report.transport.unavailable');
      }
      return;
    }

    // Backpressure: drop oldest normal events when queue is full
    const queuedCount = this.eventQueue.length - this.queueHead;
    if (queuedCount >= MAX_QUEUED_EVENTS) {
      this.dropOldestNormalEvent();
    }

    this.eventQueue.push(deepClone(event));

    if (priority === 'urgent' || queuedCount + 1 >= this.maxBufferSize) {
      this.flush();
      return;
    }

    this.scheduleFlush(this.flushInterval);
  }

  flush(): void {
    if (this.state !== 'active' || (!this.fetchImpl && !this.canUseBeacon())) {
      return;
    }

    this.clearTimer();
    this.createBatchJobs();
    this.pumpJobs();
  }

  async destroy(): Promise<void> {
    if (this.state !== 'active') {
      return;
    }

    this.state = 'draining';
    this.clearTimer();
    this.removeLifecycleListeners();

    this.createBatchJobs();

    const retryJobs: BatchJob[] = [];
    for (const [timerId, job] of this.pendingRetries) {
      clearTimeout(timerId);
      retryJobs.push(job);
    }
    this.pendingRetries.clear();

    const allJobs = [...this.activeJobRefs, ...retryJobs, ...this.jobQueue];
    this.jobQueue = [];

    for (const job of allJobs) {
      const sent = this.trySendBeaconForJob(job);
      if (!sent && this.fetchImpl) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
          const response = await this.fetchImpl(this.batchUrl, {
            body: safeJsonStringify({ events: job.events }),
            headers: { 'content-type': 'application/json' },
            keepalive: true,
            method: 'POST',
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (!response.ok) {
            this.persistJob(job);
          } else {
            this.totalSent++;
          }
        } catch {
          this.persistJob(job);
        }
      } else if (!sent && !this.fetchImpl) {
        this.persistJob(job);
      }
    }

    this.state = 'destroyed';
    this.activeJobRefs = [];
    this.eventQueue = [];
    this.jobQueue = [];
    this.queueHead = 0;
  }

  /**
   * Drain all pending events for migration to a new reporter instance.
   * Called by TraceCore during re-register.
   */
  drainEvents(): Array<{ event: TrackEventData; priority: EventPriority }> {
    this.clearTimer();
    this.removeLifecycleListeners();

    const result: Array<{ event: TrackEventData; priority: EventPriority }> = [];

    for (let i = this.queueHead; i < this.eventQueue.length; i++) {
      result.push({ event: this.eventQueue[i], priority: 'normal' });
    }
    this.eventQueue = [];
    this.queueHead = 0;

    for (const job of this.jobQueue) {
      for (const event of job.events) {
        result.push({ event, priority: 'normal' });
      }
    }
    this.jobQueue = [];

    this.state = 'destroyed';
    return result;
  }

  getMetrics(): Readonly<ReporterMetrics> {
    return Object.freeze({
      queuedEvents: this.eventQueue.length - this.queueHead,
      activeJobs: this.activeJobs,
      retryCount: this.totalRetries,
      droppedEvents: this.droppedEvents,
      persistedEvents: this.persistedEvents,
      totalSent: this.totalSent,
      totalFailed: this.totalFailed,
    });
  }


  private captureFetch(): typeof fetch | null {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      return window.fetch.bind(window);
    }
    return null;
  }

  private createBatchJobs(): void {
    while (this.queueHead < this.eventQueue.length) {
      const end = Math.min(this.queueHead + this.maxBufferSize, this.eventQueue.length);
      const batch = this.eventQueue.slice(this.queueHead, end);
      this.queueHead = end;
      this.jobQueue.push({
        attempts: 0,
        events: batch,
      });
    }

    // Reset queue when fully drained
    if (this.queueHead >= this.eventQueue.length) {
      this.eventQueue = [];
      this.queueHead = 0;
    }
  }

  private pumpJobs(): void {
    if (this.state !== 'active' || !this.fetchImpl) {
      return;
    }

    while (this.activeJobs < this.maxConcurrentRequests && this.jobQueue.length > 0) {
      const job = this.jobQueue.shift();
      if (!job) {
        break;
      }

      this.activeJobs += 1;
      this.activeJobRefs.push(job);

      void this.sendJob(job).finally(() => {
        this.activeJobs -= 1;
        const idx = this.activeJobRefs.indexOf(job);
        if (idx >= 0) {
          this.activeJobRefs.splice(idx, 1);
        }

        if (this.jobQueue.length > 0) {
          this.pumpJobs();
        } else if (this.eventQueue.length > this.queueHead && this.state === 'active') {
          this.scheduleFlush(this.flushInterval);
        }
      });
    }
  }

  private async sendJob(job: BatchJob): Promise<void> {
    if (!this.fetchImpl) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await this.fetchImpl(this.batchUrl, {
        body: safeJsonStringify({ events: job.events }),
        headers: { 'content-type': 'application/json' },
        keepalive: true,
        method: 'POST',
        signal: controller.signal,
      });

      if (response.ok) {
        this.totalSent++;
        return;
      }

      if (this.state === 'active' && job.attempts < MAX_RETRY_ATTEMPTS && RETRYABLE_STATUSES.has(response.status)) {
        this.scheduleRetry(job);
        return;
      }

      this.totalFailed++;
      this.handleError(new Error(`TraceGA report failed with status ${response.status}`), 'report.transport');
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        if (this.state === 'active' && job.attempts < MAX_RETRY_ATTEMPTS) {
          this.scheduleRetry(job);
          return;
        }
      }

      if (this.state === 'active' && job.attempts < MAX_RETRY_ATTEMPTS) {
        this.scheduleRetry(job);
        return;
      }

      this.totalFailed++;
      this.handleError(error, 'report.transport');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private scheduleRetry(job: BatchJob): void {
    if (this.state !== 'active') {
      return;
    }

    this.totalRetries++;
    const delay = getRetryDelay(job.attempts);

    const timerId = setTimeout(() => {
      this.pendingRetries.delete(timerId);
      if (this.state !== 'active') {
        return;
      }
      const retryJob: BatchJob = { ...job, attempts: job.attempts + 1 };
      this.jobQueue.push(retryJob);
      this.pumpJobs();
    }, delay);

    this.pendingRetries.set(timerId, job);
  }

  private scheduleFlush(delay: number): void {
    if (this.state !== 'active' || this.timer) {
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

  private removeLifecycleListeners(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.handlePageHide);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private dropOldestNormalEvent(): void {
    this.droppedEvents++;
    // Drop from the front of the queue (oldest)
    if (this.eventQueue.length > this.queueHead) {
      this.queueHead++;
      // Compact periodically
      if (this.queueHead > 100) {
        this.eventQueue = this.eventQueue.slice(this.queueHead);
        this.queueHead = 0;
      }
    }
  }

  private trySendBeaconForJob(job: BatchJob): boolean {
    if (!this.canUseBeacon()) {
      return false;
    }

    try {
      const payload = safeJsonStringify({ events: job.events });
      const body = new Blob([payload], { type: 'application/json' });
      const result = navigator.sendBeacon(this.batchUrl, body);
      if (result) {
        this.totalSent++;
      }
      return result;
    } catch {
      return false;
    }
  }

  private persistJob(job: BatchJob): void {
    try {
      const key = 'trace_failed_cache';
      const existing = sessionStorage.getItem(key);
      let cache: TrackEventData[] = [];
      if (existing) {
        try {
          cache = JSON.parse(existing);
        } catch {
          // Corrupted cache, start fresh
        }
      }
      cache.push(...job.events);
      if (cache.length > 200) {
        cache = cache.slice(-200);
      }
      sessionStorage.setItem(key, safeJsonStringify(cache));
      this.persistedEvents += job.events.length;
    } catch {
      // Storage full or unavailable — event is lost
      this.droppedEvents += job.events.length;
    }
  }

  private canUseBeacon(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function';
  }

  private readonly handlePageHide = (): void => {
    if (this.state !== 'active') {
      return;
    }
    this.clearTimer();
    this.createBatchJobs();

    const unsentJobs: BatchJob[] = [];
    for (const job of this.jobQueue) {
      if (!this.trySendBeaconForJob(job)) {
        unsentJobs.push(job);
      }
    }
    this.jobQueue = unsentJobs;
  };

  private readonly handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.handlePageHide();
    }
  };
}
