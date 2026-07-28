import type { ITraceCore, TracePlugin } from '../../types';
import { ClickTracker } from './handlers/ClickTracker';
import { ExposureTracker } from './handlers/ExposureTracker';
import { PageViewTracker } from './handlers/PageViewTracker';
import type { BehaviorErrorHandler, BehaviorPluginOptions, ResolvedClickTrackingOptions, ResolvedExposureTrackingOptions, ResolvedPageViewTrackingOptions } from './types';

const DEFAULT_CLICK_SELECTORS = Object.freeze(['button', 'a', 'input', 'select', 'textarea', '[role="button"]', '[data-trace-id]']);

interface Tracker {
  install(core: ITraceCore): void;
  uninstall(): void;
}

interface ResolvedBehaviorOptions {
  click: false | ResolvedClickTrackingOptions;
  pageView: false | ResolvedPageViewTrackingOptions;
  exposure: false | ResolvedExposureTrackingOptions;
  onError?: BehaviorErrorHandler;
}

export class BehaviorPlugin implements TracePlugin {
  readonly name = 'BehaviorPlugin';

  private installed = false;
  private activeTrackers: Tracker[] = [];
  private readonly options: ResolvedBehaviorOptions;

  constructor(options: BehaviorPluginOptions = {}) {
    this.options = this.resolveOptions(options);
  }

  install(core: ITraceCore): void {
    if (this.installed) {
      return;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    try {
      if (!core || typeof core.trackEvent !== 'function') {
        throw new TypeError('BehaviorPlugin requires a valid TraceCore');
      }
    } catch (error) {
      this.reportError(error, 'behavior.install.core');
      return;
    }

    this.installed = true;

    const trackers = this.createTrackers();

    trackers.forEach(tracker => {
      try {
        tracker.install(core);
        this.activeTrackers.push(tracker);
      } catch (error) {
        this.reportError(error, 'behavior.install.tracker');
      }
    });
  }

  uninstall(): void {
    if (!this.installed) {
      return;
    }

    const trackers = [...this.activeTrackers].reverse();
    this.activeTrackers = [];
    this.installed = false;

    trackers.forEach(tracker => {
      try {
        tracker.uninstall();
      } catch (error) {
        this.reportError(error, 'behavior.uninstall.tracker');
      }
    });
  }

  private createTrackers(): Tracker[] {
    const trackers: Tracker[] = [];

    if (this.options.click) {
      trackers.push(new ClickTracker(this.options.click, this.reportError));
    }

    if (this.options.pageView) {
      trackers.push(new PageViewTracker(this.options.pageView, this.reportError));
    }

    if (this.options.exposure) {
      trackers.push(new ExposureTracker(this.options.exposure, this.reportError));
    }

    return trackers;
  }

  private resolveOptions(options: BehaviorPluginOptions): ResolvedBehaviorOptions {
    const click =
      options.click === false
        ? false
        : Object.freeze({
            selectors: Object.freeze([...(options.click?.selectors ?? DEFAULT_CLICK_SELECTORS)]),
            includeQuery: options.click?.includeQuery ?? false,
            includeHash: options.click?.includeHash ?? false,
          });

    const pageView =
      options.pageView === false
        ? false
        : Object.freeze({
            trackInitial: options.pageView?.trackInitial ?? true,
            includeQuery: options.pageView?.includeQuery ?? false,
            includeHash: options.pageView?.includeHash ?? false,
          });

    const exposure =
      options.exposure === false
        ? false
        : Object.freeze({
            selector: options.exposure?.selector ?? '[data-trace-exposure]',
            threshold: options.exposure?.threshold ?? 0.5,
            rootMargin: options.exposure?.rootMargin ?? '0px',
            once: options.exposure?.once ?? true,
            includeQuery: options.exposure?.includeQuery ?? false,
            includeHash: options.exposure?.includeHash ?? false,
          });

    return Object.freeze({
      click,
      pageView,
      exposure,
      onError: typeof options.onError === 'function' ? options.onError : undefined,
    });
  }

  private readonly reportError: BehaviorErrorHandler = (error, context): void => {
    try {
      this.options.onError?.(error, context);
    } catch {
      // User callbacks must not escape the plugin boundary.
    }
  };
}
