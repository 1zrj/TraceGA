import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TraceCore } from '../src';

describe('TraceCore skeleton', () => {
  it('should register without error', () => {
    const core = new TraceCore();

    expect(() => {
      core.register({
        appId: 'test',
        reportUrl: 'http://localhost/api',
        sampleRate: 0.5,
      });
    }).not.toThrow();
  });

  it('should call trackEvent and log', () => {
    const core = new TraceCore();
    const spy = vi.spyOn(console, 'log');

    core.register({
      appId: 'test',
      reportUrl: 'http://localhost/api',
      sampleRate: 1,
    });
    spy.mockClear();
    core.trackEvent('test', 'test_event', { foo: 'bar' });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should drop events when sampleRate is not hit', () => {
    const core = new TraceCore();
    const logSpy = vi.spyOn(console, 'log');
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.8);

    core.register({
      appId: 'test',
      reportUrl: 'http://localhost/api',
      sampleRate: 0.5,
    });
    logSpy.mockClear();
    core.trackEvent('test', 'sampled_out_event');

    expect(logSpy).not.toHaveBeenCalled();

    randomSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('should keep events when sampleRate is hit', () => {
    const core = new TraceCore();
    const logSpy = vi.spyOn(console, 'log');
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.2);

    core.register({
      appId: 'test',
      reportUrl: 'http://localhost/api',
      sampleRate: 0.5,
    });
    logSpy.mockClear();
    core.trackEvent('test', 'sampled_in_event');

    expect(logSpy).toHaveBeenCalledWith(
      '[TraceGA SDK] Event tracked:',
      expect.objectContaining({
        eventType: 'test',
        eventName: 'sampled_in_event',
        appId: 'test',
        url: window.location.href,
        userAgent: navigator.userAgent,
      }),
    );

    randomSpy.mockRestore();
    logSpy.mockRestore();
  });

  describe('register fallback reporting', () => {
    const reportUrl = 'https://collector.example.com/events';
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn().mockResolvedValue(new Response());
      vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should report an invalid registration directly', () => {
      const core = new TraceCore();

      core.register({ appId: '', reportUrl });

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledWith(
        reportUrl,
        expect.objectContaining({
          method: 'POST',
          keepalive: true,
        }),
      );

      const [, options] = fetchMock.mock.calls[0];
      expect(JSON.parse(options.body)).toMatchObject({
        eventType: 'sdk',
        eventName: 'register-failed',
        appId: '',
        properties: {
          message: 'TraceGA: appId is required',
        },
      });
    });
  });
});
