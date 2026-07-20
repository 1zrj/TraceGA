import { describe, it, expect, vi } from 'vitest';
import { ErrorPlugin, TraceCore } from '../src';

describe('ErrorPlugin', () => {
  it('should install and reset from TraceCore register config', () => {
    const core = new TraceCore();
    const reporter = { report: vi.fn() };

    core.setReporter(reporter);

    core.register({
      projectId: 'test',
      reportUrl: 'http://localhost/api',
      plugins: {
        error: true,
      },
      errorPlugin: {
        js: true,
        promise: false,
        resource: false,
        http: false,
      },
    });

    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'configured boom',
      }),
    );

    expect(reporter.report).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'error',
        eventName: 'js-error',
        appId: 'test',
        properties: expect.objectContaining({
          message: 'configured boom',
          occurredAt: expect.any(Number),
        }),
      }),
      'urgent',
    );

    reporter.report.mockClear();

    core.register({
      projectId: 'test',
      reportUrl: 'http://localhost/api',
      plugins: {
        error: false,
      },
    });

    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'after reset',
      }),
    );

    expect(reporter.report).not.toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'js-error',
      }),
      expect.anything(),
    );
  });

  it('should apply sampleRate to plugin events', () => {
    const core = new TraceCore();
    const reporter = { report: vi.fn() };

    core.setReporter(reporter);

    core.register({
      projectId: 'test',
      reportUrl: 'http://localhost/api',
      sampleRate: 0,
      plugins: {
        error: true,
      },
      errorPlugin: {
        js: true,
        promise: false,
        resource: false,
        http: false,
      },
    });
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'sampled out plugin error',
      }),
    );

    expect(reporter.report).not.toHaveBeenCalled();
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
        filename: 'app.js',
        lineno: 10,
        colno: 20,
        error,
      }),
    );

    expect(core.trackEvent).toHaveBeenCalledWith(
      'js-error',
      expect.objectContaining({
        message: 'boom',
        occurredAt: expect.any(Number),
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
        message: 'promise boom',
        occurredAt: expect.any(Number),
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

    image.src = 'https://cdn.example.com/missing.png';
    document.body.appendChild(image);

    plugin.install(core as any);
    image.dispatchEvent(new Event('error'));

    expect(core.trackEvent).toHaveBeenCalledWith(
      'resource-error',
      expect.objectContaining({
        occurredAt: expect.any(Number),
        tagName: 'img',
        resourceUrl: 'https://cdn.example.com/missing.png',
      }),
      'urgent',
      'error',
    );

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

      await window.fetch('/api/fail', {
        method: 'POST',
      });

      expect(core.trackEvent).toHaveBeenCalledWith(
        'http-error',
        expect.objectContaining({
          requestType: 'fetch',
          occurredAt: expect.any(Number),
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

  it('should not track sdk reportUrl http errors', async () => {
    const core = new TraceCore();
    const reporter = { report: vi.fn() };
    const originalFetch = window.fetch;
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 500, statusText: 'Server Error' }));

    window.fetch = fetchMock as any;
    core.setReporter(reporter);

    try {
      core.register({
        projectId: 'test',
        reportUrl: 'http://localhost/api/track',
        plugins: {
          error: true,
        },
        errorPlugin: {
          js: false,
          promise: false,
          resource: false,
          http: true,
        },
      });

      await window.fetch('http://localhost/api/track');
      await window.fetch('http://localhost/api/fail');

      expect(reporter.report).not.toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            requestUrl: 'http://localhost/api/track',
          }),
        }),
        'urgent',
      );
      expect(reporter.report).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'error',
          eventName: 'http-error',
          appId: 'test',
          properties: expect.objectContaining({
            requestUrl: 'http://localhost/api/fail',
          }),
        }),
        'urgent',
      );
    } finally {
      core.register({
        projectId: 'test',
        reportUrl: 'http://localhost/api/track',
        plugins: {
          error: false,
        },
      });
      window.fetch = originalFetch;
    }
  });
});
