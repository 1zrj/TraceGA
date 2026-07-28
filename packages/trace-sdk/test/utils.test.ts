import { describe, expect, it, vi } from 'vitest';
import { debounce, deepClone, generateUUID, isPlainObject, parseUserAgent, safeJsonStringify, throttle } from '../src';

describe('SDK utilities', () => {
  it('deep clones nested data and circular references', () => {
    const source: { nested: { value: number }; self?: unknown } = {
      nested: { value: 1 },
    };
    source.self = source;

    const cloned = deepClone(source);
    cloned.nested.value = 2;

    expect(source.nested.value).toBe(1);
    expect(cloned.self).toBe(cloned);
  });

  it('safely stringifies circular values', () => {
    const value: { self?: unknown } = {};
    value.self = value;
    expect(safeJsonStringify(value)).toContain('[Circular]');
  });

  it('generates a UUID and detects plain objects', () => {
    expect(generateUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(isPlainObject({ value: 1 })).toBe(true);
    expect(isPlainObject([])).toBe(false);
  });

  it('parses common browser user agents', () => {
    const result = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36');
    expect(result).toEqual({
      browser: 'Chrome',
      browserVersion: '124.0.0.0',
      os: 'Windows',
      osVersion: '10.0',
    });
  });

  it('throttles and debounces calls', () => {
    vi.useFakeTimers();
    const throttledTarget = vi.fn();
    const debouncedTarget = vi.fn();
    const throttled = throttle(throttledTarget, 100);
    const debounced = debounce(debouncedTarget, 100);

    throttled(1);
    throttled(2);
    debounced(1);
    debounced(2);
    vi.advanceTimersByTime(100);

    expect(throttledTarget).toHaveBeenCalledTimes(2);
    expect(throttledTarget).toHaveBeenLastCalledWith(2);
    expect(debouncedTarget).toHaveBeenCalledTimes(1);
    expect(debouncedTarget).toHaveBeenCalledWith(2);
    vi.useRealTimers();
  });
});
