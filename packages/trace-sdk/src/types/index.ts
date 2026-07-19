export type CommonParams = Record<string, unknown>;

export type TrackEventParams = Record<string, unknown>;

export type EventPriority = 'urgent' | 'high' | 'normal';

export type EventType = 'custom' | 'click' | 'page_view' | 'exposure' | 'error' | 'performance' | (string & Record<never, never>);

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

export interface TraceConfig {
  projectId: string;
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
  hooks?: TraceLifecycleHooks;
}

export interface ResolvedTraceConfig {
  projectId: string;
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
  destroy(): void;
}

export interface TracePlugin {
  name: string;
  install(core: ITraceCore): void;
  uninstall(): void;
}
