import type { ITraceCore } from '../../../types';
import { EventType } from '../../../core/types';
import type { ErrorHandler, ErrorPayloadBase } from '../types';
import { ErrorEventName } from '../types';

export interface JsErrorPayload extends ErrorPayloadBase {
  filename?: string;
  lineno?: number;
  colno?: number;
}

export class JsErrorHandler implements ErrorHandler {
  private core: ITraceCore | null = null;

  private readonly handleError = (event: ErrorEvent): void => {
    if (!this.core || !this.isJsError(event)) {
      return;
    }

    this.core.trackEvent(EventType.Error, ErrorEventName.JsError, this.normalizeError(event));
  };

  install(core: ITraceCore): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.core = core;
    window.addEventListener('error', this.handleError, true);
  }

  uninstall(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('error', this.handleError, true);
    this.core = null;
  }

  private isJsError(event: ErrorEvent): boolean {
    return event instanceof ErrorEvent && Boolean(event.message || event.error);
  }

  private normalizeError(event: ErrorEvent): JsErrorPayload {
    const error = event.error instanceof Error ? event.error : null;

    return {
      message: event.message || error?.message || 'Unknown JavaScript error',
      occurredAt: Date.now(),
      filename: event.filename || undefined,
      lineno: event.lineno || undefined,
      colno: event.colno || undefined,
      errorName: error?.name,
      stack: error?.stack,
    };
  }
}
