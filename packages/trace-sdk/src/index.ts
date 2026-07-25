// ===== 核心类与单例 =====
export { Reporter } from './reporter/index';
export { TraceCore, traceCore } from './core/TraceCore';
export { DefaultReporter } from './core/DefaultReporter';

// ===== 绑定辅助函数（基于 traceCore 单例） =====
import { traceCore as _core } from './core/TraceCore';

export const register = _core.register.bind(_core);
export const trackEvent = _core.trackEvent.bind(_core);
export const addCommonParams = _core.addCommonParams.bind(_core);
export const getCommonParams = _core.getCommonParams.bind(_core);
export const removeCommonParams = _core.removeCommonParams.bind(_core);
export const setUser = _core.setUser.bind(_core);
export const getEnvInfo = _core.getEnvInfo.bind(_core);
export const getConfig = _core.getConfig.bind(_core);
export const setReporter = _core.setReporter.bind(_core);
export const destroy = _core.destroy.bind(_core);

// ===== 插件 =====
export { ErrorPlugin } from './plugins/error';
export { BehaviorPlugin } from './plugins/behavior';
export { PerformancePlugin } from './plugins/performance';

// ===== 插件事件名常量 =====
export { BehaviorEventName } from './plugins/behavior/types';
export { ErrorEventName } from './plugins/error/types';
export { PERFORMANCE_EVENT_NAME, PerformanceMetricName } from './plugins/performance/types';

// ===== 工具函数 =====
export {
  deepClone,
  safeJsonStringify,
  generateUUID,
  parseUserAgent,
  isPlainObject,
  throttle,
  debounce,
} from './utils';

// ===== 子模块导出（供子路径导入） =====
export {
  sanitizeUrl,
  getCurrentPageUrl,
  getElementMetadata,
  getEventElements,
  findMatchedElement,
  isIgnoredElement,
  validateSelectors,
  validateSelector,
  getSelectorAttributeFilter,
  truncateString,
  safeGetAttribute,
  normalizeIntersectionRatio,
} from './plugins/behavior/utils';
export { subscribeRouteChanges } from './plugins/behavior/routeObserver';
export { collectEnvInfo, refreshEnvInfo, sanitizeEnvironmentUrl } from './core/env';

// ===== 类型 =====
export type {
  TrackEventData,
  TraceConfig,
  EnvInfo,
  CommonParams,
  ITraceCore,
  TracePlugin,
  EventType,
  EventPriority,
  ResolvedTraceConfig,
  TraceLifecycleHooks,
  TraceReporter,
  TrackEventParams,
  ErrorPluginConfig,
  EventPluginConfig,
  PerformancePluginConfig,
  BuiltinPluginsConfig,
} from './types';

export type { Priority } from './core/PriorityScheduler';

export type {
  BehaviorPluginOptions,
  ClickTrackingOptions,
  PageViewTrackingOptions,
  ExposureTrackingOptions,
  ClickBehaviorPayload,
  PageViewBehaviorPayload,
  ExposureBehaviorPayload,
  ResolvedClickTrackingOptions,
  ResolvedPageViewTrackingOptions,
  ResolvedExposureTrackingOptions,
} from './plugins/behavior/types';

export type { ErrorPluginOptions, ErrorPayloadBase } from './plugins/error/types';
export type { HttpErrorPayload } from './plugins/error/handlers/HttpErrorHandler';
export type { JsErrorPayload } from './plugins/error/handlers/JsErrorHandler';
export type { PromiseErrorPayload } from './plugins/error/handlers/PromiseErrorHandler';
export type { ResourceErrorPayload } from './plugins/error/handlers/ResourceErrorHandler';

export type { PerformanceMetricPayload } from './plugins/performance/types';

export type { RouteChange, RouteChangeListener, RouteNavigationType } from './plugins/behavior/routeObserver';
export type { EnvCollectionOptions } from './core/env';
export type { ParsedUserAgent } from './utils';
export type {
  UrlSanitizeOptions,
  ElementMetadata,
  ElementMetadataOptions,
  MatchedElement,
} from './plugins/behavior/utils';

// ===== 兼容旧版 =====
import type { TrackEventData as _TrackEventData } from './types';
/** @deprecated Use `TrackEventData` instead */
export type IEvent = _TrackEventData;

// ===== 运行时 EventType 常量 =====
export const EventTypeConstants = {
  CUSTOM: 'custom',
  CLICK: 'click',
  PAGE_VIEW: 'page_view',
  EXPOSURE: 'exposure',
  ERROR: 'error',
  PERFORMANCE: 'performance',
} as const;

// ===== SDK 版本（构建时注入） =====
declare const __SDK_VERSION__: string;
export const SDK_VERSION = typeof __SDK_VERSION__ !== 'undefined' ? __SDK_VERSION__ : '0.0.1';
