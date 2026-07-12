/**
 * 超时错误，当请求超过配置的超时时间时抛出。
 */
export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`请求超时：${timeout}ms`);
    this.name = 'TimeoutError';
  }
}

export interface HttpTransporterConfig {
  baseURL: string;
  headers?: Record<string, string>;
  /** 超时时间（毫秒），默认 10000 */
  timeout?: number;
}

/**
 * 基于 Fetch API 的 HTTP 传输器，内置超时控制与指数退避重试。
 *
 * 重试策略：
 * - 遇到网络断裂、5xx 响应或超时时自动重试
 * - 间隔依次为 1s → 2s → 4s，最多重试 3 次
 * - 全部重试失败后 reject 最终错误
 */
export class HttpTransporter {
  private baseURL: string;
  private headers: Record<string, string>;
  private timeout: number;
  private maxRetries: number;
  private retryDelays: number[];

  constructor(config: HttpTransporterConfig) {
    this.baseURL = config.baseURL;
    this.headers = config.headers ?? {};
    this.timeout = config.timeout ?? 10000;
    this.maxRetries = 3;
    this.retryDelays = [1000, 2000, 4000];
  }

  /**
   * 发送数据到服务端，失败时自动重试。
   *
   * @param data - 待发送的 JSON 数据
   * @returns 请求成功时 resolve 的 Promise
   * @throws 全部重试失败后 reject 最终错误
   */
  send(data: any): Promise<void> {
    return this.requestWithRetry(data, 0);
  }

  /**
   * 带重试的请求执行。
   *
   * @param data - 待发送的数据
   * @param attempt - 当前尝试次数（从 0 开始）
   */
  private async requestWithRetry(data: any, attempt: number): Promise<void> {
    try {
      await this.doRequest(data);
    } catch (error) {
      if (attempt < this.maxRetries) {
        await this.delay(this.retryDelays[attempt]);
        return this.requestWithRetry(data, attempt + 1);
      }
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