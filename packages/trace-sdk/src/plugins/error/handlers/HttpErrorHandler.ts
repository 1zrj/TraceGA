import type { ITraceCore } from '../../../types';
import type { ErrorHandler, ErrorPayloadBase } from '../types';
import { getBrowserContext, sanitizeErrorUrl } from '../types';

type XhrMeta = {
  method: string;
  url: string;
};

export interface HttpErrorPayload extends ErrorPayloadBase {
  type: 'http-error';
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
  private patchedFetch: typeof window.fetch | null = null;
  private originalXhrOpen: XMLHttpRequest['open'] | null = null;
  private originalXhrSend: XMLHttpRequest['send'] | null = null;
  private patchedXhrOpen: XMLHttpRequest['open'] | null = null;
  private patchedXhrSend: XMLHttpRequest['send'] | null = null;
  private readonly xhrMeta = new WeakMap<XMLHttpRequest, XhrMeta>();
  private readonly reportUrl?: string;

  constructor(reportUrl?: string) {
    this.reportUrl = sanitizeErrorUrl(reportUrl);
  }

  install(core: ITraceCore): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.core = core;
    try {
      this.patchFetch();
      this.patchXhr();
    } catch (error) {
      this.restorePatches();
      this.core = null;
      throw error;
    }
  }

  uninstall(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.restorePatches();
    this.core = null;
  }

  private patchFetch(): void {
    if (this.originalFetch || typeof window.fetch !== 'function') {
      return;
    }

    this.originalFetch = window.fetch;
    const handler = this;

    const patchedFetch: typeof window.fetch = async function patchedFetch(this: Window, input, init) {
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
            type: 'http-error',
            requestType: 'fetch',
            message: `HTTP request failed: ${response.status}`,
            occurredAt,
            method,
            requestUrl,
            status: response.status,
            statusText: response.statusText,
            duration: occurredAt - startedAt,
            ...getBrowserContext(),
          });
        }

        return response;
      } catch (error) {
        const occurredAt = Date.now();

        handler.reportHttpError({
          type: 'http-error',
          requestType: 'fetch',
          message: error instanceof Error ? error.message : 'Fetch request failed',
          occurredAt,
          method,
          requestUrl,
          errorName: error instanceof Error ? error.name : undefined,
          stack: error instanceof Error ? error.stack : undefined,
          duration: occurredAt - startedAt,
          ...getBrowserContext(),
        });
        throw error;
      }
    };

    this.patchedFetch = patchedFetch;
    window.fetch = patchedFetch;
  }

  private patchXhr(): void {
    if (this.originalXhrOpen || typeof XMLHttpRequest === 'undefined') {
      return;
    }

    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    const handler = this;

    const patchedOpen = function patchedOpen(this: XMLHttpRequest, method: string, url: string | URL) {
      handler.xhrMeta.set(this, {
        method,
        url: sanitizeErrorUrl(String(url)) ?? String(url),
      });

      return handler.originalXhrOpen!.apply(this, arguments as any);
    } as XMLHttpRequest['open'];

    const patchedSend = function patchedSend(this: XMLHttpRequest) {
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
            type: 'http-error',
            requestType: 'xhr',
            message: `HTTP request failed: ${xhr.status}`,
            occurredAt,
            method: meta?.method,
            requestUrl: meta?.url,
            status: xhr.status,
            statusText: xhr.statusText,
            duration: occurredAt - startedAt,
            ...getBrowserContext(),
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
          type: 'http-error',
          requestType: 'xhr',
          message: 'XMLHttpRequest failed',
          occurredAt,
          method: meta?.method,
          requestUrl: meta?.url,
          status: xhr.status || undefined,
          statusText: xhr.statusText || undefined,
          duration: occurredAt - startedAt,
          ...getBrowserContext(),
        });
      };

      xhr.addEventListener('loadend', handleLoadEnd, { once: true });
      xhr.addEventListener('error', handleNetworkError, { once: true });
      xhr.addEventListener('timeout', handleNetworkError, { once: true });
      xhr.addEventListener('abort', handleNetworkError, { once: true });

      return handler.originalXhrSend!.apply(this, arguments as any);
    } as XMLHttpRequest['send'];

    this.patchedXhrOpen = patchedOpen;
    this.patchedXhrSend = patchedSend;
    XMLHttpRequest.prototype.open = patchedOpen;
    XMLHttpRequest.prototype.send = patchedSend;
  }

  private restorePatches(): void {
    if (this.originalFetch && this.patchedFetch && window.fetch === this.patchedFetch) {
      window.fetch = this.originalFetch;
    }

    if (typeof XMLHttpRequest !== 'undefined' && this.originalXhrOpen && this.patchedXhrOpen && XMLHttpRequest.prototype.open === this.patchedXhrOpen) {
      XMLHttpRequest.prototype.open = this.originalXhrOpen;
    }

    if (typeof XMLHttpRequest !== 'undefined' && this.originalXhrSend && this.patchedXhrSend && XMLHttpRequest.prototype.send === this.patchedXhrSend) {
      XMLHttpRequest.prototype.send = this.originalXhrSend;
    }

    this.originalFetch = null;
    this.patchedFetch = null;
    this.originalXhrOpen = null;
    this.originalXhrSend = null;
    this.patchedXhrOpen = null;
    this.patchedXhrSend = null;
  }

  private reportHttpError(payload: HttpErrorPayload): void {
    this.core?.trackEvent('http-error', payload, 'urgent', 'error');
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
      return sanitizeErrorUrl(input);
    }

    if (input instanceof URL) {
      return sanitizeErrorUrl(input.href);
    }

    if (typeof Request !== 'undefined' && input instanceof Request) {
      return sanitizeErrorUrl(input.url);
    }

    return undefined;
  }

  private isReportUrl(url?: string): boolean {
    return Boolean(url && this.reportUrl && url === this.reportUrl);
  }
}
