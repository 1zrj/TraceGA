import type {
  CommonParams,
  EnvInfo,
  EventPriority,
  EventType,
  ITraceCore,
  ResolvedTraceConfig,
  TraceConfig,
  TraceLifecycleHooks,
  TraceReporter,
  TrackEventData,
  TrackEventParams,
} from '../types';
import { ErrorPlugin } from '../plugins/error/ErrorPlugin';
import { BehaviorPlugin } from '../plugins/behavior/BehaviorPlugin';
import { PerformancePlugin } from '../plugins/performance/PerformancePlugin';
import { deepClone, isPlainObject } from '../utils';
import { DefaultReporter } from './DefaultReporter';
import { collectEnvInfo, refreshEnvInfo } from './env';

const DEFAULT_CONFIG = {
  sampleRate: 1,
  maxBufferSize: 20,
  flushInterval: 3000,
  maxConcurrentRequests: 3,
  enableAutoError: false,
  enableDebug: false,
  includeUrlQuery: false,
  includeUrlHash: false,
} as const;

const MAX_BATCH_SIZE = 20;

export class TraceCore implements ITraceCore {
  private config: ResolvedTraceConfig | null = null;
  private commonParams: CommonParams = Object.create(null) as CommonParams;
  private envInfo: EnvInfo | null = null;
  private reporter: TraceReporter | null = null;
  private managedReporter: DefaultReporter | null = null;
  private reporterOverridden = false;
  private errorPlugin: ErrorPlugin | null = null;
  private behaviorPlugin: BehaviorPlugin | null = null;
  private performancePlugin: PerformancePlugin | null = null;

  register(config: TraceConfig): void {
    let hooks: TraceLifecycleHooks | undefined;

    try {
      hooks = this.resolveHooks(config);
      this.assertConfig(config);

      const resolvedConfig = Object.freeze({
        ...DEFAULT_CONFIG,
        projectId: config.projectId.trim(),
        reportUrl: config.reportUrl.trim(),
        sampleRate: this.resolveSampleRate(config.sampleRate, DEFAULT_CONFIG.sampleRate),
        maxBufferSize: this.resolveBufferSize(config.maxBufferSize, DEFAULT_CONFIG.maxBufferSize),
        flushInterval: this.resolvePositiveInteger(config.flushInterval, DEFAULT_CONFIG.flushInterval, 'flushInterval'),
        maxConcurrentRequests: this.resolvePositiveInteger(config.maxConcurrentRequests, DEFAULT_CONFIG.maxConcurrentRequests, 'maxConcurrentRequests'),
        enableAutoError: this.resolveBoolean(config.enableAutoError, DEFAULT_CONFIG.enableAutoError, 'enableAutoError'),
        enableDebug: this.resolveBoolean(config.enableDebug, DEFAULT_CONFIG.enableDebug, 'enableDebug'),
        includeUrlQuery: this.resolveBoolean(config.includeUrlQuery, DEFAULT_CONFIG.includeUrlQuery, 'includeUrlQuery'),
        includeUrlHash: this.resolveBoolean(config.includeUrlHash, DEFAULT_CONFIG.includeUrlHash, 'includeUrlHash'),
        plugins: this.resolvePluginConfig(config.plugins, 'plugins'),
        errorPlugin: this.resolvePluginConfig(config.errorPlugin, 'errorPlugin'),
        eventPlugin: this.resolvePluginConfig(config.eventPlugin, 'eventPlugin'),
        performancePlugin: this.resolvePluginConfig(config.performancePlugin, 'performancePlugin'),
        hooks: Object.freeze(hooks),
      }) as ResolvedTraceConfig;

      this.config = resolvedConfig;
      this.envInfo = collectEnvInfo(this.getEnvCollectionOptions());
      this.configureManagedReporter(resolvedConfig);
      this.syncBuiltinPlugins(resolvedConfig);
      const configSnapshot = deepClone(resolvedConfig);
      this.runHook(() => resolvedConfig.hooks.onReady?.(configSnapshot), 'onReady');
    } catch (error) {
      // Do not read config again here: an accessor on the caller's object may
      // be the original failure and must never escape the SDK boundary.
      this.handleError(error, 'register', hooks);
    }
  }

