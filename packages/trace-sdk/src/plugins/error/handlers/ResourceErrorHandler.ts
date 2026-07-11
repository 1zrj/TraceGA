import type { ITraceCore } from '../../../types';
import type { ErrorHandler, ErrorPayloadBase } from '../types';
import { getBrowserContext } from '../types';

export interface ResourceErrorPayload extends ErrorPayloadBase {
  type: 'resource-error';
  tagName?: string;
  resourceUrl?: string;
  outerHTML?: string;
}

export class ResourceErrorHandler implements ErrorHandler {
  private core: ITraceCore | null = null;

  private readonly handleResourceError = (event: Event): void => {
    if (!this.core || !this.isResourceError(event)) {
      return;
    }

    this.core.trackEvent('resource-error', this.normalizeResourceError(event));
  };

  install(core: ITraceCore): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.core = core;
    window.addEventListener('error', this.handleResourceError, true);
  }

  uninstall(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('error', this.handleResourceError, true);
    this.core = null;
  }

  private isResourceError(event: Event): boolean {
    return event.target instanceof Element && event.target !== window;
  }

  private normalizeResourceError(event: Event): ResourceErrorPayload {
    const target = event.target as Element;
    const resourceUrl = this.getResourceUrl(target);
    const tagName = target.tagName.toLowerCase();

    return {
      type: 'resource-error',
      message: `Resource load failed: ${tagName}`,
      tagName,
      resourceUrl,
      outerHTML: target.outerHTML,
      ...getBrowserContext(),
    };
  }

  private getResourceUrl(target: Element): string | undefined {
    if (target instanceof HTMLImageElement) {
      return target.currentSrc || target.src || undefined;
    }

    if (target instanceof HTMLScriptElement || target instanceof HTMLIFrameElement) {
      return target.src || undefined;
    }

    if (target instanceof HTMLLinkElement) {
      return target.href || undefined;
    }

    if (target instanceof HTMLSourceElement) {
      return target.src || undefined;
    }

    return target.getAttribute('src') || target.getAttribute('href') || undefined;
  }
}
