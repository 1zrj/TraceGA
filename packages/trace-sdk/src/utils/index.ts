export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function copyOwnProperties(source: object, target: object, cache: WeakMap<object, unknown>): void {
  Reflect.ownKeys(source).forEach(key => {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!descriptor) {
      return;
    }

    const clonedDescriptor = 'value' in descriptor ? { ...descriptor, value: deepClone(descriptor.value, cache) } : descriptor;

    // defineProperty deliberately preserves an own "__proto__" data property
    // instead of invoking Object.prototype.__proto__'s setter.
    Object.defineProperty(target, key, clonedDescriptor);
  });
}

export function deepClone<T>(value: T, cache = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (cache.has(value)) {
    return cache.get(value) as T;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags) as T;
  }

  if (value instanceof URL) {
    return new URL(value.href) as T;
  }

  if (value instanceof ArrayBuffer) {
    return value.slice(0) as T;
  }

  if (ArrayBuffer.isView(value)) {
    const copiedBuffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);

    if (value instanceof DataView) {
      return new DataView(copiedBuffer) as T;
    }

    const TypedArrayConstructor = value.constructor as new (buffer: ArrayBufferLike) => object;
    return new TypedArrayConstructor(copiedBuffer) as T;
  }

  if (value instanceof Map) {
    const cloned = new Map<unknown, unknown>();
    cache.set(value, cloned);
    value.forEach((item, key) => {
      cloned.set(deepClone(key, cache), deepClone(item, cache));
    });
    return cloned as T;
  }

  if (value instanceof Set) {
    const cloned = new Set<unknown>();
    cache.set(value, cloned);
    value.forEach(item => {
      cloned.add(deepClone(item, cache));
    });
    return cloned as T;
  }

  if (Array.isArray(value)) {
    const cloned: unknown[] = new Array(value.length);
    cache.set(value, cloned);
    copyOwnProperties(value, cloned, cache);
    return cloned as T;
  }

  const cloned = Object.create(Object.getPrototypeOf(value)) as object;
  cache.set(value, cloned);
  copyOwnProperties(value, cloned, cache);
  return cloned as T;
}

export function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  try {
    const result = JSON.stringify(value, (_key, currentValue: unknown) => {
      if (typeof currentValue === 'bigint') {
        return currentValue.toString();
      }
      if (typeof currentValue === 'function') {
        return '[Function]';
      }
      if (typeof currentValue === 'symbol') {
        return currentValue.toString();
      }
      if (typeof currentValue === 'object' && currentValue !== null) {
        if (seen.has(currentValue)) {
          return '[Circular]';
        }
        seen.add(currentValue);
      }
      return currentValue;
    });

    return result ?? '';
  } catch {
    return '';
  }
}

export function generateUUID(): string {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export interface ParsedUserAgent {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
}

export function parseUserAgent(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): ParsedUserAgent {
  const browserRules: Array<[string, RegExp]> = [
    ['Edge', /(?:Edg|EdgiOS|EdgA)\/([\d.]+)/],
    ['Opera', /(?:OPR|Opera)\/([\d.]+)/],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ];
  const osRules: Array<[string, RegExp]> = [
    ['iOS', /(?:iPhone|iPad|iPod).*OS ([\d_]+)/],
    ['Android', /Android ([\d.]+)/],
    ['Windows', /Windows NT ([\d.]+)/],
    ['macOS', /Mac OS X ([\d_]+)/],
    ['Linux', /Linux/],
  ];
  const browserRule = browserRules.find(([, rule]) => rule.test(userAgent));
  const osRule = osRules.find(([, rule]) => rule.test(userAgent));

  return {
    browser: browserRule?.[0] ?? 'Unknown',
    browserVersion: browserRule?.[1].exec(userAgent)?.[1] ?? '',
    os: osRule?.[0] ?? 'Unknown',
    osVersion: osRule?.[1].exec(userAgent)?.[1]?.replace(/_/g, '.') ?? '',
  };
}

type Procedure = (...args: any[]) => void;

export type ControlledFunction<T extends Procedure> = (this: ThisParameterType<T>, ...args: Parameters<T>) => void;

export function throttle<T extends Procedure>(fn: T, wait: number): ControlledFunction<T> {
  const delay = Math.max(0, wait);
  let lastInvokeTime = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latestArgs: Parameters<T> | null = null;
  let latestThis: ThisParameterType<T>;

  const invoke = (): void => {
    timer = null;
    lastInvokeTime = Date.now();

    if (latestArgs) {
      const args = latestArgs;
      latestArgs = null;
      fn.apply(latestThis, args);
    }
  };

  return function throttled(this: ThisParameterType<T>, ...args: Parameters<T>): void {
    latestArgs = args;
    latestThis = this;
    const remaining = delay - (Date.now() - lastInvokeTime);

    if (remaining <= 0 || remaining > delay) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      invoke();
      return;
    }

    if (!timer) {
      timer = setTimeout(invoke, remaining);
    }
  };
}

export function debounce<T extends Procedure>(fn: T, wait: number): ControlledFunction<T> {
  const delay = Math.max(0, wait);
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function debounced(this: ThisParameterType<T>, ...args: Parameters<T>): void {
    if (timer) {
      clearTimeout(timer);
    }

    const context = this;
    timer = setTimeout(() => {
      timer = null;
      fn.apply(context, args);
    }, delay);
  };
}
