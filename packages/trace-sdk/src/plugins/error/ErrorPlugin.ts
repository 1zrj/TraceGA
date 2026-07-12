import type { ErrorPluginConfig, ITraceCore, TracePlugin } from '../../types';
import { HttpErrorHandler } from './handlers/HttpErrorHandler';
import { JsErrorHandler } from './handlers/JsErrorHandler';
import { PromiseErrorHandler } from './handlers/PromiseErrorHandler';
import { ResourceErrorHandler } from './handlers/ResourceErrorHandler';
import type { ErrorHandler } from './types';

const ERROR_HANDLER_FACTORIES: Array<{
  key: keyof ErrorPluginConfig;
  create: (reportUrl?: string) => ErrorHandler;
}> = [
  { key: 'js', create: () => new JsErrorHandler() },
  { key: 'promise', create: () => new PromiseErrorHandler() },
  { key: 'resource', create: () => new ResourceErrorHandler() },
  { key: 'http', create: reportUrl => new HttpErrorHandler(reportUrl) },
];

export class ErrorPlugin implements TracePlugin {
  name = 'ErrorPlugin';

  private installed = false;
  private readonly handlers: ErrorHandler[];

  constructor(config: ErrorPluginConfig = {}, reportUrl?: string) {
    const mergedConfig: Required<ErrorPluginConfig> = {
      js: true,
      promise: true,
      resource: true,
      http: true,
      ...config,
    };

    this.handlers = ERROR_HANDLER_FACTORIES.filter(({ key }) => mergedConfig[key]).map(({ create }) => create(reportUrl));
  }

  install(core: ITraceCore): void {
    if (this.installed) {
      return;
    }

    this.handlers.forEach(handler => handler.install(core));
    this.installed = true;
  }

  uninstall(): void {
    if (!this.installed) {
      return;
    }

    this.handlers.forEach(handler => handler.uninstall());
    this.installed = false;
  }
}
