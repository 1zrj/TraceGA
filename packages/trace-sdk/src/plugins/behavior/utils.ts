export interface UrlSanitizeOptions {
  includeQuery: boolean;
  includeHash: boolean;
}

export interface ElementMetadata {
  tagName: string;
  traceId?: string;
  elementId?: string;
  role?: string;
  inputType?: string;
}

export interface MatchedElement {
  element: Element;
  selector: string;
}

const MAX_SELECTORS = 20;
const MAX_SELECTOR_LENGTH = 256;
const MAX_ATTRIBUTE_LENGTH = 128;
const MAX_URL_LENGTH = 2048;
const IGNORE_SELECTOR = '[data-trace-ignore]';

export function truncateString(value: string | null | undefined, maxLength = MAX_ATTRIBUTE_LENGTH): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

export function safeGetAttribute(element: Element, attributeName: string): string | undefined {
  try {
    return truncateString(element.getAttribute(attributeName));
  } catch {
    return undefined;
  }
}

export function sanitizeUrl(rawUrl: string | null | undefined, options: UrlSanitizeOptions): string {
  if (!rawUrl) {
    return '';
  }

  try {
    const baseUrl = typeof window !== 'undefined' && window.location?.href ? window.location.href : 'http://tracega.local/';

    const parsedUrl = new URL(rawUrl, baseUrl);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return '';
    }

    // Credentials must never enter behavior events.
    parsedUrl.username = '';
    parsedUrl.password = '';

    if (!options.includeQuery) {
      parsedUrl.search = '';
    }

    if (!options.includeHash) {
      parsedUrl.hash = '';
    }

    return parsedUrl.href.slice(0, MAX_URL_LENGTH);
  } catch {
    return '';
  }
}

export function getCurrentPageUrl(options: UrlSanitizeOptions): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return sanitizeUrl(window.location?.href, options);
}

export function validateSelectors(selectors: readonly string[]): readonly string[] {
  if (!Array.isArray(selectors) || selectors.length === 0) {
    throw new TypeError('selectors must contain at least one CSS selector');
  }

  if (selectors.length > MAX_SELECTORS) {
    throw new RangeError(`selectors cannot contain more than ${MAX_SELECTORS} entries`);
  }

  const normalizedSelectors = Array.from(
    new Set(
      selectors.map(selector => {
        if (typeof selector !== 'string') {
          throw new TypeError('each selector must be a string');
        }

        const normalized = selector.trim();

        if (!normalized) {
          throw new TypeError('selector cannot be empty');
        }

        if (normalized.length > MAX_SELECTOR_LENGTH) {
          throw new RangeError(`selector cannot exceed ${MAX_SELECTOR_LENGTH} characters`);
        }

        return normalized;
      }),
    ),
  );

  if (typeof document !== 'undefined') {
    normalizedSelectors.forEach(selector => {
      // querySelector validates the syntax once during installation.
      document.querySelector(selector);
    });
  }

  return Object.freeze(normalizedSelectors);
}

export function validateSelector(selector: string): string {
  return validateSelectors([selector])[0];
}

export function getSelectorAttributeFilter(selector: string): string[] {
  const attributes = new Set<string>(['data-trace-ignore']);
  const attributePattern = /\[\s*([a-zA-Z_][\w:.-]*)/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(selector))) {
    attributes.add(match[1]);
  }

  if (selector.includes('.')) {
    attributes.add('class');
  }
  if (selector.includes('#')) {
    attributes.add('id');
  }

  const stateAttributes = ['checked', 'disabled', 'hidden', 'open', 'required', 'selected'];
  stateAttributes.forEach(attribute => {
    if (selector.includes(`:${attribute}`)) {
      attributes.add(attribute);
    }
  });

  return Array.from(attributes);
}

export function getEventElements(event: Event): Element[] {
  if (typeof Element === 'undefined') {
    return [];
  }

  try {
    const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : [];

    const candidates = eventPath.length > 0 ? eventPath : [event.target];

    return candidates.filter((candidate): candidate is Element => candidate instanceof Element);
  } catch {
    return event.target instanceof Element ? [event.target] : [];
  }
}

function safeMatches(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

export function findMatchedElement(event: Event, selectors: readonly string[]): MatchedElement | null {
  const elements = getEventElements(event);

  // Checking the complete composed path also handles ignore markers
  // outside a Shadow DOM click target.
  if (elements.some(element => isIgnoredElement(element))) {
    return null;
  }

  for (const element of elements) {
    for (const selector of selectors) {
      if (safeMatches(element, selector)) {
        return { element, selector };
      }
    }
  }

  return null;
}

export function isIgnoredElement(element: Element): boolean {
  try {
    return element.closest(IGNORE_SELECTOR) !== null;
  } catch {
    return false;
  }
}

export function getElementMetadata(element: Element): ElementMetadata {
  let tagName = 'unknown';

  try {
    tagName = truncateString(element.tagName.toLowerCase()) ?? 'unknown';
  } catch {
    // Keep the safe fallback.
  }

  return {
    tagName,
    traceId: safeGetAttribute(element, 'data-trace-id'),
    elementId: safeGetAttribute(element, 'id'),
    role: safeGetAttribute(element, 'role'),
    inputType: safeGetAttribute(element, 'type'),
  };
}

export function normalizeIntersectionRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) {
    return 0;
  }

  const boundedRatio = Math.min(1, Math.max(0, ratio));
  return Math.round(boundedRatio * 10000) / 10000;
}
