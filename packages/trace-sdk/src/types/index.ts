export type CommonParams = Record<string, unknown>;

export type TrackEventParams = Record<string, unknown>;

export type EventPriority = 'urgent' | 'high' | 'normal';

export type EventType = 'custom' | 'click' | 'page_view' | 'exposure' | 'error' | 'performance' | (string & Record<never, never>);

export type BuiltinPluginName = 'error' | 'event' | 'performance' | 'whiteScreen';

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

export interface WhiteScreenPluginConfig {
  /** 可视元素数量阈值，低于此值判定为白屏，默认 2 */
  threshold?: number;
  /** 采样率 0-1，默认 1 */
  sampleRate?: number;
  /** 是否启用像素对比增强检测，默认 false */
  enablePixelCompare?: boolean;
  /** 像素对比方差阈值，默认 100 */
  pixelVarianceThreshold?: number;
  /** 多轮检测时间点（毫秒），默认 [3000, 6000, 10000] */
  detectRounds?: number[];
}

export interface TraceConfig {
  /** @deprecated 请使用 appId */
  projectId?: string;
  appId: string;
  reportUrl: string;
  sampleRate?: number;
  maxBufferSize?: number;
  flushInterval?: number;
  maxConcurrentRequests?: number;
  enableAutoError?: boolean;
  enableDebug?: boolean;
  includeUrlQuery?: boolean;
  includeUrlHash?: boolean;
  plugins?: BuiltinPluginsConfig;
  errorPlugin?: ErrorPluginConfig;
  eventPlugin?: EventPluginConfig;
  performancePlugin?: PerformancePluginConfig;
  whiteScreenPlugin?: WhiteScreenPluginConfig;
  hooks?: TraceLifecycleHooks;
}

export interface ResolvedTraceConfig {
  appId: string;
  reportUrl: string;
  sampleRate: number;
  maxBufferSize: number;
  flushInterval: number;
  maxConcurrentRequests: number;
  enableAutoError: boolean;
  enableDebug: boolean;
  includeUrlQuery: boolean;
  includeUrlHash: boolean;
  plugins: Readonly<BuiltinPluginsConfig>;
  errorPlugin: Readonly<ErrorPluginConfig>;
  eventPlugin: Readonly<EventPluginConfig>;
  performancePlugin: Readonly<PerformancePluginConfig>;
  whiteScreenPlugin: Readonly<WhiteScreenPluginConfig>;
  hooks: TraceLifecycleHooks;
}

export interface EnvInfo {
  userAgent: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  referrer: string;
  url: string;
  uid: string;
}

export interface TrackEventData {
  eventType: EventType;
  eventName: string;
  appId: string;
  userId?: string;
  sessionId?: string;
  properties: TrackEventParams;
  timestamp: number;
  url: string;
  referrer: string;
}

export interface TraceLifecycleHooks {
  onReady?: (config: Readonly<ResolvedTraceConfig>) => void;
  onBeforeTrack?: (event: TrackEventData) => TrackEventData | false | void;
  onTrack?: (event: TrackEventData) => void;
  onError?: (error: unknown, context?: string) => void;
}

export interface TraceReporter {
  report(event: TrackEventData, priority: EventPriority): void | Promise<void>;
  flush?(): void | Promise<void>;
  destroy?(): void | Promise<void>;
}

export interface ITraceCore {
  register(config: TraceConfig): void;
  trackEvent(eventName: string, params?: TrackEventParams, priority?: EventPriority, eventType?: EventType): void;
  addCommonParams(params: CommonParams): void;
  removeCommonParams(keys: string[]): void;
  getCommonParams(): CommonParams;
  setUser(userId: string): void;
  getEnvInfo(): EnvInfo | null;
  getConfig(): Readonly<ResolvedTraceConfig> | null;
  setReporter(reporter: TraceReporter | null): void;
  flush(): void;
  destroy(): void;
}

export interface TracePlugin {
  name: string;
  install(core: ITraceCore): void;
  uninstall(): void;
}
