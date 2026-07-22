import type { TraceConfig, CommonParams, ITraceCore, EnvInfo } from '../types';
export declare class TraceCore implements ITraceCore {
    private config;
    private commonParams;
    private envInfo;
    register(config: TraceConfig): void;
    trackEvent(eventName: string, params?: Record<string, any>): void;
    addCommonParams(params: CommonParams): void;
    removeCommonParams(keys: string[]): void;
    setUser(userId: string): void;
    getEnvInfo(): EnvInfo;
}
export declare const traceCore: TraceCore;
