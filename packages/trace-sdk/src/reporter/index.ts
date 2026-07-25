import type { TraceConfig, CommonParams, TrackEventData, EnvInfo } from '../types';
import { PriorityScheduler } from '../core/PriorityScheduler';
import { HttpTransporter } from '../core/HttpTransporter';
import { LifecycleManager } from '../core/LifecycleManager';
import { StoragePersister } from '../utils/StoragePersister';
import { ConcurrencyLimiter } from '../core/ConcurrencyLimiter';

/** 默认配置 */
const DEFAULT_CONFIG: Partial<TraceConfig> = {
  sampleRate: 1,
  maxBufferSize: 30,
  flushInterval: 5000,
};

/** 事件钩子类型 */
type ReporterEvent = 'success' | 'failed' | 'retry';
type EventCallback = (meta: any) => void;

/**
 * Reporter 主类，实现 ITraceCore 接口，组合所有核心模块。
 *
 * 架构：
 * ```
 * Reporter
 *   ├── PriorityScheduler  — 三队列优先级调度
 *   ├── HttpTransporter    — Fetch + 重试 + 事件钩子
 *   ├── LifecycleManager   — 页面隐藏时 sendBeacon 兜底
 *   ├── StoragePersister   — 失败缓存
 *   └── ConcurrencyLimiter — 并发控制
 * ```
 */
export class Reporter {
  private config!: TraceConfig;
  private scheduler!: PriorityScheduler;
  private transporter!: HttpTransporter;
  private lifecycle!: LifecycleManager;
  private persister!: StoragePersister;
  private limiter!: ConcurrencyLimiter;
  private commonParams: CommonParams;
  private envInfo!: EnvInfo;
  private listeners: Map<ReporterEvent, EventCallback[]>;
  private registered: boolean;

  constructor(config?: TraceConfig) {
    this.commonParams = {};
    this.listeners = new Map();
    this.registered = false;

    if (config) {
      this.register(config);
    }
  }

  /**
   * 注册（或重新注册）Reporter，初始化所有子模块。
   * 若已注册会先销毁旧实例。
   */
  register(config: TraceConfig): void {
    if (this.registered) {
      this.destroy();
    }

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.commonParams = {};
    this.envInfo = this.collectEnvInfo();

    this.persister = new StoragePersister();
    this.limiter = new ConcurrencyLimiter(5);

    this.transporter = new HttpTransporter({
      baseURL: this.config.reportUrl,
      timeout: 10000,
      persister: this.persister,
    });

    // 将 transporter 的事件钩子转发为 Reporter 事件
    this.transporter.on('success', meta => this.emit('success', meta));
    this.transporter.on('failed', meta => this.emit('failed', meta));
    this.transporter.on('retry', meta => this.emit('retry', meta));

    this.scheduler = new PriorityScheduler({
      maxBufferSize: this.config.maxBufferSize!,
      flushInterval: this.config.flushInterval!,
      onFlush: async (events: TrackEventData[]) => {
        await this.transporter.send(events, events.length);
      },
      persister: this.persister,
      limiter: this.limiter,
    });

    this.lifecycle = new LifecycleManager({
      reportUrl: this.config.reportUrl,
      getRemainingEvents: () => this.scheduler.takeAll(),
      pauseScheduler: () => this.scheduler.pause(),
      destroyScheduler: () => this.scheduler.destroy(),
    });

    this.registered = true;
  }

  /**
   * 注册事件监听器，支持 `'success'`、`'failed'`、`'retry'` 三种事件。
   *
   * @param event - 事件类型
   * @param callback - 回调函数
   */
  on(event: ReporterEvent, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * 移除事件监听器。
   */
  off(event: ReporterEvent, callback: EventCallback): void {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    const idx = cbs.indexOf(callback);
    if (idx !== -1) cbs.splice(idx, 1);
  }

  /**
   * 触发事件，通知所有注册的监听器。
   */
  private emit(event: ReporterEvent, meta: any): void {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    for (const cb of cbs) {
      try {
        cb(meta);
      } catch {
        // 监听器异常不影响主流程
      }
    }
  }

  /**
   * 埋点上报：组装 TrackEventData 并以 normal 优先级入队。
   *
   * @param eventName - 事件名称
   * @param params - 自定义参数
   */
  trackEvent(eventName: string, params?: Record<string, any>): void {
    if (!this.registered) return;

    // 采样过滤
    if (this.config.sampleRate !== undefined && this.config.sampleRate < 1 && Math.random() > this.config.sampleRate) {
      return;
    }

    const event: TrackEventData & {
      customParams: Record<string, any>;
      commonParams: CommonParams;
      envInfo: EnvInfo;
    } = {
      eventType: 'custom',
      eventName,
      appId: this.config.projectId,
      properties: { ...this.commonParams, ...(params ?? {}) },
      timestamp: Date.now(),
      url: this.envInfo.url,
      referrer: this.envInfo.referrer,
      customParams: params ?? {},
      commonParams: { ...this.commonParams },
      envInfo: this.envInfo,
    };

    this.scheduler.add('normal', event);
  }

  /**
   * 添加公共参数，后续所有 trackEvent 调用都会携带。
   */
  addCommonParams(params: CommonParams): void {
    Object.assign(this.commonParams, params);
  }

  /**
   * 移除指定 key 的公共参数。
   */
  removeCommonParams(keys: string[]): void {
    for (const key of keys) {
      delete this.commonParams[key];
    }
  }

  /**
   * 设置用户 ID，会同时更新 envInfo 和公共参数。
   */
  setUser(userId: string): void {
    this.envInfo.uid = userId;
    this.commonParams['uid'] = userId;
  }

  /**
   * 获取当前环境信息。
   */
  getEnvInfo(): EnvInfo {
    return { ...this.envInfo };
  }

  /**
   * 手动立即刷新上报所有缓冲数据。
   */
  flush(): void {
    this.scheduler?.flush();
  }

  /**
   * 销毁 Reporter 及所有子模块。
   */
  destroy(): void {
    this.lifecycle?.destroy();
    this.registered = false;
  }

  /**
   * 采集当前浏览器环境信息。
   */
  private collectEnvInfo(): EnvInfo {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const screenWidth = typeof screen !== 'undefined' ? screen.width : 0;
    const screenHeight = typeof screen !== 'undefined' ? screen.height : 0;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
    return {
      browser: this.detectBrowser(ua),
      browserVersion: '',
      os: this.detectOS(ua),
      osVersion: '',
      screenWidth,
      screenHeight,
      viewportWidth,
      viewportHeight,
      uid: '',
      url: typeof location !== 'undefined' ? location.href : '',
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      userAgent: ua,
    };
  }

  /**
   * 简易浏览器检测。
   */
  private detectBrowser(ua: string): string {
    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('Chrome/')) return 'Chrome';
    if (ua.includes('Firefox/')) return 'Firefox';
    if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
    return 'Unknown';
  }

  /**
   * 简易操作系统检测。
   */
  private detectOS(ua: string): string {
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Unknown';
  }
}
