import { describe, it, expect, vi } from 'vitest';
import { ErrorPlugin, TraceCore } from '../src';

describe('ErrorPlugin', () => {
  it('should install and reset from TraceCore register config', () => {
    const core = new TraceCore();
    const spy = vi.spyOn(console, 'log');

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

    expect(spy).toHaveBeenCalledWith(
      '[TraceGA SDK] Event tracked:',
      expect.objectContaining({
        eventName: 'js-error',
        customParams: expect.objectContaining({
          type: 'js-error',
          message: 'configured boom',
        }),
      }),
    );

    spy.mockClear();

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

    expect(spy).not.toHaveBeenCalledWith(
      '[TraceGA SDK] Event tracked:',
      expect.objectContaining({
        eventName: 'js-error',
      }),
    );

    spy.mockRestore();
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
        type: 'js-error',
        message: 'boom',
        filename: 'app.js',
        lineno: 10,
        colno: 20,
        errorName: 'Error',
        stack: error.stack,
      }),
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
        type: 'resource-error',
        tagName: 'img',
        resourceUrl: 'https://cdn.example.com/missing.png',
      }),
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
          type: 'http-error',
          requestType: 'fetch',
          method: 'POST',
          requestUrl: '/api/fail',
          status: 500,
          statusText: 'Server Error',
        }),
      );
    } finally {
      plugin.uninstall();
      window.fetch = originalFetch;
    }
  });

  it('should not track sdk reportUrl http errors', async () => {
    const core = new TraceCore();
    const spy = vi.spyOn(console, 'log');
    const originalFetch = window.fetch;
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 500, statusText: 'Server Error' }));

    window.fetch = fetchMock as any;

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

      expect(spy).not.toHaveBeenCalledWith(
        '[TraceGA SDK] Event tracked:',
        expect.objectContaining({
          customParams: expect.objectContaining({
            requestUrl: 'http://localhost/api/track',
          }),
        }),
      );
      expect(spy).toHaveBeenCalledWith(
        '[TraceGA SDK] Event tracked:',
        expect.objectContaining({
          eventName: 'http-error',
          customParams: expect.objectContaining({
            requestUrl: 'http://localhost/api/fail',
          }),
        }),
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
      spy.mockRestore();
    }
  });
});
