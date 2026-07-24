// ─── 基础类型别名 ───────────────────────────────────────────

/** 公共参数，所有事件自动附加的键值对 */
export type CommonParams = Record<string, unknown>

/** 自定义事件参数，单次 trackEvent 携带的附加数据 */
export type TrackEventParams = Record<string, unknown>

/** 事件上报优先级，控制调度器出队顺序 */
export type EventPriority = 'urgent' | 'high' | 'normal'

/**
 * 事件类型。
 * 支持预定义字面量 + 任意 string 扩展，方便 IDE 自动补全。
 */
export type EventType = 'custom' | 'click' | 'page_view' | 'exposure' | 'error' | 'performance' | (string & Record<never, never>)

// ─── 内置插件开关 ───────────────────────────────────────────

/** 内置插件名称 */
export type BuiltinPluginName = 'error' | 'event' | 'performance'

/** 内置插件启用/禁用配置，key 为插件名，value 为 true 启用 */
export type BuiltinPluginsConfig = Partial<Record<BuiltinPluginName, boolean>>

// ─── 插件详细配置 ───────────────────────────────────────────

/** 错误监控插件配置 */
export interface ErrorPluginConfig {
  /** 是否捕获 JS 运行时错误，默认 true */
  js?: boolean
  /** 是否捕获未处理的 Promise 拒绝，默认 true */
  promise?: boolean
  /** 是否捕获静态资源加载失败，默认 true */
  resource?: boolean
  /** 是否捕获 HTTP 请求异常，默认 true */
  http?: boolean
}

/** 事件（行为）埋点插件配置 */
export interface EventPluginConfig {
  /** 是否启用点击埋点，默认 true */
  click?: boolean
  /** 是否启用路由变化埋点，默认 true */
  route?: boolean
  /** 是否启用元素曝光埋点，默认 true */
  exposure?: boolean
}

/** 性能监控插件配置 */
export interface PerformancePluginConfig {
  /** 是否采集 Web Vitals（LCP / FID / CLS / FCP / TTFB），默认 true */
  webVitals?: boolean
  /** 是否采集静态资源加载性能，默认 true */
  resource?: boolean
}

// ─── 核心配置 ───────────────────────────────────────────────

/** 生命周期钩子，需前置声明，在 TraceConfig 中引用 */
export interface TraceLifecycleHooks {
  /** SDK 初始化完成后回调 */
  onReady?: (config: Readonly<ResolvedTraceConfig>) => void
  /**
   * 事件上报前回调。
   * @returns 返回 false 丢弃事件，返回 TrackEventData 替换原事件，返回 void 原样通过
   */
  onBeforeTrack?: (event: TrackEventData) => TrackEventData | false | void
  /** 事件成功上报后回调 */
  onTrack?: (event: TrackEventData) => void
  /** SDK 内部异常回调 */
  onError?: (error: unknown, context?: string) => void
}

/** TraceGA SDK 初始化配置（用户传入） */
export interface TraceConfig {
  /** 项目 ID，必填 */
  projectId: string
  /** 上报地址，必填 */
  reportUrl: string
  /** 采样率 0-1，默认 1 */
  sampleRate?: number
  /** 缓冲区最大容量，达到后立即触发上报，默认 50 */
  maxBufferSize?: number
  /** 定时刷新间隔（毫秒），默认 10000 */
  flushInterval?: number
  /** 最大并发请求数，默认 5 */
  maxConcurrentRequests?: number
  /** 是否自动捕获全局错误，默认 true */
  enableAutoError?: boolean
  /** 是否开启调试模式，默认 false */
  enableDebug?: boolean
  /** 是否将 URL Query 参数附加到事件，默认 false */
  includeUrlQuery?: boolean
  /** 是否将 URL Hash 附加到事件，默认 false */
  includeUrlHash?: boolean
  /** 内置插件开关 */
  plugins?: BuiltinPluginsConfig
  /** 错误插件详细配置 */
  errorPlugin?: ErrorPluginConfig
  /** 事件插件详细配置 */
  eventPlugin?: EventPluginConfig
  /** 性能插件详细配置 */
  performancePlugin?: PerformancePluginConfig
  /** 生命周期钩子 */
  hooks?: TraceLifecycleHooks
}

/** 解析后的完整配置（所有可选字段已填充默认值） */
export interface ResolvedTraceConfig {
  projectId: string
  reportUrl: string
  sampleRate: number
  maxBufferSize: number
  flushInterval: number
  maxConcurrentRequests: number
  enableAutoError: boolean
  enableDebug: boolean
  includeUrlQuery: boolean
  includeUrlHash: boolean
  plugins: Readonly<BuiltinPluginsConfig>
  errorPlugin: Readonly<ErrorPluginConfig>
  eventPlugin: Readonly<EventPluginConfig>
  performancePlugin: Readonly<PerformancePluginConfig>
  hooks: TraceLifecycleHooks
}

// ─── 数据模型 ───────────────────────────────────────────────

/** 环境信息，SDK 启动时采集一次 */
export interface EnvInfo {
  userAgent: string
  browser: string
  browserVersion: string
  os: string
  osVersion: string
  screenWidth: number
  screenHeight: number
  viewportWidth: number
  viewportHeight: number
  referrer: string
  url: string
  /** 用户 ID，通过 setUser 设置 */
  uid: string
}

/** 单条埋点事件，由 trackEvent 组装后进入调度器 */
export interface TrackEventData {
  eventType: EventType
  eventName: string
  appId: string
  userId?: string
  sessionId?: string
  properties: TrackEventParams
  timestamp: number
  url: string
  referrer: string
}

// ─── 核心契约 ───────────────────────────────────────────────

/**
 * 上报器接口。
 * 实现自定义上报管道（如 Beacon、WebSocket）时需满足此契约。
 */
export interface TraceReporter {
  report(event: TrackEventData, priority: EventPriority): void | Promise<void>
  /** 手动触发上报，可选 */
  flush?(): void | Promise<void>
  /** 销毁上报器，释放资源，可选 */
  destroy?(): void | Promise<void>
}

/**
 * TraceCore 对外接口（I 前缀）。
 * 插件通过此接口与 SDK 核心通信，不直接依赖具体实现。
 */
export interface ITraceCore {
  /** 注册/更新配置 */
  register(config: TraceConfig): void
  /** 上报自定义事件 */
  trackEvent(eventName: string, params?: TrackEventParams, priority?: EventPriority, eventType?: EventType): void
  /** 添加公共参数，后续所有事件自动携带 */
  addCommonParams(params: CommonParams): void
  /** 移除指定 key 的公共参数 */
  removeCommonParams(keys: string[]): void
  /** 获取当前公共参数 */
  getCommonParams(): CommonParams
  /** 设置用户 ID */
  setUser(userId: string): void
  /** 获取当前环境信息 */
  getEnvInfo(): EnvInfo | null
  /** 获取解析后的完整配置 */
  getConfig(): Readonly<ResolvedTraceConfig> | null
  /** 注册自定义上报器，传 null 恢复默认 */
  setReporter(reporter: TraceReporter | null): void
  /** 销毁 SDK 实例，释放所有资源 */
  destroy(): void
}

/**
 * 插件契约。
 * 所有插件必须实现 name、install、uninstall 三个成员。
 */
export interface TracePlugin {
  /** 插件唯一标识 */
  name: string
  /** 安装插件，传入 core 实例以调用 trackEvent 等 API */
  install(core: ITraceCore): void
  /** 卸载插件，清理定时器、事件监听、DOM 引用 */
  uninstall(): void
}
