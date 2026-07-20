import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addCommonParams, getCommonParams, register, removeCommonParams, traceCore, trackEvent } from '../src';

describe('public SDK API', () => {
  beforeEach(() => {
    traceCore.setReporter(null);
    removeCommonParams(['api_test']);
  });

  it('exports bound helpers backed by the shared core', () => {
    const reporter = { report: vi.fn() };
    traceCore.setReporter(reporter);

    register({ projectId: 'api', reportUrl: '/api/track' });
    addCommonParams({ api_test: true });
    trackEvent('api_event', { source: 'public-api' }, 'high');

    expect(getCommonParams()).toEqual(expect.objectContaining({ api_test: true }));
    expect(reporter.report).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'custom',
        eventName: 'api_event',
        appId: 'api',
        properties: expect.objectContaining({
          api_test: true,
          source: 'public-api',
        }),
      }),
      'high',
    );
  });
});
