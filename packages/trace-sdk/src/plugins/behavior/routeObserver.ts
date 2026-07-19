export type RouteNavigationType = 'pushState' | 'replaceState' | 'popstate' | 'hashchange';

export interface RouteChange {
  navigationType: RouteNavigationType;
  previousUrl: string;
  pageUrl: string;
}

export type RouteChangeListener = (change: RouteChange) => void;

const listeners = new Set<RouteChangeListener>();

let originalPushState: History['pushState'] | null = null;
let originalReplaceState: History['replaceState'] | null = null;
let wrappedPushState: History['pushState'] | null = null;
let wrappedReplaceState: History['replaceState'] | null = null;
let lastKnownUrl = '';

function readCurrentUrl(): string {
  try {
    return window.location.href;
  } catch {
    return '';
  }
}

function notifyRouteChange(navigationType: RouteNavigationType, previousUrl = lastKnownUrl): void {
  const pageUrl = readCurrentUrl();

  if (!pageUrl || pageUrl === previousUrl) {
    lastKnownUrl = pageUrl || lastKnownUrl;
    return;
  }

  lastKnownUrl = pageUrl;

  const change: RouteChange = {
    navigationType,
    previousUrl,
    pageUrl,
  };

  Array.from(listeners).forEach(listener => {
    try {
      listener(change);
    } catch {
      // One subscriber must not prevent other subscribers.
    }
  });
}

const handlePopState = (): void => {
  notifyRouteChange('popstate');
};

const handleHashChange = (event: HashChangeEvent): void => {
  notifyRouteChange('hashchange', event.oldURL || lastKnownUrl);
};

function installRouteObserver(): void {
  if (typeof window === 'undefined' || typeof history === 'undefined') {
    return;
  }

  lastKnownUrl = readCurrentUrl();

  const capturedPushState = history.pushState;
  const capturedReplaceState = history.replaceState;

  originalPushState = capturedPushState;
  originalReplaceState = capturedReplaceState;

  wrappedPushState = function patchedPushState(this: History, data: unknown, unused: string, url?: string | URL | null): void {
    const previousUrl = readCurrentUrl();

    capturedPushState.call(this, data, unused, url);
    notifyRouteChange('pushState', previousUrl);
  };

  wrappedReplaceState = function patchedReplaceState(this: History, data: unknown, unused: string, url?: string | URL | null): void {
    const previousUrl = readCurrentUrl();

    capturedReplaceState.call(this, data, unused, url);
    notifyRouteChange('replaceState', previousUrl);
  };

  try {
    history.pushState = wrappedPushState;
    history.replaceState = wrappedReplaceState;

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
  } catch (error) {
    if (wrappedPushState && history.pushState === wrappedPushState) {
      history.pushState = capturedPushState;
    }

    if (wrappedReplaceState && history.replaceState === wrappedReplaceState) {
      history.replaceState = capturedReplaceState;
    }

    originalPushState = null;
    originalReplaceState = null;
    wrappedPushState = null;
    wrappedReplaceState = null;
    lastKnownUrl = '';

    throw error;
  }
}

function uninstallRouteObserver(): void {
  if (typeof window === 'undefined' || typeof history === 'undefined') {
    return;
  }

  window.removeEventListener('popstate', handlePopState);
  window.removeEventListener('hashchange', handleHashChange);

  // Restore only when no third-party library has replaced our wrapper.
  if (originalPushState && wrappedPushState && history.pushState === wrappedPushState) {
    history.pushState = originalPushState;
  }

  if (originalReplaceState && wrappedReplaceState && history.replaceState === wrappedReplaceState) {
    history.replaceState = originalReplaceState;
  }

  originalPushState = null;
  originalReplaceState = null;
  wrappedPushState = null;
  wrappedReplaceState = null;
  lastKnownUrl = '';
}

export function subscribeRouteChanges(listener: RouteChangeListener): () => void {
  if (typeof listener !== 'function') {
    throw new TypeError('route listener must be a function');
  }

  if (typeof window === 'undefined' || typeof history === 'undefined') {
    return () => undefined;
  }

  listeners.add(listener);

  if (listeners.size === 1) {
    try {
      installRouteObserver();
    } catch (error) {
      listeners.delete(listener);
      throw error;
    }
  }

  let subscribed = true;

  return (): void => {
    if (!subscribed) {
      return;
    }

    subscribed = false;
    listeners.delete(listener);

    if (listeners.size === 0) {
      uninstallRouteObserver();
    }
  };
}