  trackEvent(eventName: string, params: TrackEventParams = {}, priority: EventPriority = 'normal', eventType: EventType = 'custom'): void {
    try {
      if (!this.config || !this.envInfo) {
        return;
      }

      const normalizedEventName = eventName?.trim();
      if (!normalizedEventName) {
        throw new TypeError('eventName must be a non-empty string');
      }
      if (!isPlainObject(params)) {
        throw new TypeError('params must be a plain object');
      }
      if (!['urgent', 'high', 'normal'].includes(priority)) {
        throw new TypeError('priority must be urgent, high, or normal');
      }
      const normalizedEventType = this.resolveEventType(eventType);
      if (!this.shouldSample()) {
        return;
      }

      const currentEnvInfo = refreshEnvInfo(this.envInfo, this.getEnvCollectionOptions());
      this.envInfo = currentEnvInfo;
      const commonParams = this.getCommonParams();
      const properties = this.buildProperties(commonParams, params, currentEnvInfo);
      let event: TrackEventData = {
        eventType: normalizedEventType,
        eventName: normalizedEventName,
        appId: this.config.projectId,
        userId: this.readIdentity(commonParams, ['userId', 'user_id']),
        sessionId: this.readIdentity(commonParams, ['sessionId', 'session_id']),
        properties,
        timestamp: Date.now(),
        url: this.readEventLocation(params, 'pageUrl') ?? currentEnvInfo.url,
        referrer: this.readEventLocation(params, 'previousUrl') ?? currentEnvInfo.referrer,
      };

      const beforeTrackResult = this.config.hooks.onBeforeTrack?.(event);
      if (beforeTrackResult === false) {
        return;
      }
      if (beforeTrackResult) {
        event = beforeTrackResult;
      }

      event = this.normalizeEvent(event);
      this.report(event, priority);
      this.runHook(() => this.config?.hooks.onTrack?.(event), 'onTrack');
    } catch (error) {
      this.handleError(error, 'trackEvent');
    }
  }

  addCommonParams(params: CommonParams): void {
    try {
      if (!isPlainObject(params)) {
        throw new TypeError('common params must be a plain object');
      }
      const clonedParams = deepClone(params);
      Object.keys(clonedParams).forEach(key => {
        const descriptor = Object.getOwnPropertyDescriptor(clonedParams, key);
        if (!descriptor || !('value' in descriptor)) {
          throw new TypeError('common params cannot contain accessor properties');
        }

        Object.defineProperty(this.commonParams, key, {
          configurable: true,
          enumerable: true,
          value: descriptor.value,
          writable: true,
        });
      });
    } catch (error) {
      this.handleError(error, 'addCommonParams');
    }
  }

  removeCommonParams(keys: string[]): void {
    try {
      if (!Array.isArray(keys)) {
        throw new TypeError('keys must be an array');
      }
      keys.forEach(key => {
        if (typeof key === 'string') {
          delete this.commonParams[key];
        }
      });
    } catch (error) {
      this.handleError(error, 'removeCommonParams');
    }
  }

  getCommonParams(): CommonParams {
    try {
      return deepClone(this.commonParams);
    } catch (error) {
      this.handleError(error, 'getCommonParams');
      return Object.create(null) as CommonParams;
    }
  }

  setUser(userId: string): void {
    try {
      if (typeof userId !== 'string' || !userId.trim()) {
        throw new TypeError('userId must be a non-empty string');
      }
      this.commonParams.userId = userId.trim();
      delete this.commonParams.user_id;
    } catch (error) {
      this.handleError(error, 'setUser');
    }
  }

