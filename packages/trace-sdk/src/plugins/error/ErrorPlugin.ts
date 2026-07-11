import type { ITraceCore, TracePlugin } from '../../types';
import { HttpErrorHandler } from './handlers/HttpErrorHandler';
import { JsErrorHandler } from './handlers/JsErrorHandler';
import { PromiseErrorHandler } from './handlers/PromiseErrorHandler';
import { ResourceErrorHandler } from './handlers/ResourceErrorHandler';
import type { ErrorHandler } from './types';

export class ErrorPlugin implements TracePlugin {
  name = 'ErrorPlugin';

  private installed = false;
  private readonly handlers: ErrorHandler[] = [
    new JsErrorHandler(),
    new PromiseErrorHandler(),
    new ResourceErrorHandler(),
    new HttpErrorHandler(),
  ];

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
