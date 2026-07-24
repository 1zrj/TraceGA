import type { ITraceCore } from '../../../types';
import type { ErrorHandler, ErrorPayloadBase } from '../types';
import { getBrowserContext } from '../types';
import { sanitizeErrorUrl } from '../types';

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


const FETCH_PATCH_KEY = Symbol.for('__tracega_http_fetch_patched__');
const XHR_PATCH_KEY = Symbol.for('__tracega_http_xhr_patched__');

let fetchSubscriberCount = 0;
let nativeFetch: typeof window.fetch | null = null;
let patchedFetchRef: typeof window.fetch | null = null;

let xhrSubscriberCount = 0;
let nativeXhrOpen: XMLHttpRequest['open'] | null = null;
let nativeXhrSend: XMLHttpRequest['send'] | null = null;
let patchedXhrOpenRef: XMLHttpRequest['open'] | null = null;
let patchedXhrSendRef: XMLHttpRequest['send'] | null = null;

const sharedXhrMeta = new WeakMap<XMLHttpRequest, XhrMeta>();

function isReportUrlStatic(url: string | undefined, reportUrl: string | undefined): boolean {
  if (!url || !reportUrl) {
    return false;
  }

  if (url === reportUrl) {
    return true;
  }

  try {
    const base = typeof location !== 'undefined' ? location.origin : 'http://localhost';
    const candidate = new URL(url, base);
    const report = new URL(reportUrl, base);

    return candidate.origin === report.origin && (candidate.pathname === report.pathname || candidate.pathname.startsWith(report.pathname + '/'));
  } catch {
    return false;
  }
}

export class HttpErrorHandler implements ErrorHandler {
  private core: ITraceCore | null = null;
  private readonly reportUrl?: string;
  private installed = false;

  constructor(reportUrl?: string) {
    this.reportUrl = sanitizeErrorUrl(reportUrl);
  }

