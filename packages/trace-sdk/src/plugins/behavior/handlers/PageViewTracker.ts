import type { ITraceCore } from '../../../types';
import { BehaviorEventName, type BehaviorErrorHandler, type PageViewBehaviorPayload, type ResolvedPageViewTrackingOptions } from '../types';
import { subscribeRouteChanges, type RouteChange, type RouteNavigationType } from '../routeObserver';
import { getCurrentPageUrl, sanitizeUrl } from '../utils';

export class PageViewTracker {
  private core: ITraceCore | null = null;
  private installed = false;
  private currentPageUrl = '';
  private unsubscribeRoute: (() => void) | null = null;

  constructor(
    private readonly options: ResolvedPageViewTrackingOptions,
    private readonly reportError: BehaviorErrorHandler,
  ) {}

  install(core: ITraceCore): void {
    if (this.installed || typeof window === 'undefined') {
      return;
    }

    this.core = core;
    this.currentPageUrl = getCurrentPageUrl(this.options);
    this.unsubscribeRoute = subscribeRouteChanges(this.handleRouteChange);
    this.installed = true;

    if (this.options.trackInitial) {
      const previousUrl = typeof document !== 'undefined' ? sanitizeUrl(document.referrer, this.options) : '';

      this.trackPageView('initial', this.currentPageUrl, previousUrl || undefined);
    }
  }

  uninstall(): void {
    if (!this.installed) {
      return;
    }

    try {
      this.unsubscribeRoute?.();
    } finally {
      this.unsubscribeRoute = null;
      this.currentPageUrl = '';
      this.core = null;
      this.installed = false;
    }
  }

  private readonly handleRouteChange = (change: RouteChange): void => {
    try {
      const pageUrl = sanitizeUrl(change.pageUrl, this.options);

      if (!pageUrl || pageUrl === this.currentPageUrl) {
        return;
      }

      const previousUrl = this.currentPageUrl || sanitizeUrl(change.previousUrl, this.options);

      this.currentPageUrl = pageUrl;

      this.trackPageView(change.navigationType, pageUrl, previousUrl || undefined);
    } catch (error) {
      this.reportError(error, 'behavior.pageView.route');
    }
  };

  private trackPageView(navigationType: RouteNavigationType | 'initial', pageUrl: string, previousUrl?: string): void {
    try {
      if (!this.core || !pageUrl) {
        return;
      }

      const payload: PageViewBehaviorPayload = {
        type: 'page_view',
        pageUrl,
        previousUrl,
        navigationType,
      };

      this.core.trackEvent(BehaviorEventName.PAGE_VIEW, payload, 'high', 'page_view');
    } catch (error) {
      this.reportError(error, 'behavior.pageView.track');
    }
  }
}
