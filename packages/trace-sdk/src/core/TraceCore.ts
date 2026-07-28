import type { TraceConfig, CommonParams, ITraceCore, EnvInfo, TrackEventData } from '../types';

export class TraceCore implements ITraceCore {
  private config: TraceConfig | null = null;
  private commonParams: CommonParams = {};
  private envInfo: EnvInfo | null = null;

  register(config: TraceConfig): void {
    this.config = { ...config };
    console.log('[TraceGA SDK] Registered with config:', config);
  }

  trackEvent(eventName: string, params?: Record<string, any>): void {
    if (!this.config) {
      console.warn('[TraceGA SDK] Not registered, trackEvent ignored.');
      return;
    }
    const event: TrackEventData = {
      eventName,
      timestamp: Date.now(),
      customParams: params || {},
      commonParams: this.commonParams,
      envInfo: this.envInfo!,
    };
    console.log('[TraceGA SDK] Event tracked:', event);
  }

  addCommonParams(params: CommonParams): void {
    Object.assign(this.commonParams, params);
  }

  removeCommonParams(keys: string[]): void {
    keys.forEach(key => delete this.commonParams[key]);
  }

  setUser(userId: string): void {
    this.commonParams.user_id = userId;
  }

  getEnvInfo(): EnvInfo {
    return this.envInfo!;
  }
}

export const traceCore = new TraceCore();