  getEnvInfo(): EnvInfo | null {
    try {
      if (!this.envInfo || !this.config) {
        return null;
      }
      this.envInfo = refreshEnvInfo(this.envInfo, this.getEnvCollectionOptions());
      return deepClone(this.envInfo);
    } catch (error) {
      this.handleError(error, 'getEnvInfo');
      return null;
    }
  }

  getConfig(): Readonly<ResolvedTraceConfig> | null {
    try {
      return this.config ? deepClone(this.config) : null;
    } catch (error) {
      this.handleError(error, 'getConfig');
      return null;
    }
  }

  setReporter(reporter: TraceReporter | null): void {
    try {
      if (reporter !== null && typeof reporter.report !== 'function') {
        throw new TypeError('reporter must implement report(event)');
      }
      this.disposeManagedReporter();
      this.reporterOverridden = true;
      this.reporter = reporter;
    } catch (error) {
      this.handleError(error, 'setReporter');
    }
  }

  destroy(): void {
    try {
      this.disposeBuiltinPlugins();

      const reporter = this.reporter;
      this.reporter = null;
      this.managedReporter = null;
      this.disposeReporter(reporter);

      this.config = null;
      this.envInfo = null;
      this.commonParams = Object.create(null) as CommonParams;
      this.reporterOverridden = false;
    } catch (error) {
      this.handleError(error, 'destroy');
    }
  }

  private shouldSample(): boolean {
    const sampleRate = this.config?.sampleRate ?? 0;
    if (sampleRate <= 0) {
      return false;
    }
    if (sampleRate >= 1) {
      return true;
    }
    return Math.random() < sampleRate;
  }

  private resolveEventType(eventType: EventType): EventType {
    if (typeof eventType !== 'string' || !eventType.trim()) {
      throw new TypeError('eventType must be a non-empty string');
    }

    return eventType.trim() as EventType;
  }

  private buildProperties(commonParams: CommonParams, customParams: TrackEventParams, envInfo: EnvInfo): TrackEventParams {
    const properties = Object.create(null) as TrackEventParams;
    const environmentProperties: TrackEventParams = {
      uid: envInfo.uid,
      userAgent: envInfo.userAgent,
      browser: envInfo.browser,
      browserVersion: envInfo.browserVersion,
      os: envInfo.os,
      osVersion: envInfo.osVersion,
      screenWidth: envInfo.screenWidth,
      screenHeight: envInfo.screenHeight,
      viewportWidth: envInfo.viewportWidth,
      viewportHeight: envInfo.viewportHeight,
    };

    this.copyProperties(properties, environmentProperties);
    this.copyProperties(properties, commonParams, new Set(['userId', 'user_id', 'sessionId', 'session_id']));
    this.copyProperties(properties, deepClone(customParams));
    return properties;
  }

