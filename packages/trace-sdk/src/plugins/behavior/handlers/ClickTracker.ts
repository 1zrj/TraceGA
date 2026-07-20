import type { ITraceCore } from '../../../types';
import { BehaviorEventName, type BehaviorErrorHandler, type ClickBehaviorPayload, type ResolvedClickTrackingOptions } from '../types';
import { findMatchedElement, getCurrentPageUrl, getElementMetadata, validateSelectors } from '../utils';

export class ClickTracker {
  private core: ITraceCore | null = null;
  private installed = false;
  private selectors: readonly string[] = [];

  constructor(
    private readonly options: ResolvedClickTrackingOptions,
    private readonly reportError: BehaviorErrorHandler,
  ) {}

  install(core: ITraceCore): void {
    if (this.installed || typeof document === 'undefined') {
      return;
    }

    this.selectors = validateSelectors(this.options.selectors);
    this.core = core;

    document.addEventListener('click', this.handleClick, {
      capture: true,
      passive: true,
    });

    this.installed = true;
  }

  uninstall(): void {
    if (!this.installed) {
      return;
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this.handleClick, true);
    }

    this.core = null;
    this.selectors = [];
    this.installed = false;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    try {
      if (!this.core) {
        return;
      }

      const matched = findMatchedElement(event, this.selectors);

      if (!matched) {
        return;
      }

      const metadata = getElementMetadata(matched.element);

      const payload: ClickBehaviorPayload = {
        type: 'click',
        ...metadata,
        matchedSelector: matched.selector,
        mouseButton: Number.isFinite(event.button) ? event.button : 0,
        pageUrl: getCurrentPageUrl(this.options),
      };

      this.core.trackEvent(BehaviorEventName.CLICK, payload, 'high', 'click');
    } catch (error) {
      this.reportError(error, 'behavior.click.event');
    }
  };
}
