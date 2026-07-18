import { ErrorPlugin } from '@/plugins/error';
import { PerformancePlugin } from '@/plugins/performance';
import type { TraceConfig, ITraceCore, EnvInfo, TrackEventData, TracePlugin } from '@/types';

export class TraceCore implements ITraceCore {
  private config: TraceConfig | null = null;
  private envInfo: EnvInfo | null = null;
  private plugins: TracePlugin[] = [];

  register(config: TraceConfig): void {
    try {
      this.validateConfig(config);
      this.config = {
        ...config,
        sampleRate: this.normalizeSampleRate(config.sampleRate),
      };
      this.envInfo = this.collectEnvInfo();
      this.resetPlugins();
      this.installBuiltinPlugins(config);
      console.log('[TraceGA SDK] Registered with config:', config);
    } catch (error) {
      this.resetPlugins();
      this.config = null;
      this.envInfo = null;
      console.log('[TraceGA SDK] register failed');
      this.reportRegisterFailure(config?.reportUrl, config?.appId, error);
    }
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

  /**
   * 注册参数校验
   */
  private validateConfig(config: TraceConfig): void {
    if (!config || typeof config.appId !== 'string' || !config.appId.trim()) {
      throw new Error('TraceGA: appId is required');
    }

    if (typeof config.reportUrl !== 'string' || !config.reportUrl.trim()) {
      throw new Error('TraceGA: reportUrl is required');
    }
  }

  /**
   * sdk注册失败，上报服务器
   */
  private reportRegisterFailure(reportUrl: string | undefined, appId: string | undefined, error: unknown): void {
    if (!reportUrl || typeof fetch !== 'function') {
      return;
    }

    const payload = JSON.stringify({
      eventType: 'sdk',
      eventName: 'register-failed',
      appId: appId ?? '',
      timestamp: Date.now(),
      url: this.getCurrentUrl(),
      userAgent: this.getUserAgent(),
      properties: {
        message: error instanceof Error ? error.message : String(error),
      },
    });

    void fetch(reportUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
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
