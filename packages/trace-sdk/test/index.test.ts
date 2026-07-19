import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Reporter } from '../src/reporter/index';

describe('Reporter exports', () => {
  let reporter: Reporter;

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0',
      sendBeacon: vi.fn().mockReturnValue(true),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    ));
    reporter = new Reporter();
  });

  afterEach(() => {
    reporter.destroy();
    vi.unstubAllGlobals();
  });

  it('should register without error', () => {
    const core = new TraceCore();

    expect(() => {
      core.register({
        projectId: 'test',
        reportUrl: 'http://localhost/api',
      });
    }).not.toThrow();

    expect(core.getConfig()).toEqual(
      expect.objectContaining({
        projectId: 'test',
        sampleRate: 1,
        maxBufferSize: 20,
        flushInterval: 3000,
      }),
    );
  });

  it('should build and pass a stable event to the reporter', () => {
    const core = new TraceCore();
    const reporter = { report: vi.fn() };

    core.setReporter(reporter);
    core.register({
      projectId: 'test',
      reportUrl: 'http://localhost/api',
    });
    core.addCommonParams({ channel: 'web' });
    core.trackEvent('test_event', { foo: 'bar' });

    expect(reporter.report).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'custom',
        eventName: 'test_event',
        appId: 'test',
        properties: expect.objectContaining({
          channel: 'web',
          foo: 'bar',
          uid: expect.any(String),
        }),
        timestamp: expect.any(Number),
        url: expect.any(String),
        referrer: expect.any(String),
      }),
      'normal',
    );
  });
});

// Error插件测试
describe('ErrorPlugin', () => {
  it('contains handler installation failures and cleans up healthy handlers', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
    const onError = vi.fn();
    const plugin = new ErrorPlugin({ onError });
    const core = { trackEvent: vi.fn() };

    Object.defineProperty(window, 'fetch', {
      configurable: true,
      get: () => vi.fn(),
      set: () => {
        throw new Error('fetch is read-only');
      },
    });

    try {
      expect(() => plugin.install(core as any)).not.toThrow();
      expect(onError).toHaveBeenCalledWith(expect.any(Error), 'error.install.handler');
      expect(() => plugin.uninstall()).not.toThrow();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, 'fetch', originalDescriptor);
      } else {
        delete (window as { fetch?: typeof fetch }).fetch;
      }
    }
  });

  it('should track js-error events', () => {
    const plugin = new ErrorPlugin();
    const core = {
      trackEvent: vi.fn(),
    };
    const error = new Error('boom');

    plugin.install(core as any);
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: error.message,
        filename: 'app.js?token=secret#private',
        lineno: 10,
        colno: 20,
        error,
      }),
    );

    expect(core.trackEvent).toHaveBeenCalledWith(
      'js-error',
      expect.objectContaining({
        type: 'js-error',
        message: 'boom',
        filename: 'app.js',
        lineno: 10,
        colno: 20,
        errorName: 'Error',
        stack: error.stack,
      }),
      'urgent',
      'error',
    );

    plugin.uninstall();
  });

  it('should remove error listener on uninstall', () => {
    const plugin = new ErrorPlugin();
    const core = {
      trackEvent: vi.fn(),
    };

    plugin.install(core as any);
    plugin.uninstall();
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'after uninstall',
      }),
    );

    expect(core.trackEvent).not.toHaveBeenCalled();
  });

  it('should track promise-error events', () => {
    const plugin = new ErrorPlugin();
    const core = {
      trackEvent: vi.fn(),
    };
    const error = new Error('promise boom');

    plugin.install(core as any);
    window.dispatchEvent(
      Object.defineProperty(new Event('unhandledrejection'), 'reason', {
        value: error,
      }),
    );

    expect(core.trackEvent).toHaveBeenCalledWith(
      'promise-error',
      expect.objectContaining({
        type: 'promise-error',
        message: 'promise boom',
        reasonType: 'Error',
        errorName: 'Error',
        stack: error.stack,
      }),
      'urgent',
      'error',
    );

    plugin.uninstall();
  });

  it('should track resource-error events', () => {
    const plugin = new ErrorPlugin();
    const core = {
      trackEvent: vi.fn(),
    };
    const image = document.createElement('img');

    image.src = 'https://cdn.example.com/missing.png?token=secret#private';
    document.body.appendChild(image);

    plugin.install(core as any);
    image.dispatchEvent(new Event('error'));

    expect(core.trackEvent).toHaveBeenCalledWith(
      'resource-error',
      expect.objectContaining({
        type: 'resource-error',
        tagName: 'img',
        resourceUrl: 'https://cdn.example.com/missing.png',
      }),
      'urgent',
      'error',
    );
    expect(core.trackEvent.mock.calls[0]?.[1]).not.toHaveProperty('outerHTML');

    plugin.uninstall();
    image.remove();
  });

  it('should track fetch http-error events', async () => {
    const plugin = new ErrorPlugin();
    const core = {
      trackEvent: vi.fn(),
    };
    const originalFetch = window.fetch;
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 500, statusText: 'Server Error' }));

    window.fetch = fetchMock as any;

    try {
      plugin.install(core as any);

      await window.fetch('/api/fail?token=secret#private', {
        method: 'POST',
      });

      expect(core.trackEvent).toHaveBeenCalledWith(
        'http-error',
        expect.objectContaining({
          type: 'http-error',
          requestType: 'fetch',
          method: 'POST',
          requestUrl: '/api/fail',
          status: 500,
          statusText: 'Server Error',
        }),
        'urgent',
        'error',
      );
    } finally {
      plugin.uninstall();
      window.fetch = originalFetch;
    }
  });
});
