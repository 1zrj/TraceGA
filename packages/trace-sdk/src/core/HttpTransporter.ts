import type { StoragePersister } from '../utils/StoragePersister';

/**
 * 超时错误，当请求超过配置的超时时间时抛出。
 */
export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`请求超时：${timeout}ms`);
    this.name = 'TimeoutError';
  }
}

/** 事件类型 */
export type TransporterEvent = 'success' | 'failed' | 'retry';

/** 事件回调 */
export type TransporterCallback = (meta: any) => void;

export interface HttpTransporterConfig {
  baseURL: string;
  headers?: Record<string, string>;
  /** 超时时间（毫秒），默认 10000 */
  timeout?: number;
  /** 持久化工具，用于重试全部失败后缓存数据 */
  persister?: StoragePersister;
}

/**
 * 基于 Fetch API 的 HTTP 传输器，内置超时控制与指数退避重试。
 *
 * 重试策略：
 * - 遇到网络断裂、5xx 响应或超时时自动重试
 * - 间隔依次为 1s → 2s → 4s，最多重试 3 次
 * - 全部重试失败后 reject 最终错误
 *
 * 事件钩子：
 * - `success`：单次请求成功时触发，携带 `{ eventCount, duration }`
 * - `failed`：全部重试失败后触发，携带 `{ error, retryTimes }`
 * - `retry`：每次重试前触发，携带 `{ currentRetry, delay }`
 */
export class HttpTransporter {
  private baseURL: string;
  private headers: Record<string, string>;
  private timeout: number;
  private maxRetries: number;
  private retryDelays: number[];
  private persister: StoragePersister | undefined;
  private listeners: Map<TransporterEvent, TransporterCallback[]>;

  constructor(config: HttpTransporterConfig) {
    this.baseURL = config.baseURL;
    this.headers = config.headers ?? {};
    this.timeout = config.timeout ?? 10000;
    this.maxRetries = 3;
    this.retryDelays = [1000, 2000, 4000];
    this.persister = config.persister;
    this.listeners = new Map();
  }

  /**
   * 注册事件监听器。
   *
   * @param event - 事件类型：`'success'` | `'failed'` | `'retry'`
   * @param callback - 回调函数，接收事件元数据
   */
  on(event: TransporterEvent, callback: TransporterCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * 移除事件监听器。
   *
   * @param event - 事件类型
   * @param callback - 要移除的回调函数引用
   */
  off(event: TransporterEvent, callback: TransporterCallback): void {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    const idx = cbs.indexOf(callback);
    if (idx !== -1) cbs.splice(idx, 1);
  }

  /**
   * 发送数据到服务端，失败时自动重试。
   *
   * @param data - 待发送的 JSON 数据
   * @param eventCount - 本次上报的事件数量，用于 success 钩子，默认 1
   * @returns 请求成功时 resolve 的 Promise
   * @throws 全部重试失败后 reject 最终错误
   */
  send(data: any, eventCount: number = 1): Promise<void> {
    const startTime = Date.now();
    return this.requestWithRetry(data, 0, startTime, eventCount);
  }

  /**
   * 触发事件，通知所有注册的监听器。
   */
  private emit(event: TransporterEvent, meta: any): void {
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
   * 带重试的请求执行。
   *
   * @param data - 待发送的数据
   * @param attempt - 当前尝试次数（从 0 开始）
   * @param startTime - 请求开始时间戳
   * @param eventCount - 事件数量
   */
  private async requestWithRetry(
    data: any,
    attempt: number,
    startTime: number,
    eventCount: number,
  ): Promise<void> {
    try {
      await this.doRequest(data);

      // 成功：触发 success 钩子
      this.emit('success', {
        eventCount,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      if (attempt < this.maxRetries) {
        const delay = this.retryDelays[attempt];

        // 重试前：触发 retry 钩子
        this.emit('retry', {
          currentRetry: attempt + 1,
          delay,
        });

        await this.delay(delay);
        return this.requestWithRetry(data, attempt + 1, startTime, eventCount);
      }

      // 全部重试失败：触发 failed 钩子
      this.emit('failed', {
        error,
        retryTimes: this.maxRetries,
      });

      // 缓存数据到 localStorage
      this.persister?.save('trace_failed_cache', data);
      throw error;
    }
  }

  /**
   * 执行单次 HTTP 请求，带超时控制。
   *
   * @param data - 待发送的 JSON 数据
   */
  private async doRequest(data: any): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new TimeoutError(this.timeout);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 返回一个在指定毫秒后 resolve 的 Promise。
   *
   * @param ms - 延迟毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}