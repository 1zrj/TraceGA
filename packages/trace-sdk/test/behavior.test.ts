import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorEventName, BehaviorPlugin, type ITraceCore } from '../src';
import { subscribeRouteChanges, type RouteChange } from '../src/plugins/behavior/routeObserver';
import { getElementMetadata, getSelectorAttributeFilter, sanitizeUrl, validateSelectors } from '../src/plugins/behavior/utils';

class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds: readonly number[];
  readonly observe = vi.fn<(target: Element) => void>();
  readonly unobserve = vi.fn<(target: Element) => void>();
  readonly disconnect = vi.fn<() => void>();

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    this.rootMargin = options.rootMargin ?? '0px';
    this.thresholds = Array.isArray(options.threshold) ? options.threshold : [options.threshold ?? 0];
    MockIntersectionObserver.instances.push(this);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  trigger(target: Element, intersectionRatio: number): void {
    this.callback(
      [
        {
          target,
          isIntersecting: intersectionRatio > 0,
          intersectionRatio,
        } as IntersectionObserverEntry,
      ],
      this,
    );
  }
}

function createCore(): {
  core: ITraceCore;
  trackEvent: ReturnType<typeof vi.fn>;
} {
  const trackEvent = vi.fn();
  return {
    core: { trackEvent } as unknown as ITraceCore,
    trackEvent,
  };
}

describe('behavior utilities', () => {
  it('removes credentials, query parameters, and hash by default', () => {
    expect(sanitizeUrl('https://user:password@example.com/path?token=secret#access_token', { includeQuery: false, includeHash: false })).toBe('https://example.com/path');
  });

  it('reads bounded element metadata without collecting text or values', () => {
    const input = document.createElement('input');
    input.id = 'x'.repeat(200);
    input.type = 'password';
    input.value = 'must-not-be-collected';
    input.setAttribute('data-trace-id', 'login-field');

    expect(getElementMetadata(input)).toEqual({
      tagName: 'input',
      traceId: 'login-field',
      elementId: 'x'.repeat(128),
      role: undefined,
      inputType: 'password',
    });
  });

  it('rejects invalid and excessive selector lists', () => {
    expect(() => validateSelectors(['['])).toThrow();
    expect(() => validateSelectors(Array.from({ length: 21 }, (_, index) => `.item-${index}`))).toThrow(/20/);
  });

  it('observes only attributes that can affect the exposure selector', () => {
    expect(getSelectorAttributeFilter('.hero[data-track-visible]:not([hidden])')).toEqual(expect.arrayContaining(['class', 'data-trace-ignore', 'data-track-visible', 'hidden']));
    expect(getSelectorAttributeFilter('[data-track-visible]')).not.toContain('style');
  });
});

describe('shared SPA route observer', () => {
  beforeEach(() => {
    history.replaceState({}, '', '/behavior-start');
  });

  it('shares one patch, isolates listeners, and restores history methods', () => {
    const originalPushState = history.pushState;
    const throwingListener = vi.fn(() => {
      throw new Error('listener failed');
    });
    const changes: RouteChange[] = [];
    const unsubscribeFirst = subscribeRouteChanges(throwingListener);
    const unsubscribeSecond = subscribeRouteChanges(change => {
      changes.push(change);
    });

    expect(history.pushState).not.toBe(originalPushState);
    history.pushState({}, '', '/behavior-next?private=1#secret');

    expect(throwingListener).toHaveBeenCalledOnce();
    expect(changes).toEqual([
      expect.objectContaining({
        navigationType: 'pushState',
        previousUrl: expect.stringContaining('/behavior-start'),
        pageUrl: expect.stringContaining('/behavior-next?private=1#secret'),
      }),
    ]);

    unsubscribeFirst();
    unsubscribeSecond();
    expect(history.pushState).toBe(originalPushState);
  });
});

