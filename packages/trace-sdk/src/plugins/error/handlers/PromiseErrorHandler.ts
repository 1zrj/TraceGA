import type { ITraceCore } from '../../../types';
import { EventType } from '../../../core/types';
import type { ErrorHandler, ErrorPayloadBase } from '../types';
import { ErrorEventName } from '../types';

export interface PromiseErrorPayload extends ErrorPayloadBase {
  reasonType: string;
  reason?: string;
}

export class PromiseErrorHandler implements ErrorHandler {
  private core: ITraceCore | null = null;

  private readonly handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    if (!this.core) {
      return;
    }

    this.core.trackEvent(EventType.Error, ErrorEventName.PromiseError, this.normalizeRejection(event.reason));
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
        message: reason.message || 'Unhandled promise rejection',
        occurredAt: Date.now(),
        reasonType: 'Error',
        errorName: reason.name,
        stack: reason.stack,
      };
    }

    const stringifiedReason = this.stringifyReason(reason);

    return {
      message: stringifiedReason || 'Unhandled promise rejection',
      occurredAt: Date.now(),
      reasonType: this.getReasonType(reason),
      reason: stringifiedReason,
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
