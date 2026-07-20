import type { ITraceCore } from '../../../types';
import { BehaviorEventName, type BehaviorErrorHandler, type ExposureBehaviorPayload, type ResolvedExposureTrackingOptions } from '../types';
import { getCurrentPageUrl, getElementMetadata, getSelectorAttributeFilter, isIgnoredElement, normalizeIntersectionRatio, validateSelector } from '../utils';

export class ExposureTracker {
  private core: ITraceCore | null = null;
  private installed = false;
  private selector = '';

  private intersectionObserver: IntersectionObserver | null = null;

  private mutationObserver: MutationObserver | null = null;

  private observedElements = new Set<Element>();
  private exposedElements = new WeakSet<Element>();

  private pendingAddedNodes = new Set<Node>();
  private pendingRemovedNodes = new Set<Node>();
  private pendingAttributeElements = new Set<Element>();
  private cancelScheduledScan: (() => void) | null = null;

  constructor(
    private readonly options: ResolvedExposureTrackingOptions,
    private readonly reportError: BehaviorErrorHandler,
  ) {}

  install(core: ITraceCore): void {
    if (this.installed || typeof document === 'undefined') {
      return;
    }

    this.validateOptions();
    this.selector = validateSelector(this.options.selector);
    this.core = core;
    this.installed = true;

    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    try {
      this.intersectionObserver = new IntersectionObserver(this.handleIntersections, {
        threshold: this.options.threshold,
        rootMargin: this.options.rootMargin,
      });

      this.observeInitialElements();
      this.installMutationObserver();
    } catch (error) {
      this.installed = false;
      this.core = null;
      this.selector = '';
      this.intersectionObserver?.disconnect();
      this.intersectionObserver = null;
      throw error;
    }
  }

  uninstall(): void {
    if (!this.installed) {
      return;
    }

    try {
      this.mutationObserver?.disconnect();
      this.intersectionObserver?.disconnect();
    } finally {
      this.mutationObserver = null;
      this.intersectionObserver = null;
      this.observedElements.clear();
      this.exposedElements = new WeakSet<Element>();
      this.pendingAddedNodes.clear();
      this.pendingRemovedNodes.clear();
      this.pendingAttributeElements.clear();
      this.cancelScheduledScan?.();
      this.cancelScheduledScan = null;
      this.selector = '';
      this.core = null;
      this.installed = false;
    }
  }

  private validateOptions(): void {
    const { threshold, rootMargin } = this.options;

    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      throw new RangeError('exposure threshold must be between 0 and 1');
    }

