import type { ErrorPluginConfig, ITraceCore } from '../../types';
import { sanitizeEnvironmentUrl } from '../../core/env';

export interface ErrorHandler {
  install(core: ITraceCore): void;
  uninstall(): void;
}

export interface ErrorPluginOptions extends ErrorPluginConfig {
  onError?: (error: unknown, context: string) => void;
  reportUrl?: string;
}

export enum ErrorEventName {
  JsError = 'js-error',
  PromiseError = 'promise-error',
  ResourceError = 'resource-error',
  HttpError = 'http-error',
}

export interface ErrorPayloadBase {
  [key: string]: unknown;
  type: string;
  message: string;
  occurredAt: number;
  errorName?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
}

export function sanitizeErrorUrl(rawUrl: string | null | undefined): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  const sanitized = sanitizeEnvironmentUrl(rawUrl);
  if (!sanitized) {
    return undefined;
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(rawUrl) || rawUrl.startsWith('//')) {
    return sanitized;
  }

  const parsed = new URL(sanitized);
  return rawUrl.startsWith('/') ? parsed.pathname : parsed.pathname.replace(/^\//, '');
}

export function getBrowserContext(): Pick<ErrorPayloadBase, 'url' | 'userAgent'> {
  return {
    url: typeof window !== 'undefined' ? sanitizeEnvironmentUrl(window.location.href) : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };
}
