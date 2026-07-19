import type { ITraceCore } from '../../../types';
import type { ErrorHandler, ErrorPayloadBase } from '../types';
import { getBrowserContext } from '../types';

export interface PromiseErrorPayload extends ErrorPayloadBase {
  type: 'promise-error';
  reasonType: string;
  reason?: string;
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
        stack: reason.stack,
        ...getBrowserContext(),
      };
    }

    const stringifiedReason = this.stringifyReason(reason);

    return {
      type: 'promise-error',
      message: stringifiedReason || 'Unhandled promise rejection',
      occurredAt: Date.now(),
      reasonType: this.getReasonType(reason),
      reason: stringifiedReason,
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

  private stringifyReason(reason: unknown): string | undefined {
    if (reason === undefined) {
      return undefined;
    }

    if (typeof reason === 'string') {
      return reason;
    }

    try {
      return JSON.stringify(reason);
    } catch {
      return String(reason);
    }
  }
}
