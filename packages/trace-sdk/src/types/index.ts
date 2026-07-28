export interface TraceConfig {
  projectId: string;
  reportUrl: string;
  sampleRate?: number;
  maxBufferSize?: number;
  flushInterval?: number;
  enableAutoError?: boolean;
  enableAutoPerformance?: boolean;
}

export interface CommonParams {
  [key: string]: any;
}

export interface TrackEventData {
  eventName: string;
  timestamp: number;
  customParams: Record<string, any>;
  commonParams: CommonParams;
  envInfo: EnvInfo;
}

export interface EnvInfo {
  browser: string;
  os: string;
  screen: string;
  viewport: string;
  uid: string;
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
  trackEvent(eventName: string, params?: Record<string, any>): void;
  addCommonParams(params: CommonParams): void;
  removeCommonParams(keys: string[]): void;
  setUser(userId: string): void;
  getEnvInfo(): EnvInfo;
}