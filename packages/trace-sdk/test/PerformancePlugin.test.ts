import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PerformancePlugin, TraceCore } from '../src';

type PerformanceObserverCallback = ConstructorParameters<typeof PerformanceObserver>[0];

class MockPerformanceObserver {
  static instances: MockPerformanceObserver[] = [];

  observe = vi.fn();
  disconnect = vi.fn();

  constructor(private readonly callback: PerformanceObserverCallback) {
    MockPerformanceObserver.instances.push(this);
  }

  emit(entries: PerformanceEntry[]): void {
    this.callback(
      {
        getEntries: () => entries,
      } as PerformanceObserverEntryList,
      this as unknown as PerformanceObserver,
    );
  }
}

describe('PerformancePlugin', () => {
  beforeEach(() => {
    MockPerformanceObserver.instances = [];
    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
  });

  it('should track FCP metric', () => {
    const plugin = new PerformancePlugin();
    const core = {
      trackEvent: vi.fn(),
    };

    plugin.install(core as any);
    MockPerformanceObserver.instances[0].emit([
      {
        name: 'first-contentful-paint',
        startTime: 123,
      } as PerformanceEntry,
    ]);

    expect(core.trackEvent).toHaveBeenCalledWith(
      'performance',
      expect.objectContaining({
        metric: 'FCP',
        value: 123,
        timestamp: expect.any(Number),
      }),
      'normal',
      'performance',
    );

    plugin.uninstall();
  });

  it('should track LCP metric', () => {
    const plugin = new PerformancePlugin();
    const core = {
      trackEvent: vi.fn(),
    };

    plugin.install(core as any);
    MockPerformanceObserver.instances[1].emit([
      {
        name: 'largest-contentful-paint',
        startTime: 456,
      } as PerformanceEntry,
    ]);

    expect(core.trackEvent).toHaveBeenCalledWith(
      'performance',
      expect.objectContaining({
        metric: 'LCP',
        value: 456,
      }),
      'normal',
      'performance',
    );

    plugin.uninstall();
  });

  it('should accumulate CLS metric and ignore recent input shifts', () => {
    const plugin = new PerformancePlugin();
    const core = {
      trackEvent: vi.fn(),
    };

    plugin.install(core as any);
    MockPerformanceObserver.instances[2].emit([
      {
        name: 'layout-shift',
        value: 0.1,
        hadRecentInput: false,
      } as PerformanceEntry,
      {
        name: 'layout-shift',
        value: 0.2,
        hadRecentInput: true,
      } as PerformanceEntry,
    ]);

    expect(core.trackEvent).toHaveBeenCalledWith(
      'performance',
      expect.objectContaining({
        metric: 'CLS',
        value: 0.1,
      }),
      'normal',
      'performance',
    );

    plugin.uninstall();
  });

  it('should disconnect observers on uninstall', () => {
    const plugin = new PerformancePlugin();

    plugin.install({ trackEvent: vi.fn() } as any);
    plugin.uninstall();

    MockPerformanceObserver.instances.forEach(observer => {
      expect(observer.disconnect).toHaveBeenCalled();
    });
  });

  it('should not throw when PerformanceObserver is unavailable', () => {
    vi.stubGlobal('PerformanceObserver', undefined);

    const plugin = new PerformancePlugin();

    expect(() => plugin.install({ trackEvent: vi.fn() } as any)).not.toThrow();
    plugin.uninstall();
  });

  it('should install from TraceCore config', () => {
    const core = new TraceCore();
    const reporter = { report: vi.fn() };

    core.setReporter(reporter);

    core.register({
      projectId: 'test',
      reportUrl: 'http://localhost/api',
      plugins: {
        performance: true,
      },
    });

    MockPerformanceObserver.instances[0].emit([
      {
        name: 'first-contentful-paint',
        startTime: 123,
      } as PerformanceEntry,
    ]);

    expect(reporter.report).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'performance',
        eventName: 'performance',
        appId: 'test',
        properties: expect.objectContaining({
          metric: 'FCP',
          value: 123,
        }),
      }),
      'normal',
    );
  });
});
