# Trace SDK

## trackEvent 上报数据类型

`trackEvent` 用于生成一条埋点事件数据：

```ts
trackEvent(eventType: string, eventName: string, params?: Record<string, any>): void
```

### 入参

| 字段        | 类型                  | 必填 | 说明                                                        |
| ----------- | --------------------- | ---- | ----------------------------------------------------------- |
| `eventType` | `string`              | 是   | 事件类型或插件大类，例如 `error`、`event`、`performance`    |
| `eventName` | `string`              | 是   | 具体事件名称，例如 `js-error`、`http-error`、`button-click` |
| `params`    | `Record<string, any>` | 否   | 事件业务参数，最终会进入 `properties` 字段                  |

### 生成的事件数据

当前 SDK 的 `trackEvent` 会构造以下 `TrackEventData`：

```ts
interface TrackEventData {
  eventType: string;
  eventName: string;
  appId: string;
  timestamp: number;
  properties: Record<string, any>;
  url?: string;
  userAgent?: string;
}
```

| 字段         | 类型                  | 来源                     | 说明                                        |
| ------------ | --------------------- | ------------------------ | ------------------------------------------- |
| `eventType`  | `string`              | `trackEvent` 第一个参数  | 事件类型或插件大类                          |
| `eventName`  | `string`              | `trackEvent` 第二个参数  | 具体事件名称                                |
| `appId`      | `string`              | `register(config.appId)` | 应用 ID                                     |
| `timestamp`  | `number`              | `Date.now()`             | 事件被 SDK 采集/生成的时间戳，单位毫秒      |
| `properties` | `Record<string, any>` | `trackEvent` 第三个参数  | 事件负载数据；未传时为 `{}`                 |
| `url`        | `string`              | `window.location.href`   | 当前页面 URL；非浏览器环境下为空字符串      |
| `userAgent`  | `string`              | `navigator.userAgent`    | 浏览器 User-Agent；非浏览器环境下为空字符串 |

### 示例

```ts
traceCore.register({
  appId: 'demo-app',
  reportUrl: 'http://localhost:3000/api/track',
  sampleRate: 1,
});

traceCore.trackEvent('error', 'js-error', {
  message: 'Cannot read properties of undefined',
  occurredAt: 1719993599000,
  filename: 'https://example.com/assets/app.js',
  lineno: 24,
  colno: 16,
  stack: 'TypeError: Cannot read properties of undefined\n    at submitOrder (app.js:24:16)',
});
```

生成的数据结构示例：

```ts
{
  eventType: 'error',
  eventName: 'js-error',
  appId: 'demo-app',
  timestamp: 1719993600000,
  properties: {
    message: 'Cannot read properties of undefined',
    occurredAt: 1719993599000,
    filename: 'https://example.com/assets/app.js',
    lineno: 24,
    colno: 16,
    stack: 'TypeError: Cannot read properties of undefined\n    at submitOrder (app.js:24:16)',
  },
  url: 'https://example.com/order',
  userAgent: 'Mozilla/5.0 ...',
}
```
