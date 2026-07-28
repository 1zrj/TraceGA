import type { ITraceCore, TracePlugin } from '../../types';
import type { ErrorPluginOptions, ErrorHandler } from './types';
import { JsErrorHandler } from './handlers/JsErrorHandler';
import { PromiseErrorHandler } from './handlers/PromiseErrorHandler';
import { ResourceErrorHandler } from './handlers/ResourceErrorHandler';
import { HttpErrorHandler } from './handlers/HttpErrorHandler';

export class ErrorPlugin implements TracePlugin {
  readonly name = 'error';

  private core: ITraceCore | null = null;
  private options: ErrorPluginOptions;
  private handlers: ErrorHandler[] = [];

  constructor(options?: ErrorPluginOptions) {
    this.options = options ?? {};
  }

  install(core: ITraceCore): void {
    this.core = core;

    const cfg = this.options;

    if (cfg.js !== false) {
      this.handlers.push(new JsErrorHandler());
    }
    if (cfg.promise !== false) {
      this.handlers.push(new PromiseErrorHandler());
    }
    if (cfg.resource !== false) {
      this.handlers.push(new ResourceErrorHandler());
    }
    if (cfg.http !== false) {
      this.handlers.push(new HttpErrorHandler(cfg.reportUrl));
    }

    for (const handler of this.handlers) {
      try {
        handler.install(core);
      } catch (error) {
        this.options.onError?.(error, 'error.install.handler');
      }
    }
  }

  uninstall(): void {
    for (const handler of this.handlers) {
      try {
        handler.uninstall();
      } catch {
        // Ignore individual handler cleanup errors
      }
    }
    this.handlers = [];
    this.core = null;
  }
}
