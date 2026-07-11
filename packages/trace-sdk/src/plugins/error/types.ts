import type { ITraceCore } from '../../types';

export interface ErrorHandler {
  install(core: ITraceCore): void;
  uninstall(): void;
}

export interface ErrorPayloadBase {
  type: string;
  message: string;
  errorName?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
}

export function getBrowserContext(): Pick<ErrorPayloadBase, 'url' | 'userAgent'> {
  return {
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };
}
