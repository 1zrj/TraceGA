import type { EnvInfo } from '../types';
import { generateUUID, parseUserAgent } from '../utils';

const UID_STORAGE_KEY = '__tracega_uid__';
let memoryUid = '';

export interface EnvCollectionOptions {
  includeQuery?: boolean;
  includeHash?: boolean;
}

const DEFAULT_ENV_OPTIONS = Object.freeze({
  includeQuery: false,
  includeHash: false,
});

function getUid(): string {
  if (memoryUid) {
    return memoryUid;
  }

  try {
    const storedUid = globalThis.localStorage?.getItem(UID_STORAGE_KEY);
    if (storedUid) {
      memoryUid = storedUid;
      return storedUid;
    }

    memoryUid = generateUUID();
    globalThis.localStorage?.setItem(UID_STORAGE_KEY, memoryUid);
    return memoryUid;
  } catch {
    if (!memoryUid) {
      memoryUid = generateUUID();
    }
    return memoryUid;
  }
}

export function sanitizeEnvironmentUrl(rawUrl: string | null | undefined, options: EnvCollectionOptions = DEFAULT_ENV_OPTIONS): string {
  if (!rawUrl) {
    return '';
  }

  try {
    const baseUrl = typeof window !== 'undefined' && window.location?.href ? window.location.href : 'http://tracega.local/';
    const parsedUrl = new URL(rawUrl, baseUrl);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return '';
    }

    parsedUrl.username = '';
    parsedUrl.password = '';
    if (!(options.includeQuery ?? DEFAULT_ENV_OPTIONS.includeQuery)) {
      parsedUrl.search = '';
    }
    if (!(options.includeHash ?? DEFAULT_ENV_OPTIONS.includeHash)) {
      parsedUrl.hash = '';
    }

    return parsedUrl.href.slice(0, 2048);
  } catch {
    return '';
  }
}

function readDynamicEnvInfo(options: EnvCollectionOptions): Pick<EnvInfo, 'screenWidth' | 'screenHeight' | 'viewportWidth' | 'viewportHeight' | 'referrer' | 'url'> {
  const hasWindow = typeof window !== 'undefined';
  const hasDocument = typeof document !== 'undefined';

  return {
    screenWidth: hasWindow ? (window.screen?.width ?? 0) : 0,
    screenHeight: hasWindow ? (window.screen?.height ?? 0) : 0,
    viewportWidth: hasWindow ? (window.innerWidth ?? 0) : 0,
    viewportHeight: hasWindow ? (window.innerHeight ?? 0) : 0,
    referrer: sanitizeEnvironmentUrl(hasDocument ? document.referrer : '', options),
    url: sanitizeEnvironmentUrl(hasWindow ? window.location?.href : '', options),
  };
}

export function collectEnvInfo(options: EnvCollectionOptions = DEFAULT_ENV_OPTIONS): EnvInfo {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const parsedUserAgent = parseUserAgent(userAgent);

  return {
    userAgent,
    browser: parsedUserAgent.browser,
    browserVersion: parsedUserAgent.browserVersion,
    os: parsedUserAgent.os,
    osVersion: parsedUserAgent.osVersion,
    ...readDynamicEnvInfo(options),
    uid: getUid(),
  };
}

export function refreshEnvInfo(baseEnvInfo: EnvInfo, options: EnvCollectionOptions = DEFAULT_ENV_OPTIONS): EnvInfo {
  const dynamicEnvInfo = readDynamicEnvInfo(options);
  const urlChanged = Boolean(dynamicEnvInfo.url) && dynamicEnvInfo.url !== baseEnvInfo.url;

  return {
    ...baseEnvInfo,
    ...dynamicEnvInfo,
    referrer: urlChanged ? baseEnvInfo.url : baseEnvInfo.referrer || dynamicEnvInfo.referrer,
  };
}
