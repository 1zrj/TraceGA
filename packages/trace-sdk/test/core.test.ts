import { describe, expect, it, vi } from 'vitest';
import { TraceCore } from '../src';
import type { CommonParams, EventPriority, ResolvedTraceConfig, TraceLifecycleHooks, TrackEventData } from '../src';

describe('TraceCore behavior', () => {
  it('silently ignores events before register', () => {
    const core = new TraceCore();
    const reporter = { report: vi.fn() };

    core.setReporter(reporter);
    expect(() => core.trackEvent('click')).not.toThrow();
    expect(reporter.report).not.toHaveBeenCalled();
  });

  it('returns a copy of common params', () => {
    const core = new TraceCore();
    core.addCommonParams({ nested: { value: 1 } });

    const copy = core.getCommonParams();
    (copy.nested as { value: number }).value = 2;

    expect(core.getCommonParams()).toEqual({ nested: { value: 1 } });
  });

  it('isolates common params with __proto__ keys and mutable nested values', () => {
    const core = new TraceCore();
    const protoParams = Object.create(null) as CommonParams;
    Object.defineProperty(protoParams, '__proto__', {
      configurable: true,
      enumerable: true,
      value: { polluted: true },
      writable: true,
    });
    const endpoint = new URL('https://tracega.dev/initial');

    core.addCommonParams({ ...protoParams, endpoint });
    const firstCopy = core.getCommonParams();
    const secondCopy = core.getCommonParams();
    (firstCopy.endpoint as URL).pathname = '/changed';
    firstCopy.externalMutation = true;

    expect(firstCopy).not.toBe(secondCopy);
    expect(Object.getPrototypeOf(secondCopy)).not.toEqual({ polluted: true });
    expect((secondCopy.endpoint as URL).pathname).toBe('/initial');
    expect(core.getCommonParams()).not.toHaveProperty('externalMutation');
  });

  it('merges, overwrites, and removes common params', () => {
    const core = new TraceCore();

    core.addCommonParams({ channel: 'web', version: 1 });
    core.addCommonParams({ version: 2, region: 'cn' });
    core.removeCommonParams(['channel']);
    core.setUser('user-1');

    expect(core.getCommonParams()).toEqual({
      version: 2,
      region: 'cn',
      userId: 'user-1',
    });
  });

  it('initializes environment information during register', () => {
    const core = new TraceCore();

    expect(core.getEnvInfo()).toBeNull();
    core.register({ projectId: 'test', reportUrl: '/api/track' });

    expect(core.getEnvInfo()).toEqual(
      expect.objectContaining({
        userAgent: expect.any(String),
        browser: expect.any(String),
        os: expect.any(String),
        screenWidth: expect.any(Number),
        viewportWidth: expect.any(Number),
        url: expect.any(String),
        uid: expect.any(String),
      }),
    );
  });

  it('builds a backend-compatible event payload', () => {
    const core = new TraceCore();
    const reporter = { report: vi.fn() };

    core.setReporter(reporter);
    core.register({
      projectId: 'web-app',
      reportUrl: '/api/track',
      hooks: {
        onBeforeTrack(event) {
          event.userId = event.userId ? ` ${event.userId} ` : undefined;
          return Object.assign(event, { sdkOnly: true });
        },
      },
    });
    core.addCommonParams({
      user_id: 'user-1',
      sessionId: 'session-1',
      channel: 'web',
      source: 'common',
    });
    core.trackEvent(
      'checkout_click',
      {
        source: 'custom',
        amount: 99,
        pageUrl: 'https://app.example.com/cart#summary',
        previousUrl: 'https://app.example.com/products',
      },
      'high',
      'click',
    );

    const [event, priority] = reporter.report.mock.calls[0] as unknown as [TrackEventData, EventPriority];

    expect(Object.keys(event).sort()).toEqual(['appId', 'eventName', 'eventType', 'properties', 'referrer', 'sessionId', 'timestamp', 'url', 'userId'].sort());
    expect(event).toEqual(
      expect.objectContaining({
        eventType: 'click',
        eventName: 'checkout_click',
        appId: 'web-app',
        userId: 'user-1',
        sessionId: 'session-1',
        timestamp: expect.any(Number),
        url: 'https://app.example.com/cart#summary',
        referrer: 'https://app.example.com/products',
        properties: expect.objectContaining({
          channel: 'web',
          source: 'custom',
          amount: 99,
          uid: expect.any(String),
        }),
      }),
    );
    expect(event.properties).not.toHaveProperty('user_id');
    expect(event.properties).not.toHaveProperty('sessionId');
    expect(event).not.toHaveProperty('projectId');
    expect(event).not.toHaveProperty('priority');
    expect(event).not.toHaveProperty('sdkOnly');
    expect(priority).toBe('high');
  });

  it('does not report when sampleRate is zero', () => {
    const core = new TraceCore();
    const reporter = { report: vi.fn() };

    core.setReporter(reporter);
    core.register({
      projectId: 'test',
      reportUrl: '/api/track',
      sampleRate: 0,
    });
    core.trackEvent('click');

    expect(reporter.report).not.toHaveBeenCalled();
  });

  it('uses random sampling for rates between zero and one', () => {
    const core = new TraceCore();
    const reporter = { report: vi.fn() };
    const random = vi.spyOn(Math, 'random');

    core.setReporter(reporter);
    core.register({
      projectId: 'test',
      reportUrl: '/api/track',
      sampleRate: 0.5,
    });

    random.mockReturnValueOnce(0.8).mockReturnValueOnce(0.2);
    core.trackEvent('discarded');
    core.trackEvent('accepted');

    expect(reporter.report).toHaveBeenCalledTimes(1);
    expect(reporter.report).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'accepted' }), 'normal');
    random.mockRestore();
  });

  it('rejects sample rates outside zero and one', () => {
    const onError = vi.fn();
    const core = new TraceCore();

    core.register({
      projectId: 'test',
      reportUrl: '/api/track',
      sampleRate: 1.1,
      hooks: { onError },
    });

    expect(core.getConfig()).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.any(RangeError), 'register');
  });

  it('refreshes dynamic environment fields and redacts location secrets', () => {
    const core = new TraceCore();
    const reporter = { report: vi.fn() };
    const originalWidth = window.innerWidth;

    try {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 800,
      });
      history.replaceState({}, '', '/env-start?token=one#secret');
      core.setReporter(reporter);
      core.register({ projectId: 'test', reportUrl: '/api/track' });

      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 1024,
      });
      history.pushState({}, '', '/env-next?token=two#private');
      core.trackEvent('dynamic_env');

      expect(reporter.report).toHaveBeenCalledWith(
        expect.objectContaining({
          referrer: `${window.location.origin}/env-start`,
          url: `${window.location.origin}/env-next`,
          properties: expect.objectContaining({ viewportWidth: 1024 }),
        }),
        'normal',
      );
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalWidth,
      });
      core.destroy();
    }
  });

  it('uses the default batch reporter when no reporter is injected', async () => {
    const originalFetch = window.fetch;
    const fetchMock = vi.fn<typeof window.fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    window.fetch = fetchMock;
    const core = new TraceCore();

    try {
      core.register({
        projectId: 'test',
        reportUrl: '/api/track',
        maxBufferSize: 1,
      });
      core.trackEvent('default_reporter', { value: 1 });

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
      const [url, init] = fetchMock.mock.calls[0];
      const payload = JSON.parse(String(init?.body));

      expect(url).toBe(`${window.location.origin}/api/track/batch`);
      expect(payload.events).toEqual([
        expect.objectContaining({
          appId: 'test',
          eventName: 'default_reporter',
        }),
      ]);
    } finally {
      core.destroy();
      window.fetch = originalFetch;
    }
  });

  it('installs and removes automatic error tracking', () => {
    const core = new TraceCore();
    const reporter = { report: vi.fn() };

    core.setReporter(reporter);
    core.register({
      projectId: 'test',
      reportUrl: '/api/track',
      enableAutoError: true,
    });
    window.dispatchEvent(
      new ErrorEvent('error', {
        error: new Error('automatic boom'),
        message: 'automatic boom',
      }),
    );

    expect(reporter.report).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'js-error',
        eventType: 'error',
      }),
      'urgent',
    );

    reporter.report.mockClear();
    core.destroy();
    window.dispatchEvent(new ErrorEvent('error', { message: 'after destroy' }));
    expect(reporter.report).not.toHaveBeenCalled();
  });

  it('contains invalid input and reports it through onError', () => {
    const onError = vi.fn();
    const core = new TraceCore();

    core.register({
      projectId: 'test',
      reportUrl: '/api/track',
      hooks: { onError },
    });

    expect(() => core.trackEvent('', [])).not.toThrow();
    expect(onError).toHaveBeenCalledWith(expect.any(TypeError), 'trackEvent');
  });

  it('contains exceptions from config accessors during register', () => {
    const onError = vi.fn();
    const core = new TraceCore();
    core.register({ projectId: 'test', reportUrl: '/api/track', hooks: { onError } });
    const invalidConfig = { projectId: 'next', reportUrl: '/next' };
    Object.defineProperty(invalidConfig, 'hooks', {
      get() {
        throw new Error('getter boom');
      },
    });

    expect(() => core.register(invalidConfig)).not.toThrow();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'register');
  });

  it('isolates stored configuration from hooks and later hook replacement', () => {
    const core = new TraceCore();
    const reporter = { report: vi.fn() };
    const hooks: TraceLifecycleHooks = {
      onReady(config) {
        const mutableConfig = config as ResolvedTraceConfig;
        mutableConfig.projectId = 'mutated';
        mutableConfig.sampleRate = 0;
      },
    };

    core.setReporter(reporter);
    core.register({ projectId: 'original', reportUrl: '/api/track', hooks });
    hooks.onBeforeTrack = () => false;
    core.trackEvent('still-reported');

    expect(core.getConfig()).toEqual(expect.objectContaining({ projectId: 'original', sampleRate: 1 }));
    expect(reporter.report).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'still-reported' }), 'normal');
  });

  it('contains reporter and lifecycle errors', () => {
    const core = new TraceCore();
    const onTrack = vi.fn(() => {
      throw new Error('hook failed');
    });
    const onError = vi.fn(() => {
      throw new Error('error hook failed');
    });

    core.register({
      projectId: 'test',
      reportUrl: '/api/track',
      hooks: { onTrack, onError },
    });
    core.setReporter({
      report() {
        throw new Error('report failed');
      },
    });

    expect(() => core.trackEvent('safe_event')).not.toThrow();
    expect(onTrack).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalled();
  });

  it('overwrites config on repeated register', () => {
    const core = new TraceCore();

    core.register({ projectId: 'first', reportUrl: '/first' });
    core.register({ projectId: 'second', reportUrl: '/second', sampleRate: 0.5 });

    expect(core.getConfig()).toEqual(
      expect.objectContaining({
        projectId: 'second',
        reportUrl: '/second',
        sampleRate: 0.5,
      }),
    );
  });
});
