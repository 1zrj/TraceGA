export { EventType } from '../core/types';

export interface TraceConfig {
  appId: string;
  reportUrl: string;
  sampleRate?: number;
  maxBufferSize?: number;
  flushInterval?: number;
  plugins?: BuiltinPluginsConfig;
  errorPlugin?: ErrorPluginConfig;
  eventPlugin?: EventPluginConfig;
  performancePlugin?: PerformancePluginConfig;
}

export type BuiltinPluginName = 'error' | 'event' | 'performance';

export type BuiltinPluginsConfig = Partial<Record<BuiltinPluginName, boolean>>;

export interface ErrorPluginConfig {
  js?: boolean;
  promise?: boolean;
  resource?: boolean;
  http?: boolean;
}

export interface EventPluginConfig {
  click?: boolean;
  route?: boolean;
  exposure?: boolean;
}

export interface PerformancePluginConfig {
  webVitals?: boolean;
  resource?: boolean;
}

/** 上报到服务端的事件数据结构*/
export interface TrackEventData {
  /** 事件类型（插件大类），如 error / event / performance */
  eventType: string;
  /** 事件名称（具体事件标识），如 js-error / http-error */
  eventName: string;
  /** 项目 ID，注册时由 appId 传入 */
  appId: string;
  /** 事件上报时间戳（毫秒） */
  timestamp: number;
  /** 事件负载数据 */
  properties: Record<string, any>;
  /** 事件发生时的页面 URL */
  url?: string;
  /** 浏览器 User-Agent */
  userAgent?: string;
}

export interface EnvInfo {
  url: string;
  userAgent: string;
}

export interface TracePlugin {
  name: string;
  install: (core: any) => void;
  uninstall: () => void;
}

export interface ITraceCore {
  register(config: TraceConfig): void;
  trackEvent(eventType: string, eventName: string, params?: Record<string, any>): void;
  getEnvInfo(): EnvInfo;
}
export type { TrackEventData as IEvent };