  install(core: ITraceCore): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.installed) {
      return;
    }

    this.core = core;

    try {
      this.installFetchPatch();
      this.installXhrPatch();
      // Register this instance's error reporter with its reportUrl for filtering
      errorReporters.set(this.boundReporter, this.reportUrl);
      this.installed = true;
    } catch (error) {
      this.uninstall();
      throw error;
    }
  }

  uninstall(): void {
    if (typeof window === 'undefined') {
      return;
    }

    errorReporters.delete(this.boundReporter);
    this.uninstallFetchPatch();
    this.uninstallXhrPatch();
    this.core = null;
    this.installed = false;
  }

  private readonly boundReporter = (payload: HttpErrorPayload): void => {
    this.reportHttpError(payload);
  };

  private installFetchPatch(): void {
    if (typeof window.fetch !== 'function') {
      return;
    }

    if (!nativeFetch) {
      nativeFetch = window.fetch.bind(window);
    }

    fetchSubscriberCount++;

    if ((window as any)[FETCH_PATCH_KEY]) {
      return;
    }

    (window as any)[FETCH_PATCH_KEY] = true;

    const capturedFetch = nativeFetch!;

    const patched: typeof window.fetch = async function (this: Window, input, init) {
      const startedAt = Date.now();
      const requestUrl = getFetchUrlStatic(input);

      if (fetchSubscriberCount > 0) {
        for (const reportUrl of errorReporters.values()) {
          if (isReportUrlStatic(requestUrl, reportUrl)) {
            return capturedFetch.call(this, input, init);
          }
        }
      }

      try {
        const response = await capturedFetch.call(this, input, init);

        if (!response.ok && fetchSubscriberCount > 0) {
          const occurredAt = Date.now();
          const method = getFetchMethodStatic(input, init);
          queueHttpError({
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
        if (fetchSubscriberCount > 0) {
          const occurredAt = Date.now();
          const method = getFetchMethodStatic(input, init);
          queueHttpError({
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
        }
        throw error;
      }
    };

    patchedFetchRef = patched;
    window.fetch = patched;
  }

  private uninstallFetchPatch(): void {
    if (fetchSubscriberCount <= 0) {
      return;
    }

    fetchSubscriberCount--;

    if (fetchSubscriberCount === 0) {
      // Last subscriber — restore native and clear state
      if (patchedFetchRef && window.fetch === patchedFetchRef && nativeFetch) {
        window.fetch = nativeFetch;
      }
      delete (window as any)[FETCH_PATCH_KEY];
      nativeFetch = null;
      patchedFetchRef = null;
    }
  }


  private installXhrPatch(): void {
    if (typeof XMLHttpRequest === 'undefined') {
      return;
    }

    // First subscriber captures native prototypes
    if (!nativeXhrOpen) {
      nativeXhrOpen = XMLHttpRequest.prototype.open;
    }
    if (!nativeXhrSend) {
      nativeXhrSend = XMLHttpRequest.prototype.send;
    }

    xhrSubscriberCount++;

    if ((window as any)[XHR_PATCH_KEY]) {
      return;
    }

    (window as any)[XHR_PATCH_KEY] = true;

    const capturedOpen = nativeXhrOpen!;
    const capturedSend = nativeXhrSend!;

    const patchedOpen: XMLHttpRequest['open'] = function patchedOpen(this: XMLHttpRequest, method: string, url: string | URL) {
      sharedXhrMeta.set(this, {
        method,
        url: sanitizeErrorUrl(String(url)) ?? String(url),
      });
      return capturedOpen.apply(this, arguments as any);
    };

    const patchedSend: XMLHttpRequest['send'] = function patchedSend(this: XMLHttpRequest) {
      const xhr = this;
      const startedAt = Date.now();

      const handleLoadEnd = (): void => {
        if (xhrSubscriberCount === 0) {
          return;
        }
        const meta = sharedXhrMeta.get(xhr);
        if (!meta || xhr.status < 400) {
          return;
        }

        const occurredAt = Date.now();
        queueHttpError({
          type: 'http-error',
          requestType: 'xhr',
          message: `HTTP request failed: ${xhr.status}`,
          occurredAt,
          method: meta.method,
          requestUrl: meta.url,
          status: xhr.status,
          statusText: xhr.statusText,
          duration: occurredAt - startedAt,
          ...getBrowserContext(),
        });
      };

      const handleNetworkError = (): void => {
        if (xhrSubscriberCount === 0) {
          return;
        }
        const meta = sharedXhrMeta.get(xhr);
        if (!meta) {
          return;
        }

        const occurredAt = Date.now();
        queueHttpError({
          type: 'http-error',
          requestType: 'xhr',
          message: 'XMLHttpRequest failed',
          occurredAt,
          method: meta.method,
          requestUrl: meta.url,
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

      return capturedSend.apply(this, arguments as any);
    };

    patchedXhrOpenRef = patchedOpen;
    patchedXhrSendRef = patchedSend;
    XMLHttpRequest.prototype.open = patchedOpen;
    XMLHttpRequest.prototype.send = patchedSend;
  }

  private uninstallXhrPatch(): void {
    if (xhrSubscriberCount <= 0) {
      return;
    }

    xhrSubscriberCount--;

    if (xhrSubscriberCount === 0) {
      if (typeof XMLHttpRequest !== 'undefined') {
        if (patchedXhrOpenRef && XMLHttpRequest.prototype.open === patchedXhrOpenRef && nativeXhrOpen) {
          XMLHttpRequest.prototype.open = nativeXhrOpen;
        }
        if (patchedXhrSendRef && XMLHttpRequest.prototype.send === patchedXhrSendRef && nativeXhrSend) {
          XMLHttpRequest.prototype.send = nativeXhrSend;
        }
      }
      delete (window as any)[XHR_PATCH_KEY];
      nativeXhrOpen = null;
      nativeXhrSend = null;
      patchedXhrOpenRef = null;
      patchedXhrSendRef = null;
    }
  }


  private reportHttpError(payload: HttpErrorPayload): void {
    if (!this.core) {
      return;
    }

    // Skip if the error URL is the SDK's own report URL
    if (isReportUrlStatic(payload.requestUrl, this.reportUrl)) {
      return;
    }

    this.core.trackEvent('http-error', payload, 'urgent', 'error');
  }
}


function getFetchMethodStatic(input: RequestInfo | URL, init?: RequestInit): string | undefined {
  if (init?.method) {
    return init.method;
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method;
  }
  return 'GET';
}

function getFetchUrlStatic(input: RequestInfo | URL): string | undefined {
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

const errorReporters = new Map<(payload: HttpErrorPayload) => void, string | undefined>();

function queueHttpError(payload: HttpErrorPayload): void {
  errorReporters.forEach((reportUrl, reporter) => {
    if (isReportUrlStatic(payload.requestUrl, reportUrl)) {
      return;
    }
    try {
      reporter(payload);
    } catch {
      // Callback errors must never break the patched function
    }
  });
}

export function registerHttpErrorReporter(reporter: (payload: HttpErrorPayload) => void, reportUrl?: string): () => void {
  errorReporters.set(reporter, reportUrl);
  return () => {
    errorReporters.delete(reporter);
  };
}