  private copyProperties(target: TrackEventParams, source: Record<string, unknown>, excludedKeys = new Set<string>()): void {
    Object.keys(source).forEach(key => {
      if (excludedKeys.has(key)) {
        return;
      }

      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (!descriptor || !('value' in descriptor)) {
        throw new TypeError('event properties cannot contain accessors');
      }

      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        value: descriptor.value,
        writable: true,
      });
    });
  }

  private readIdentity(params: CommonParams, keys: readonly string[]): string | undefined {
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(params, key);
      if (!descriptor || !('value' in descriptor)) {
        continue;
      }
      if (typeof descriptor.value === 'string' && descriptor.value.trim()) {
        return descriptor.value.trim();
      }
    }
    return undefined;
  }

  private readEventLocation(params: TrackEventParams, key: 'pageUrl' | 'previousUrl'): string | undefined {
    const descriptor = Object.getOwnPropertyDescriptor(params, key);
    if (descriptor && 'value' in descriptor && typeof descriptor.value === 'string' && descriptor.value.trim()) {
      return descriptor.value.trim();
    }
    return undefined;
  }

  private assertEvent(event: TrackEventData): void {
    if (
      !event ||
      typeof event.eventType !== 'string' ||
      !event.eventType.trim() ||
      typeof event.eventName !== 'string' ||
      !event.eventName.trim() ||
      typeof event.appId !== 'string' ||
      !event.appId.trim() ||
      !isPlainObject(event.properties) ||
      typeof event.timestamp !== 'number' ||
      !Number.isFinite(event.timestamp) ||
      typeof event.url !== 'string' ||
      typeof event.referrer !== 'string'
    ) {
      throw new TypeError('track event does not match the backend schema');
    }
  }

  private normalizeEvent(event: TrackEventData): TrackEventData {
    this.assertEvent(event);

    const properties = Object.create(null) as TrackEventParams;
    this.copyProperties(properties, deepClone(event.properties));

    const normalizedEvent: TrackEventData = {
      eventType: event.eventType.trim() as EventType,
      eventName: event.eventName.trim(),
      appId: event.appId.trim(),
      properties,
      timestamp: event.timestamp,
      url: event.url,
      referrer: event.referrer,
    };
    const userId = this.normalizeOptionalIdentity(event.userId, 'userId');
    const sessionId = this.normalizeOptionalIdentity(event.sessionId, 'sessionId');

    if (userId) {
      normalizedEvent.userId = userId;
    }
    if (sessionId) {
      normalizedEvent.sessionId = sessionId;
    }

    return normalizedEvent;
  }

  private normalizeOptionalIdentity(value: string | undefined, fieldName: 'userId' | 'sessionId'): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string' || !value.trim()) {
      throw new TypeError(`${fieldName} must be a non-empty string`);
    }
    return value.trim();
  }

  private report(event: TrackEventData, priority: EventPriority): void {
    try {
      const reportResult = this.reporter?.report(event, priority);
      if (reportResult) {
        void Promise.resolve(reportResult).catch(error => {
          this.handleError(error, 'report');
        });
      }
    } catch (error) {
      this.handleError(error, 'report');
    }
  }

  private assertConfig(config: TraceConfig): void {
    if (!config || typeof config !== 'object') {
      throw new TypeError('config is required');
    }
    if (typeof config.projectId !== 'string' || !config.projectId.trim()) {
      throw new TypeError('projectId must be a non-empty string');
    }
    if (typeof config.reportUrl !== 'string' || !config.reportUrl.trim()) {
      throw new TypeError('reportUrl must be a non-empty string');
    }

    const parsedUrl = new URL(config.reportUrl, 'http://tracega.local');
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new TypeError('reportUrl must use http or https');
    }
  }

  private resolveHooks(config: unknown): TraceLifecycleHooks {
    if (!config || typeof config !== 'object') {
      return {};
    }

    const rawHooks = (config as { hooks?: unknown }).hooks;
    if (rawHooks === undefined || rawHooks === null) {
      return {};
    }
    if (!isPlainObject(rawHooks)) {
      throw new TypeError('hooks must be a plain object');
    }

    const { onReady, onBeforeTrack, onTrack, onError } = rawHooks as Partial<TraceLifecycleHooks>;
    const hookEntries = [onReady, onBeforeTrack, onTrack, onError];
    if (hookEntries.some(hook => hook !== undefined && typeof hook !== 'function')) {
      throw new TypeError('hooks must be functions');
    }

    return { onReady, onBeforeTrack, onTrack, onError };
  }

  private resolveSampleRate(value: number | undefined, fallback: number): number {
    if (value === undefined) {
      return fallback;
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError('sampleRate must be between 0 and 1');
    }
    return value;
  }

  private resolveBufferSize(value: number | undefined, fallback: number): number {
    const resolved = this.resolvePositiveInteger(value, fallback, 'maxBufferSize');
    if (resolved > MAX_BATCH_SIZE) {
      throw new RangeError(`maxBufferSize cannot exceed ${MAX_BATCH_SIZE}`);
    }
    return resolved;
  }

  private resolvePositiveInteger(value: number | undefined, fallback: number, fieldName: string): number {
    if (value === undefined) {
      return fallback;
    }
    if (!Number.isInteger(value) || value <= 0) {
      throw new RangeError(`${fieldName} must be a positive integer`);
    }
    return value;
  }

  private resolveBoolean(value: boolean | undefined, fallback: boolean, fieldName: string): boolean {
    if (value === undefined) {
      return fallback;
    }
    if (typeof value !== 'boolean') {
      throw new TypeError(`${fieldName} must be a boolean`);
    }
    return value;
  }

  private resolvePluginConfig<T extends object>(value: T | undefined, fieldName: string): Readonly<T> {
    if (value === undefined) {
      return Object.freeze({}) as Readonly<T>;
    }
    if (!isPlainObject(value)) {
      throw new TypeError(`${fieldName} must be a plain object`);
    }
    if (Object.values(value).some(option => typeof option !== 'boolean')) {
      throw new TypeError(`${fieldName} options must be booleans`);
    }

    return Object.freeze({ ...value });
  }

  private getEnvCollectionOptions(): {
    includeQuery: boolean;
    includeHash: boolean;
  } {
    return {
      includeQuery: this.config?.includeUrlQuery ?? false,
      includeHash: this.config?.includeUrlHash ?? false,
    };
  }

  private configureManagedReporter(config: Readonly<ResolvedTraceConfig>): void {
    if (this.reporterOverridden || typeof window === 'undefined') {
      return;
    }

    this.disposeManagedReporter();
    const reporter = new DefaultReporter(config, (error, context) => {
      this.handleError(error, context);
    });
    this.managedReporter = reporter;
    this.reporter = reporter;
  }

  private disposeManagedReporter(): void {
    if (!this.managedReporter) {
      return;
    }

    const reporter = this.managedReporter;
    this.managedReporter = null;
    if (this.reporter === reporter) {
      this.reporter = null;
    }
    this.disposeReporter(reporter);
  }

  private disposeReporter(reporter: TraceReporter | null): void {
    try {
      const result = reporter?.destroy?.();
      if (result) {
        void Promise.resolve(result).catch(error => {
          this.handleError(error, 'reporter.destroy');
        });
      }
    } catch (error) {
      this.handleError(error, 'reporter.destroy');
    }
  }

  private syncBuiltinPlugins(config: Readonly<ResolvedTraceConfig>): void {
    this.disposeBuiltinPlugins();

    if (config.enableAutoError || config.plugins.error) {
      this.errorPlugin = new ErrorPlugin({
        ...config.errorPlugin,
        reportUrl: config.reportUrl,
        onError: (error, context) => this.handleError(error, context),
      });
      this.errorPlugin.install(this);
    }

    if (config.plugins.event) {
      this.behaviorPlugin = new BehaviorPlugin({
        click: config.eventPlugin.click === false ? false : undefined,
        pageView: config.eventPlugin.route === false ? false : undefined,
        exposure: config.eventPlugin.exposure === false ? false : undefined,
        onError: (error, context) => this.handleError(error, context),
      });
      this.behaviorPlugin.install(this);
    }

    if (config.plugins.performance) {
      this.performancePlugin = new PerformancePlugin(config.performancePlugin);
      this.performancePlugin.install(this);
    }
  }

  private disposeBuiltinPlugins(): void {
    this.performancePlugin?.uninstall();
    this.performancePlugin = null;
    this.behaviorPlugin?.uninstall();
    this.behaviorPlugin = null;
    this.errorPlugin?.uninstall();
    this.errorPlugin = null;
  }

  private runHook(callback: () => void, context: string): void {
    try {
      callback();
    } catch (error) {
      this.handleError(error, context);
    }
  }

  private handleError(error: unknown, context: string, hooks?: TraceLifecycleHooks): void {
    try {
      (hooks ?? this.config?.hooks)?.onError?.(error, context);
    } catch {
      // Lifecycle errors must never escape the SDK boundary.
    }
  }
}

export const traceCore = new TraceCore();