    if (typeof rootMargin !== 'string' || rootMargin.length > 128) {
      throw new TypeError('exposure rootMargin must be a valid string');
    }
  }

  private observeInitialElements(): void {
    document.querySelectorAll(this.selector).forEach(element => this.observeElement(element));
  }

  private installMutationObserver(): void {
    if (typeof MutationObserver === 'undefined' || !document.documentElement) {
      return;
    }

    this.mutationObserver = new MutationObserver(this.handleMutations);

    this.mutationObserver.observe(document.documentElement, {
      attributeFilter: getSelectorAttributeFilter(this.selector),
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  private readonly handleIntersections = (entries: IntersectionObserverEntry[]): void => {
    entries.forEach(entry => {
      try {
        if (!this.core || !(entry.target instanceof Element) || !entry.isIntersecting || entry.intersectionRatio < this.options.threshold) {
          return;
        }

        const element = entry.target;

        if (!element.isConnected || isIgnoredElement(element)) {
          this.unobserveElement(element);
          return;
        }

        if (this.options.once && this.exposedElements.has(element)) {
          return;
        }

        const metadata = getElementMetadata(element);

        const payload: ExposureBehaviorPayload = {
          type: 'exposure',
          ...metadata,
          matchedSelector: this.selector,
          intersectionRatio: normalizeIntersectionRatio(entry.intersectionRatio),
          pageUrl: getCurrentPageUrl(this.options),
        };

        this.core.trackEvent(BehaviorEventName.EXPOSURE, payload, 'high', 'exposure');

        if (this.options.once) {
          this.exposedElements.add(element);
          this.unobserveElement(element);
        }
      } catch (error) {
        this.reportError(error, 'behavior.exposure.intersection');
      }
    });
  };

  private readonly handleMutations = (records: MutationRecord[]): void => {
    try {
      records.forEach(record => {
        if (record.type === 'attributes' && record.target instanceof Element) {
          this.pendingAttributeElements.add(record.target);
        }

        record.addedNodes.forEach(node => {
          this.pendingAddedNodes.add(node);
        });

        record.removedNodes.forEach(node => {
          this.pendingRemovedNodes.add(node);
        });
      });

      this.scheduleMutationScan();
    } catch (error) {
      this.reportError(error, 'behavior.exposure.mutation');
    }
  };

  private scheduleMutationScan(): void {
    if (this.cancelScheduledScan) {
      return;
    }

    const runScan = (): void => {
      this.cancelScheduledScan = null;

      if (!this.installed) {
        this.pendingAddedNodes.clear();
        this.pendingRemovedNodes.clear();
        this.pendingAttributeElements.clear();
        return;
      }

      try {
        this.pendingRemovedNodes.forEach(node => {
          this.unobserveNodeTree(node);
        });

        this.pendingAddedNodes.forEach(node => {
          this.observeNodeTree(node);
        });

        this.getMinimalAttributeRoots().forEach(element => {
          this.refreshNodeTree(element);
        });
      } catch (error) {
        this.reportError(error, 'behavior.exposure.scan');
      } finally {
        this.pendingAddedNodes.clear();
        this.pendingRemovedNodes.clear();
        this.pendingAttributeElements.clear();
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      const frameId = requestAnimationFrame(runScan);
      this.cancelScheduledScan = () => cancelAnimationFrame(frameId);
      return;
    }

    const timeoutId = setTimeout(runScan, 0);
    this.cancelScheduledScan = () => clearTimeout(timeoutId);
  }

  private getMinimalAttributeRoots(): Element[] {
    const roots = Array.from(this.pendingAttributeElements).filter(element => element.isConnected);

    return roots.filter(element => !roots.some(other => other !== element && other.contains(element)));
  }

  private observeNodeTree(node: Node): void {
    if (!(node instanceof Element)) {
      return;
    }

    if (this.safeMatches(node)) {
      this.observeElement(node);
    }

    node.querySelectorAll(this.selector).forEach(element => this.observeElement(element));
  }

  private unobserveNodeTree(node: Node): void {
    if (!(node instanceof Element)) {
      return;
    }

    Array.from(this.observedElements).forEach(element => {
      if (element === node || node.contains(element)) {
        this.unobserveElement(element);
      }
    });
  }

  private refreshNodeTree(root: Element): void {
    Array.from(this.observedElements).forEach(element => {
      if ((element === root || root.contains(element)) && (!element.isConnected || !this.safeMatches(element) || isIgnoredElement(element))) {
        this.unobserveElement(element);
      }
    });

    if (!root.isConnected) {
      return;
    }

    this.observeNodeTree(root);
  }

  private observeElement(element: Element): void {
    if (!this.intersectionObserver || this.observedElements.has(element) || isIgnoredElement(element) || (this.options.once && this.exposedElements.has(element))) {
      return;
    }

    this.intersectionObserver.observe(element);
    this.observedElements.add(element);
  }

  private unobserveElement(element: Element): void {
    if (!this.observedElements.has(element)) {
      return;
    }

    try {
      this.intersectionObserver?.unobserve(element);
    } finally {
      this.observedElements.delete(element);
    }
  }

  private safeMatches(element: Element): boolean {
    try {
      return element.matches(this.selector);
    } catch {
      return false;
    }
  }
}
