import { EventType } from '../../core/types';
import type { ITraceCore, PerformancePluginConfig, TracePlugin } from '../../types';
import {
  PERFORMANCE_EVENT_NAME,
  PerformanceMetricName,
  type LargestContentfulPaintEntry,
  type LayoutShiftEntry,
  type PerformanceMetricPayload,
} from './types';

export class PerformancePlugin implements TracePlugin {
  name = 'PerformancePlugin';

  private installed = false;
  private core: ITraceCore | null = null;
  private observers: PerformanceObserver[] = [];
  private clsValue = 0;
  private lcpValue: number | null = null;
  private readonly config: Required<PerformancePluginConfig>;

  constructor(config: PerformancePluginConfig = {}) {
    this.config = {
      webVitals: true,
      resource: false,
      ...config,
    };
  }

  install(core: ITraceCore): void {
    if (this.installed) {
      return;
    }

    this.core = core;
    this.installed = true;

    if (!this.config.webVitals) {
      return;
    }

    try {
      this.observeFCP();
      this.observeLCP();
      this.observeCLS();
    } catch {
      this.uninstall();
    }
  }

  uninstall(): void {
    if (!this.installed) {
      return;
    }

    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch {
        // Ignore observer cleanup errors.
      }
    });

    this.observers = [];
    this.core = null;
    this.clsValue = 0;
    this.lcpValue = null;
    this.installed = false;
  }

  private observeFCP(): void {
    if (!this.canUsePerformanceObserver()) {
      this.reportExistingFCP();
      return;
    }

    const observer = new PerformanceObserver(list => {
      try {
        const entry = list.getEntries().find(item => item.name === 'first-contentful-paint');
        if (!entry) {
          return;
        }

        this.reportMetric(PerformanceMetricName.FCP, entry.startTime);
        observer.disconnect();
      } catch {
        // Plugin errors must not affect the host page.
      }
    });

    this.observe(observer, { type: 'paint', buffered: true });
  }

  private observeLCP(): void {
    if (!this.canUsePerformanceObserver()) {
      return;
    }

    const observer = new PerformanceObserver(list => {
      try {
        const entries = list.getEntries() as LargestContentfulPaintEntry[];
        const latest = entries[entries.length - 1];
        if (!latest) {
          return;
        }

        this.lcpValue = latest.startTime;
        this.reportMetric(PerformanceMetricName.LCP, latest.startTime);
      } catch {
        // Plugin errors must not affect the host page.
      }
    });

    this.observe(observer, { type: 'largest-contentful-paint', buffered: true });
  }

  private observeCLS(): void {
    if (!this.canUsePerformanceObserver()) {
      return;
    }

    const observer = new PerformanceObserver(list => {
      try {
        const entries = list.getEntries() as LayoutShiftEntry[];

        entries.forEach(entry => {
          if (!entry.hadRecentInput) {
            this.clsValue += entry.value;
          }
        });

        this.reportMetric(PerformanceMetricName.CLS, this.clsValue);
      } catch {
        // Plugin errors must not affect the host page.
      }
    });

    this.observe(observer, { type: 'layout-shift', buffered: true });
  }

  private reportExistingFCP(): void {
    if (typeof performance === 'undefined' || typeof performance.getEntriesByName !== 'function') {
      return;
    }

    try {
      const [entry] = performance.getEntriesByName('first-contentful-paint');
      if (entry) {
        this.reportMetric(PerformanceMetricName.FCP, entry.startTime);
      }
    } catch {
      // Ignore fallback collection errors.
    }
  }

  private observe(observer: PerformanceObserver, options: PerformanceObserverInit): void {
    try {
      observer.observe(options);
      this.observers.push(observer);
    } catch {
      try {
        observer.disconnect();
      } catch {
        // Ignore observer cleanup errors.
      }
    }
  }

  private reportMetric(metric: PerformanceMetricName, value: number): void {
    if (!this.core) {
      return;
    }

    const payload: PerformanceMetricPayload = {
      metric,
      value,
      timestamp: Date.now(),
    };

    this.core.trackEvent(EventType.Performance, PERFORMANCE_EVENT_NAME, payload);
  }

  private canUsePerformanceObserver(): boolean {
    return typeof PerformanceObserver !== 'undefined';
  }
}
