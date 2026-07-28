import type { ITraceCore } from '../../../types';
import type { ErrorHandler, ErrorPayloadBase } from '../types';
import { getBrowserContext } from '../types';

export interface PromiseErrorPayload extends ErrorPayloadBase {
  type: 'promise-error';
  reasonType: string;
  reason?: string;
}

const SENSITIVE_KEYS = ['password', 'token', 'authorization', 'cookie', 'email', 'secret', 'key', 'credential', 'passwd', 'ssn', 'credit'];
const MAX_SANITIZE_DEPTH = 3;
const MAX_FIELDS = 20;
const MAX_ARRAY_LENGTH = 10;
const MAX_STRING_LENGTH = 200;

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some(k => lower.includes(k));
}

function sanitizeReasonValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_SANITIZE_DEPTH) {
    return '[MaxDepth]';
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) + '…' : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.slice(0, 500),
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map(v => sanitizeReasonValue(v, depth + 1));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    const keys = Object.keys(value as object).slice(0, MAX_FIELDS);
    for (const key of keys) {
      if (isSensitiveKey(key)) {
        result[key] = '[REDACTED]';
      } else {
        try {
          result[key] = sanitizeReasonValue((value as Record<string, unknown>)[key], depth + 1);
        } catch {
          result[key] = '[Unserializable]';
        }
      }
    }
    return result;
  }

  if (typeof value === 'function') {
    return '[Function]';
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  // Fallback
  try {
    return String(value).slice(0, MAX_STRING_LENGTH);
  } catch {
    return '[Unserializable]';
  }
}

export class PromiseErrorHandler implements ErrorHandler {
  private core: ITraceCore | null = null;

  private readonly handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    if (!this.core) {
      return;
    }

    this.core.trackEvent('promise-error', this.normalizeRejection(event.reason), 'urgent', 'error');
  };

  install(core: ITraceCore): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.core = core;
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  uninstall(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    this.core = null;
  }

  private normalizeRejection(reason: unknown): PromiseErrorPayload {
    if (reason instanceof Error) {
      return {
        type: 'promise-error',
        message: reason.message || 'Unhandled promise rejection',
        occurredAt: Date.now(),
        reasonType: 'Error',
        errorName: reason.name,
        stack: reason.stack?.slice(0, 1000),
        ...getBrowserContext(),
      };
    }

    const reasonType = this.getReasonType(reason);
    const sanitized = this.sanitizeReason(reason);

    return {
      type: 'promise-error',
      message: `Unhandled ${reasonType} rejection`,
      occurredAt: Date.now(),
      reasonType,
      reason: sanitized,
      ...getBrowserContext(),
    };
  }

  private getReasonType(reason: unknown): string {
    if (reason === null) {
      return 'null';
    }
    if (Array.isArray(reason)) {
      return 'array';
    }
    return typeof reason;
  }

  private sanitizeReason(reason: unknown): string | undefined {
    if (reason === undefined) {
      return undefined;
    }

    if (typeof reason === 'string') {
      return reason.length > MAX_STRING_LENGTH ? reason.slice(0, MAX_STRING_LENGTH) + '…' : reason;
    }

    try {
      const sanitized = sanitizeReasonValue(reason);
      return JSON.stringify(sanitized);
    } catch {
      // Last resort: coerce to string with length limit
      try {
        const s = String(reason);
        return s.length > MAX_STRING_LENGTH ? s.slice(0, MAX_STRING_LENGTH) + '…' : s;
      } catch {
        return '[Unserializable]';
      }
    }
  }
}
