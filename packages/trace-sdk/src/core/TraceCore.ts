import { ErrorPlugin } from '../plugins/error';
import { PerformancePlugin } from '../plugins/performance';
import type { TraceConfig, ITraceCore, EnvInfo, TrackEventData, TracePlugin } from '../types';

export class TraceCore implements ITraceCore {
  private config: TraceConfig | null = null;
  private envInfo: EnvInfo | null = null;
  private plugins: TracePlugin[] = [];

  register(config: TraceConfig): void {
    this.config = {
      ...config,
      sampleRate: this.normalizeSampleRate(config.sampleRate),
    };
    this.envInfo = this.collectEnvInfo();
    this.resetPlugins();
    this.installBuiltinPlugins(config);
    console.log('[TraceGA SDK] Registered with config:', config);
  }

  trackEvent(eventType: string, eventName: string, params?: Record<string, any>): void {
    if (!this.config) {
      console.warn('[TraceGA SDK] Not registered, trackEvent ignored.');
      return;
    }

    if (!this.shouldSampleEvent()) {
      return;
    }

    const event: TrackEventData = {
      eventType,
      eventName,
      appId: this.config.appId,
      timestamp: Date.now(),
      properties: params || {},
      url: this.getCurrentUrl(),
      userAgent: this.getUserAgent(),
    };
    console.log('[TraceGA SDK] Event tracked:', event);
  }

  getEnvInfo(): EnvInfo {
    this.envInfo = this.collectEnvInfo();

    return this.envInfo;
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
      this.installPlugin(new PerformancePlugin(config.performancePlugin));
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

  private shouldSampleEvent(): boolean {
    const sampleRate = this.config?.sampleRate ?? 1;

    return sampleRate >= 1 || Math.random() < sampleRate;
  }

  private normalizeSampleRate(sampleRate = 1): number {
    if (!Number.isFinite(sampleRate)) {
      return 1;
    }

    return Math.min(1, Math.max(0, sampleRate));
  }

  private collectEnvInfo(): EnvInfo {
    return {
      url: this.getCurrentUrl(),
      userAgent: this.getUserAgent(),
    };
  }

  private getCurrentUrl(): string {
    return typeof window !== 'undefined' ? window.location.href : '';
  }

  private getUserAgent(): string {
    return typeof navigator !== 'undefined' ? navigator.userAgent : '';
  }
}

export const traceCore = new TraceCore();
