import { ErrorPlugin } from '../plugins/error';
import type { TraceConfig, CommonParams, ITraceCore, EnvInfo, TrackEventData, TracePlugin } from '../types';

export class TraceCore implements ITraceCore {
  private config: TraceConfig | null = null;
  private commonParams: CommonParams = {};
  private envInfo: EnvInfo | null = null;
  private plugins: TracePlugin[] = [];

  register(config: TraceConfig): void {
    this.config = { ...config };
    this.resetPlugins();
    this.installBuiltinPlugins(config);
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

  private installBuiltinPlugins(config: TraceConfig): void {
    const pluginsConfig = config.plugins ?? {};

    if (pluginsConfig.error) {
      this.installPlugin(new ErrorPlugin(config.errorPlugin, config.reportUrl));
    }

    if (pluginsConfig.event) {
      console.warn('[TraceGA SDK] EventPlugin is enabled but not implemented yet.');
    }

    if (pluginsConfig.performance) {
      console.warn('[TraceGA SDK] PerformancePlugin is enabled but not implemented yet.');
    }
  }

  private installPlugin(plugin: TracePlugin): void {
    plugin.install(this);
    this.plugins.push(plugin);
  }

  private resetPlugins(): void {
    this.plugins.forEach(plugin => plugin.uninstall());
    this.plugins = [];
  }
}

export const traceCore = new TraceCore();
