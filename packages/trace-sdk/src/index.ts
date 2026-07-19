// 主类
export { Reporter } from './reporter/index';

// 核心类型
export type { TrackEventData, TraceConfig, EnvInfo, CommonParams, ITraceCore } from './types';

// 优先级类型
export type { Priority } from './core/PriorityScheduler';

// 版本号
export const reporterVersion = '0.0.1';
export const pluginVersion = '0.0.1';
export const utilsVersion = '0.0.1';