describe('BehaviorPlugin', () => {
  beforeEach(() => {
    history.replaceState({}, '', '/behavior?token=secret#private');
    document.body.innerHTML = '';
    MockIntersectionObserver.instances = [];
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('tracks delegated clicks and removes the listener on uninstall', () => {
    const { core, trackEvent } = createCore();
    const plugin = new BehaviorPlugin({
      click: { selectors: ['button'] },
      pageView: false,
      exposure: false,
    });
    const button = document.createElement('button');
    const child = document.createElement('span');
    button.setAttribute('data-trace-id', 'submit');
    button.appendChild(child);
    document.body.appendChild(button);

    plugin.install(core);
    plugin.install(core);
    child.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

    expect(trackEvent).toHaveBeenCalledWith(
      BehaviorEventName.CLICK,
      expect.objectContaining({
        type: 'click',
        tagName: 'button',
        traceId: 'submit',
        matchedSelector: 'button',
        pageUrl: `${window.location.origin}/behavior`,
      }),
      'high',
      'click',
    );

    plugin.uninstall();
    plugin.uninstall();
    trackEvent.mockClear();
    child.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('ignores marked trees and never collects text, HTML, or input values', () => {
    const { core, trackEvent } = createCore();
    const plugin = new BehaviorPlugin({
      click: { selectors: ['button', 'input'] },
      pageView: false,
      exposure: false,
    });
    const ignoredContainer = document.createElement('div');
    const ignoredInput = document.createElement('input');
    const shadowHost = document.createElement('div');
    const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
    const shadowButton = document.createElement('button');

    ignoredContainer.setAttribute('data-trace-ignore', '');
    ignoredInput.value = 'ignored-password';
    ignoredContainer.appendChild(ignoredInput);
    shadowButton.textContent = 'private button copy';
    shadowButton.setAttribute('data-trace-id', 'shadow-action');
    shadowRoot.appendChild(shadowButton);
    document.body.append(ignoredContainer, shadowHost);

    plugin.install(core);
    ignoredInput.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(trackEvent).not.toHaveBeenCalled();

    shadowButton.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(trackEvent).toHaveBeenCalledOnce();
    expect(trackEvent).toHaveBeenCalledWith(
      BehaviorEventName.CLICK,
      expect.objectContaining({
        tagName: 'button',
        traceId: 'shadow-action',
        matchedSelector: 'button',
      }),
      'high',
      'click',
    );

    const payload = trackEvent.mock.calls[0]?.[1];
    expect(JSON.stringify(payload)).not.toContain('ignored-password');
    expect(JSON.stringify(payload)).not.toContain('private button copy');
    plugin.uninstall();
  });

  it('tracks initial and SPA page views with sanitized URLs', () => {
    const { core, trackEvent } = createCore();
    const plugin = new BehaviorPlugin({
      click: false,
      exposure: false,
      pageView: { trackInitial: true },
    });

    plugin.install(core);
    history.pushState({}, '', '/next?token=secret#private');

    expect(trackEvent).toHaveBeenNthCalledWith(
      1,
      BehaviorEventName.PAGE_VIEW,
      expect.objectContaining({
        type: 'page_view',
        navigationType: 'initial',
        pageUrl: `${window.location.origin}/behavior`,
      }),
      'high',
      'page_view',
    );
    expect(trackEvent).toHaveBeenNthCalledWith(
      2,
      BehaviorEventName.PAGE_VIEW,
      expect.objectContaining({
        navigationType: 'pushState',
        previousUrl: `${window.location.origin}/behavior`,
        pageUrl: `${window.location.origin}/next`,
      }),
      'high',
      'page_view',
    );

    plugin.uninstall();
  });

  it('preserves trusted hash routes only when explicitly enabled', () => {
    const { core, trackEvent } = createCore();
    const plugin = new BehaviorPlugin({
      click: false,
      exposure: false,
      pageView: { includeHash: true, trackInitial: false },
    });

    plugin.install(core);
    history.pushState({}, '', '/hash-route?token=secret#details');

    expect(trackEvent).toHaveBeenCalledWith(
      BehaviorEventName.PAGE_VIEW,
      expect.objectContaining({
        pageUrl: `${window.location.origin}/hash-route#details`,
      }),
      'high',
      'page_view',
    );

    plugin.uninstall();
  });

  it('tracks exposure once and responds to selector attribute changes', async () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    const { core, trackEvent } = createCore();
    const plugin = new BehaviorPlugin({
      click: false,
      pageView: false,
      exposure: { selector: '[data-track-visible]', threshold: 0.5 },
    });
    const element = document.createElement('section');
    document.body.appendChild(element);

    plugin.install(core);
    const observer = MockIntersectionObserver.instances[0];

    element.setAttribute('data-track-visible', 'hero');
    await vi.waitFor(() => {
      expect(observer.observe).toHaveBeenCalledWith(element);
    });

    observer.trigger(element, 0.25);
    expect(trackEvent).not.toHaveBeenCalled();

    observer.trigger(element, 0.75);
    expect(trackEvent).toHaveBeenCalledWith(
      BehaviorEventName.EXPOSURE,
      expect.objectContaining({
        type: 'exposure',
        tagName: 'section',
        intersectionRatio: 0.75,
        pageUrl: `${window.location.origin}/behavior`,
      }),
      'high',
      'exposure',
    );
    expect(observer.unobserve).toHaveBeenCalledWith(element);
    observer.trigger(element, 0.9);
    expect(trackEvent).toHaveBeenCalledOnce();

    plugin.uninstall();
    expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it('keeps healthy trackers active when another tracker fails to install', () => {
    const onError = vi.fn(() => {
      throw new Error('callback failed');
    });
    const { core } = createCore();
    const plugin = new BehaviorPlugin({
      click: { selectors: ['button'] },
      pageView: false,
      exposure: { selector: '[' },
      onError,
    });
    const button = document.createElement('button');
    document.body.appendChild(button);

    expect(() => plugin.install(core)).not.toThrow();
    expect(onError).toHaveBeenCalledWith(expect.anything(), 'behavior.install.tracker');
    button.click();
    expect(core.trackEvent).toHaveBeenCalledWith(BehaviorEventName.CLICK, expect.any(Object), 'high', 'click');
    expect(() => plugin.uninstall()).not.toThrow();
  });

  it('degrades exposure tracking when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const onError = vi.fn();
    const { core, trackEvent } = createCore();
    const plugin = new BehaviorPlugin({
      click: false,
      pageView: false,
      exposure: {},
      onError,
    });

    expect(() => plugin.install(core)).not.toThrow();
    expect(() => plugin.uninstall()).not.toThrow();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
