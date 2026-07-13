import type { ITraceCore } from '../../types';

/** 错误事件名称 */
export enum ErrorEventName {
  /** JS 运行时错误 */
  JsError = 'js-error',
  /** Promise 未捕获拒绝 */
  PromiseError = 'promise-error',
  /** 资源加载失败 */
  ResourceError = 'resource-error',
  /** HTTP 请求失败 */
  HttpError = 'http-error',
}

export interface ErrorHandler {
  install(core: ITraceCore): void;
  uninstall(): void;
}

export interface ErrorPayloadBase {
  message: string;
  occurredAt: number;
  errorName?: string;
  stack?: string;
}
