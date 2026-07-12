import { describe, it, expect, vi } from 'vitest';
import { traceCore } from '../src';

describe('TraceCore skeleton', () => {
  it('should register without error', () => {
    expect(() => {
      traceCore.register({
        projectId: 'test',
        reportUrl: 'http://localhost/api',
        sampleRate: 0.5,
      });
    }).not.toThrow();
  });

  it('should call trackEvent and log', () => {
    const spy = vi.spyOn(console, 'log');
    traceCore.trackEvent('test_event', { foo: 'bar' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
