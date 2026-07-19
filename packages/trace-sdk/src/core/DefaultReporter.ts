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

    this.eventQueue = [];
    this.jobQueue = [];
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
    if (this.destroyed || !this.fetchImpl) {
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
    } catch (error) {
      if (!this.destroyed && job.attempts < MAX_RETRY_ATTEMPTS) {
        const attempts = job.attempts + 1;
        this.jobQueue.push({ ...job, attempts });
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
    if (this.destroyed || !this.canUseBeacon()) {
      this.flush();
      return;
    }

    this.clearTimer();
    this.createBatchJobs();

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
}
