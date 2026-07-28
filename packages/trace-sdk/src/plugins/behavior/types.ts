export const BehaviorEventName = {
  CLICK: 'behavior_click',
  PAGE_VIEW: 'page_view',
  EXPOSURE: 'element_exposure',
} as const;

export type BehaviorEventName = (typeof BehaviorEventName)[keyof typeof BehaviorEventName];

export interface ClickTrackingOptions {
  /** Custom CSS selectors. At most 20 selectors, 256 characters each. */
  selectors?: readonly string[];
  /** Preserve URL query parameters. Defaults to false. */
  includeQuery?: boolean;
  /** Preserve the URL hash. Defaults to false. Enable only for trusted hash routes. */
  includeHash?: boolean;
}

export interface PageViewTrackingOptions {
  trackInitial?: boolean;
  /** Preserve URL query parameters. Defaults to false. */
  includeQuery?: boolean;
  /** Preserve the URL hash. Defaults to false. Enable only for trusted hash routes. */
  includeHash?: boolean;
}

export interface ExposureTrackingOptions {
  /** CSS selector for elements that should be observed. */
  selector?: string;
  /** Visible ratio required for exposure, from 0 to 1. Defaults to 0.5. */
  threshold?: number;
  rootMargin?: string;
  /** Report each element only once. Defaults to true. */
  once?: boolean;
  /** Preserve URL query parameters. Defaults to false. */
  includeQuery?: boolean;
  /** Preserve the URL hash. Defaults to false. Enable only for trusted hash routes. */
  includeHash?: boolean;
}

export interface BehaviorPluginOptions {
  click?: false | ClickTrackingOptions;
  exposure?: false | ExposureTrackingOptions;
  pageView?: false | PageViewTrackingOptions;
  onError?: (error: unknown, context: string) => void;
}

interface ElementBehaviorFields {
  tagName: string;
  traceId?: string;
  elementId?: string;
  role?: string;
  inputType?: string;
  matchedSelector: string;
}

export interface ClickBehaviorPayload extends ElementBehaviorFields {
  [key: string]: unknown;
  type: 'click';
  pageUrl: string;
  mouseButton: number;
}

export interface PageViewBehaviorPayload {
  [key: string]: unknown;
  type: 'page_view';
  pageUrl: string;
  previousUrl?: string;
  navigationType: 'initial' | 'pushState' | 'replaceState' | 'popstate' | 'hashchange';
}

export interface ExposureBehaviorPayload extends ElementBehaviorFields {
  [key: string]: unknown;
  type: 'exposure';
  pageUrl: string;
  intersectionRatio: number;
}

export interface ResolvedClickTrackingOptions {
  selectors: readonly string[];
  includeQuery: boolean;
  includeHash: boolean;
}

export interface ResolvedPageViewTrackingOptions {
  trackInitial: boolean;
  includeQuery: boolean;
  includeHash: boolean;
}

export interface ResolvedExposureTrackingOptions {
  selector: string;
  threshold: number;
  rootMargin: string;
  once: boolean;
  includeQuery: boolean;
  includeHash: boolean;
}

export type BehaviorErrorHandler = (error: unknown, context: string) => void;
