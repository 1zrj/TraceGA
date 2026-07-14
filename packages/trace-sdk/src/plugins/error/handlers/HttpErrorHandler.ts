import type { ITraceCore } from '../../../types';
import { EventType } from '../../../core/types';
import type { ErrorHandler, ErrorPayloadBase } from '../types';
import { ErrorEventName } from '../types';

type XhrMeta = {
  method: string;
  url: string;
};

export interface HttpErrorPayload extends ErrorPayloadBase {
  requestType: 'fetch' | 'xhr';
  method?: string;
  requestUrl?: string;
  status?: number;
  statusText?: string;
  duration?: number;
}

export class HttpErrorHandler implements ErrorHandler {
  private core: ITraceCore | null = null;
  private originalFetch: typeof window.fetch | null = null;
  private originalXhrOpen: XMLHttpRequest['open'] | null = null;
  private originalXhrSend: XMLHttpRequest['send'] | null = null;
  private readonly xhrMeta = new WeakMap<XMLHttpRequest, XhrMeta>();
  private readonly reportUrl?: string;

  constructor(reportUrl?: string) {
    this.reportUrl = reportUrl;
  }

  install(core: ITraceCore): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.core = core;
    this.patchFetch();
    this.patchXhr();
  }

  uninstall(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.originalFetch) {
      window.fetch = this.originalFetch;
      this.originalFetch = null;
    }

    if (this.originalXhrOpen) {
      XMLHttpRequest.prototype.open = this.originalXhrOpen;
      this.originalXhrOpen = null;
    }

    if (this.originalXhrSend) {
      XMLHttpRequest.prototype.send = this.originalXhrSend;
      this.originalXhrSend = null;
    }

    this.core = null;
  }

  private patchFetch(): void {
    if (this.originalFetch || typeof window.fetch !== 'function') {
      return;
    }

    this.originalFetch = window.fetch;
    const handler = this;

    window.fetch = async function patchedFetch(input, init) {
      const startedAt = Date.now();
      const method = handler.getFetchMethod(input, init);
      const requestUrl = handler.getFetchUrl(input);

      if (handler.isReportUrl(requestUrl)) {
        return handler.originalFetch!.call(this, input, init);
      }

      try {
        const response = await handler.originalFetch!.call(this, input, init);

        if (!response.ok) {
          const occurredAt = Date.now();

          handler.reportHttpError({
            requestType: 'fetch',
            message: `HTTP request failed: ${response.status}`,
            occurredAt,
            method,
            requestUrl,
            status: response.status,
            statusText: response.statusText,
            duration: occurredAt - startedAt,
          });
        }

        return response;
      } catch (error) {
        const occurredAt = Date.now();

        handler.reportHttpError({
          requestType: 'fetch',
          message: error instanceof Error ? error.message : 'Fetch request failed',
          occurredAt,
          method,
          requestUrl,
          errorName: error instanceof Error ? error.name : undefined,
          stack: error instanceof Error ? error.stack : undefined,
          duration: occurredAt - startedAt,
        });
        throw error;
      }
    };
  }

  private patchXhr(): void {
    if (this.originalXhrOpen || typeof XMLHttpRequest === 'undefined') {
      return;
    }

    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    const handler = this;

    XMLHttpRequest.prototype.open = function patchedOpen(method: string, url: string | URL) {
      handler.xhrMeta.set(this, {
        method,
        url: String(url),
      });

      return handler.originalXhrOpen!.apply(this, arguments as any);
    } as XMLHttpRequest['open'];

    XMLHttpRequest.prototype.send = function patchedSend() {
      const xhr = this;
      const startedAt = Date.now();

      const handleLoadEnd = (): void => {
        const meta = handler.xhrMeta.get(xhr);

        if (handler.isReportUrl(meta?.url)) {
          return;
        }

        if (xhr.status >= 400) {
          const occurredAt = Date.now();

          handler.reportHttpError({
            requestType: 'xhr',
            message: `HTTP request failed: ${xhr.status}`,
            occurredAt,
            method: meta?.method,
            requestUrl: meta?.url,
            status: xhr.status,
            statusText: xhr.statusText,
            duration: occurredAt - startedAt,
          });
        }
      };

      const handleNetworkError = (): void => {
        const meta = handler.xhrMeta.get(xhr);

        if (handler.isReportUrl(meta?.url)) {
          return;
        }

        const occurredAt = Date.now();

        handler.reportHttpError({
          requestType: 'xhr',
          message: 'XMLHttpRequest failed',
          occurredAt,
          method: meta?.method,
          requestUrl: meta?.url,
          status: xhr.status || undefined,
          statusText: xhr.statusText || undefined,
          duration: occurredAt - startedAt,
        });
      };

      xhr.addEventListener('loadend', handleLoadEnd, { once: true });
      xhr.addEventListener('error', handleNetworkError, { once: true });
      xhr.addEventListener('timeout', handleNetworkError, { once: true });
      xhr.addEventListener('abort', handleNetworkError, { once: true });

      return handler.originalXhrSend!.apply(this, arguments as any);
    } as XMLHttpRequest['send'];
  }

  private reportHttpError(payload: HttpErrorPayload): void {
    this.core?.trackEvent(EventType.Error, ErrorEventName.HttpError, payload);
  }

  private getFetchMethod(input: RequestInfo | URL, init?: RequestInit): string | undefined {
    if (init?.method) {
      return init.method;
    }

    if (typeof Request !== 'undefined' && input instanceof Request) {
      return input.method;
    }

    return 'GET';
  }

  private getFetchUrl(input: RequestInfo | URL): string | undefined {
    if (typeof input === 'string') {
      return input;
    }

    if (input instanceof URL) {
      return input.href;
    }

    if (typeof Request !== 'undefined' && input instanceof Request) {
      return input.url;
    }

    return undefined;
  }

  private isReportUrl(url?: string): boolean {
    return Boolean(url && this.reportUrl && url === this.reportUrl);
  }
}
