# TraceGA 后端接口设计文档

## 一、概述

本文档定义了 TraceGA 埋点分析平台的后端 API 接口规范，包括接口路径、请求参数、响应格式、错误码等。

## 二、基础规范

### 2.1 统一响应格式

所有接口统一返回以下格式：

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

| 字段      | 类型   | 说明                                  |
| --------- | ------ | ------------------------------------- |
| `code`    | number | 200 表示成功，非 200 表示错误         |
| `message` | string | 提示信息                              |
| `data`    | any    | 业务数据，成功时返回，失败时为 `null` |

### 2.2 分页响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

| 字段       | 类型   | 说明     |
| ---------- | ------ | -------- |
| `list`     | array  | 数据列表 |
| `total`    | number | 总条数   |
| `page`     | number | 当前页码 |
| `pageSize` | number | 每页条数 |

### 2.3 错误码体系

| 错误码 | 说明             |
| ------ | ---------------- |
| 200    | 成功             |
| 400    | 请求参数错误     |
| 401    | 未授权           |
| 403    | 禁止访问         |
| 404    | 资源不存在       |
| 500    | 服务器内部错误   |
| 10001  | 事件不存在       |
| 10002  | 事件名称已存在   |
| 20001  | 埋点数据校验失败 |
| 20002  | 埋点请求限流     |
| 30001  | 数据分析查询失败 |
| 40001  | 报警规则不存在   |
| 50001  | AI 服务调用失败  |

### 2.4 认证方式

- **管理后台接口**：JWT Token（放在 `Authorization: Bearer <token>` 头中）
- **SDK 接口（埋点上报）**：无需认证

---

## 三、接口列表

### 3.1 Track 模块（埋点上报）

> 基础路径：`/api/track`
> 认证：无需认证

#### POST /api/track - 单条埋点上报

**请求体：**

```json
{
  "eventType": "page_view",
  "eventName": "page_view",
  "appId": "trace-app",
  "eventId": "uuid",
  "userId": "user_001",
  "anonymousId": "anon_abc",
  "sessionId": "sess_001",
  "properties": { "page": "/home" },
  "commonParams": {},
  "timestamp": 1719993600000,
  "url": "http://example.com/home",
  "referrer": "http://example.com"
}
```

| 字段           | 类型   | 必填 | 说明                                                                                                       |
| -------------- | ------ | ---- | ---------------------------------------------------------------------------------------------------------- |
| `eventType`    | string | ✅   | 事件类型，可选值：`custom` / `click` / `page_view` / `exposure` / `error` / `performance` / `white_screen` |
| `eventName`    | string | ✅   | 事件名称，snake_case 格式（如 `page_view`），最长 128 字符                                                 |
| `appId`        | string | ✅   | 应用 ID，最长 64 字符                                                                                      |
| `eventId`      | string | ❌   | 事件唯一 ID（去重用），最长 128 字符                                                                       |
| `userId`       | string | ❌   | 用户 ID，最长 128 字符                                                                                     |
| `anonymousId`  | string | ❌   | 匿名 ID，最长 128 字符                                                                                     |
| `sessionId`    | string | ❌   | 会话 ID，最长 128 字符                                                                                     |
| `properties`   | object | ❌   | 事件自定义属性                                                                                             |
| `commonParams` | object | ❌   | 公共参数                                                                                                   |
| `timestamp`    | number | ❌   | 时间戳（毫秒），范围 0 ~ 8640000000000000                                                                  |
| `url`          | string | ❌   | 页面 URL，最长 512 字符                                                                                    |
| `referrer`     | string | ❌   | 来源 URL，最长 512 字符                                                                                    |

> 请求时 `userAgent` 和 `ip` 由服务端从 HTTP 请求头自动获取，客户端无需传递。

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "eventId": "uuid",
    "received": true
  }
}
```

#### POST /api/track/batch - 批量埋点上报

**请求体：**

```json
{
  "events": [
    {
      "eventType": "page_view",
      "eventName": "page_view",
      "appId": "trace-app"
    }
  ]
}
```

| 字段     | 类型  | 必填 | 说明                            |
| -------- | ----- | ---- | ------------------------------- |
| `events` | array | ✅   | 事件数组，最少 1 条，最多 20 条 |

数组中每个元素结构与单条上报请求体一致。

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "successCount": 19,
    "failedCount": 1,
    "failures": [
      {
        "index": 5,
        "eventId": null,
        "reason": "eventName does not exist or is disabled"
      }
    ]
  }
}
```

| 字段           | 类型   | 说明                                                                          |
| -------------- | ------ | ----------------------------------------------------------------------------- |
| `successCount` | number | 成功条数                                                                      |
| `failedCount`  | number | 失败条数                                                                      |
| `failures`     | array  | 失败详情列表，每项包含 `index`（批次内索引）、`eventId`、`reason`（失败原因） |

---

### 3.2 Event 模块（事件管理）

> 基础路径：`/api/events`
> 认证：需要 JWT

#### GET /api/events - 查询事件列表

**请求参数（Query）：**

| 参数        | 类型   | 必填 | 默认值 | 说明         |
| ----------- | ------ | ---- | ------ | ------------ |
| `page`      | number | ❌   | 1      | 页码         |
| `pageSize`  | number | ❌   | 20     | 每页条数     |
| `eventType` | string | ❌   | -      | 事件类型筛选 |
| `appId`     | string | ❌   | -      | 应用筛选     |
| `keyword`   | string | ❌   | -      | 关键词搜索   |

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "id": "clx...",
        "eventName": "page_view",
        "eventType": "page_view",
        "description": "页面浏览事件",
        "propertySchema": {},
        "appId": "trace-app",
        "createdAt": "2026-07-01T10:00:00.000Z",
        "updatedAt": "2026-07-01T10:00:00.000Z",
        "deletedAt": null
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 20
  }
}
```

#### GET /api/events/:id - 查询事件详情

**路径参数：**

| 参数 | 类型   | 说明    |
| ---- | ------ | ------- |
| `id` | string | 事件 ID |

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "clx...",
    "eventName": "page_view",
    "eventType": "page_view",
    "description": "页面浏览事件",
    "propertySchema": {},
    "appId": "trace-app",
    "createdAt": "2026-07-01T10:00:00.000Z",
    "updatedAt": "2026-07-01T10:00:00.000Z",
    "deletedAt": null
  }
}
```

#### POST /api/events - 新增事件定义

**请求体：**

```json
{
  "eventName": "page_view",
  "eventType": "page_view",
  "description": "页面浏览事件",
  "propertySchema": {
    "type": "object",
    "properties": {
      "page": { "type": "string" }
    }
  },
  "appId": "trace-app"
}
```

| 字段             | 类型   | 必填 | 说明             |
| ---------------- | ------ | ---- | ---------------- |
| `eventName`      | string | ✅   | 事件名称         |
| `eventType`      | string | ✅   | 事件类型         |
| `description`    | string | ❌   | 描述             |
| `propertySchema` | object | ❌   | 属性 JSON Schema |
| `appId`          | string | ✅   | 应用 ID          |

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "clx...",
    "createdAt": "2026-07-04T08:00:00.000Z"
  }
}
```

#### PUT /api/events/:id - 修改事件定义

**路径参数：**

| 参数 | 类型   | 说明    |
| ---- | ------ | ------- |
| `id` | string | 事件 ID |

**请求体（支持部分字段更新）：**

```json
{
  "eventName": "page_view_v2",
  "description": "更新后的描述"
}
```

支持更新的字段：`eventName`、`eventType`、`description`、`propertySchema`、`appId`

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "clx...",
    "updatedAt": "2026-07-04T08:30:00.000Z"
  }
}
```

#### DELETE /api/events/:id - 删除事件定义（软删除）

**路径参数：**

| 参数 | 类型   | 说明    |
| ---- | ------ | ------- |
| `id` | string | 事件 ID |

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

---

### 3.3 Analysis 模块（数据分析）

> 基础路径：`/api/analysis`
> 认证：需要 JWT

#### GET /api/analysis/summary - 查询 PV/UV 汇总

**请求参数（Query）：**

| 参数        | 类型   | 必填 | 说明                 |
| ----------- | ------ | ---- | -------------------- |
| `startTime` | string | ❌   | 开始时间（ISO 格式） |
| `endTime`   | string | ❌   | 结束时间（ISO 格式） |
| `appId`     | string | ❌   | 应用筛选             |

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "pv": 100000,
    "uv": 50000,
    "eventCount": 120000,
    "rate": "2.00",
    "startTime": "2026-07-01T00:00:00Z",
    "endTime": "2026-07-07T23:59:59Z"
  }
}
```

| 字段         | 类型   | 说明            |
| ------------ | ------ | --------------- |
| `pv`         | number | 页面浏览量      |
| `uv`         | number | 独立访客数      |
| `eventCount` | number | 事件总数        |
| `rate`       | string | 转化率（PV/UV） |

#### GET /api/analysis/trend - 查询趋势数据

**请求参数（Query）：**

| 参数        | 类型   | 必填 | 说明                                |
| ----------- | ------ | ---- | ----------------------------------- |
| `startTime` | string | ❌   | 开始时间                            |
| `endTime`   | string | ❌   | 结束时间                            |
| `interval`  | string | ❌   | 时间间隔（`hour` / `day` / `week`） |
| `appId`     | string | ❌   | 应用筛选                            |
| `eventType` | string | ❌   | 事件类型筛选                        |

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "time": "2026-07-01",
      "pv": 15000,
      "uv": 8000
    }
  ]
}
```

#### POST /api/analysis/filter - 条件筛选查询

**请求体：**

```json
{
  "startTime": "2026-07-01T00:00:00Z",
  "endTime": "2026-07-07T23:59:59Z",
  "appId": "trace-app",
  "eventTypes": ["page_view", "click"],
  "filters": [
    {
      "key": "eventType",
      "operator": "eq",
      "value": "register"
    }
  ]
}
```

| 字段         | 类型   | 必填 | 说明           |
| ------------ | ------ | ---- | -------------- |
| `startTime`  | string | ❌   | 开始时间       |
| `endTime`    | string | ❌   | 结束时间       |
| `appId`      | string | ❌   | 应用筛选       |
| `eventTypes` | array  | ❌   | 事件类型筛选   |
| `filters`    | array  | ❌   | 自定义筛选条件 |

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [],
    "total": 0
  }
}
```

---

### 3.4 Analytics 模块（看板数据）

> 基础路径：`/api/analytics`
> 认证：需要 JWT

#### GET /api/analytics/overview - 看板概览

**请求参数（Query）：**

| 参数        | 类型   | 必填 | 说明     |
| ----------- | ------ | ---- | -------- |
| `startTime` | string | ❌   | 开始时间 |
| `endTime`   | string | ❌   | 结束时间 |
| `appId`     | string | ❌   | 应用筛选 |

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "pv": 100000,
    "uv": 50000,
    "eventCount": 120000,
    "avgDuration": 180,
    "conversionRate": 3.5
  }
}
```

#### GET /api/analytics/event-trend - 每日事件趋势

**请求参数（Query）：**

| 参数        | 类型   | 必填 | 说明                                |
| ----------- | ------ | ---- | ----------------------------------- |
| `startTime` | string | ❌   | 开始时间                            |
| `endTime`   | string | ❌   | 结束时间                            |
| `interval`  | string | ❌   | 时间间隔（`hour` / `day` / `week`） |
| `appId`     | string | ❌   | 应用筛选                            |

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    { "time": "2026-07-01", "count": 15000 },
    { "time": "2026-07-02", "count": 18000 }
  ]
}
```

#### GET /api/analytics/event-type-trend - 事件类型趋势

**请求参数（Query）：** 同 event-trend

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    { "time": "2026-07-01", "type": "page_view", "count": 8000 },
    { "time": "2026-07-01", "type": "click", "count": 3000 }
  ]
}
```

#### GET /api/analytics/top-events - 热门事件排行

**请求参数（Query）：**

| 参数        | 类型   | 必填 | 默认值 | 说明         |
| ----------- | ------ | ---- | ------ | ------------ |
| `startTime` | string | ❌   | -      | 开始时间     |
| `endTime`   | string | ❌   | -      | 结束时间     |
| `appId`     | string | ❌   | -      | 应用筛选     |
| `limit`     | number | ❌   | 10     | 返回条数上限 |

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    { "name": "page_view", "count": 50000 },
    { "name": "click", "count": 30000 }
  ]
}
```

#### GET /api/analytics/conversion-rate - 转化率

**请求参数（Query）：** 同 overview

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    { "step": "用户注册", "count": 5000, "rate": 100 },
    { "step": "用户登录", "count": 4500, "rate": 90 },
    { "step": "订单完成", "count": 500, "rate": 10 }
  ]
}
```

#### GET /api/analytics/error-events - 错误事件列表

**请求参数（Query）：**

| 参数        | 类型   | 必填 | 说明     |
| ----------- | ------ | ---- | -------- |
| `startTime` | string | ❌   | 开始时间 |
| `endTime`   | string | ❌   | 结束时间 |
| `appId`     | string | ❌   | 应用筛选 |

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "err_001",
      "eventName": "error",
      "errorType": "js-error",
      "message": "Uncaught TypeError: ...",
      "pageUrl": "/home",
      "userId": "user_001",
      "occurredAt": "2026-07-01T10:00:00Z"
    }
  ]
}
```

#### GET /api/analytics/error-trend - 错误事件趋势

**请求参数（Query）：** 同 error-events

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    { "time": "2026-07-01", "count": 15 },
    { "time": "2026-07-02", "count": 22 }
  ]
}
```

---

### 3.5 AI 模块（智能分析）

> 基础路径：`/api/ai`
> 认证：需要 JWT
> AI 分析使用 GLM-4-Flash 模型，响应内容为流式 Markdown 文本。

#### 3.5.1 数据分析

##### POST /api/ai/analyze - 智能分析（非流式）

**请求体：**

```json
{
  "appId": "trace-app",
  "analysisType": "trend",
  "eventNames": ["page_view", "click"],
  "startTime": "2026-07-01T00:00:00Z",
  "endTime": "2026-07-07T23:59:59Z",
  "prompt": "分析最近一周的用户注册趋势",
  "question": "用户注册量为什么下降了？"
}
```

| 字段           | 类型   | 必填 | 说明               |
| -------------- | ------ | ---- | ------------------ |
| `appId`        | string | ❌   | 应用 ID            |
| `analysisType` | string | ❌   | 分析类型           |
| `eventNames`   | array  | ❌   | 分析的事件名称列表 |
| `startTime`    | string | ❌   | 数据时间范围起始   |
| `endTime`      | string | ❌   | 数据时间范围结束   |
| `prompt`       | string | ❌   | 分析提示           |
| `question`     | string | ❌   | 用户问题           |

**响应：** 非流式接口返回 AI 生成的 Markdown 文本字符串。

##### POST /api/ai/analyze/stream - 智能分析（SSE 流式）

请求体同非流式接口。响应以 SSE（Server-Sent Events）格式流式输出 Markdown 文本。

#### 3.5.2 日报生成

##### POST /api/ai/daily-report - 日报（非流式）

**请求体：**

```json
{
  "appId": "trace-app",
  "date": "2026-07-07"
}
```

| 字段    | 类型   | 必填 | 说明                               |
| ------- | ------ | ---- | ---------------------------------- |
| `appId` | string | ✅   | 应用 ID                            |
| `date`  | string | ❌   | 日期（YYYY-MM-DD），不传则使用当天 |

##### POST /api/ai/daily-report/stream - 日报（SSE 流式）

#### 3.5.3 异常解释

##### POST /api/ai/anomaly-explain - 异常解释（非流式）

**请求体：**

```json
{
  "appId": "trace-app",
  "eventName": "page_view",
  "currentValue": 500,
  "previousValue": 1500,
  "compareLabel": "昨日",
  "context": {
    "pageChange": 0,
    "pageUrl": "/home",
    "releaseNotes": "v2.1.0 上线了新首页",
    "additionalInfo": "无"
  }
}
```

| 字段            | 类型   | 必填 | 说明                                                                       |
| --------------- | ------ | ---- | -------------------------------------------------------------------------- |
| `appId`         | string | ✅   | 应用 ID                                                                    |
| `eventName`     | string | ✅   | 事件名称                                                                   |
| `currentValue`  | number | ❌   | 当前值                                                                     |
| `previousValue` | number | ❌   | 对比值                                                                     |
| `compareLabel`  | string | ❌   | 对比标签（如"昨日"、"上周同期"）                                           |
| `context`       | object | ❌   | 上下文信息，包含 `pageChange`、`pageUrl`、`releaseNotes`、`additionalInfo` |

##### POST /api/ai/anomaly-explain/stream - 异常解释（SSE 流式）

#### 3.5.4 自然语言查询

##### POST /api/ai/nl-query - NL 查询（非流式）

**请求体：**

```json
{
  "appId": "trace-app",
  "question": "最近一周 PV 最高的页面是哪些？"
}
```

| 字段       | 类型   | 必填 | 说明         |
| ---------- | ------ | ---- | ------------ |
| `appId`    | string | ✅   | 应用 ID      |
| `question` | string | ✅   | 自然语言问题 |

##### POST /api/ai/nl-query/stream - NL 查询（SSE 流式）

#### 3.5.5 事件推荐

##### POST /api/ai/recommend - 事件推荐（非流式）

**请求体：**

```json
{
  "appId": "trace-app",
  "description": "电商平台，需要跟踪用户从浏览到购买的完整流程"
}
```

| 字段          | 类型   | 必填 | 说明     |
| ------------- | ------ | ---- | -------- |
| `appId`       | string | ✅   | 应用 ID  |
| `description` | string | ✅   | 业务描述 |

##### POST /api/ai/recommend/stream - 事件推荐（SSE 流式）

---

### 3.6 Alarm 模块（告警）

> 基础路径：`/api/alarm`
> 认证：需要 JWT

#### GET /api/alarm/list - 查询告警规则列表

**请求参数（Query）：**

| 参数       | 类型   | 必填 | 默认值 | 说明     |
| ---------- | ------ | ---- | ------ | -------- |
| `page`     | number | ❌   | 1      | 页码     |
| `pageSize` | number | ❌   | 20     | 每页条数 |

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "id": 1,
        "projectId": "trace-app",
        "eventName": "page_view",
        "threshold": 10000,
        "operator": "gt",
        "notifyType": "webhook",
        "status": 1,
        "createdAt": "2026-07-01T10:00:00.000Z",
        "updatedAt": "2026-07-01T10:00:00.000Z"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20
  }
}
```

| 字段         | 类型   | 说明                            |
| ------------ | ------ | ------------------------------- |
| `projectId`  | string | 项目 ID                         |
| `eventName`  | string | 监控的事件名称                  |
| `threshold`  | number | 阈值                            |
| `operator`   | string | 操作符（`gt` / `lt`）           |
| `notifyType` | string | 通知方式（`webhook` / `email`） |
| `status`     | number | 状态（1=启用，0=禁用）          |

#### GET /api/alarm/:id - 查询告警规则详情

**路径参数：**

| 参数 | 类型   | 说明    |
| ---- | ------ | ------- |
| `id` | number | 告警 ID |

**响应：** 同列表中的单条数据结构

---

### 3.7 Auth 模块（认证）

> 基础路径：`/api/auth`

#### POST /api/auth/register - 用户注册

**请求体：**

```json
{
  "username": "admin",
  "email": "admin@tracega.com",
  "phone": "13800138000",
  "password": "Admin123456",
  "role": "admin"
}
```

| 字段       | 类型   | 必填 | 说明                             |
| ---------- | ------ | ---- | -------------------------------- |
| `username` | string | ✅   | 用户名，2~64 字符                |
| `email`    | string | ✅   | 邮箱                             |
| `phone`    | string | ✅   | 手机号（1[3-9] 开头，11 位）     |
| `password` | string | ✅   | 密码，至少 8 位且包含字母和数字  |
| `role`     | string | ❌   | 角色，可选值：`admin` / `viewer` |

#### POST /api/auth/login - 用户登录

**请求体：**

```json
{
  "email": "admin@tracega.com",
  "phone": "13800138000",
  "password": "Admin123456"
}
```

| 字段       | 类型   | 必填 | 说明                          |
| ---------- | ------ | ---- | ----------------------------- |
| `email`    | string | ❌   | 邮箱（与 phone 至少填一个）   |
| `phone`    | string | ❌   | 手机号（与 email 至少填一个） |
| `password` | string | ✅   | 密码                          |

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_001",
      "username": "admin",
      "role": "admin"
    }
  }
}
```

#### POST /api/auth/logout - 用户登出

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

#### GET /api/auth/profile - 获取个人信息

**认证：** 需要 JWT

**响应：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "user_001",
    "username": "admin",
    "name": "管理员",
    "email": "admin@tracega.com",
    "phone": "13800138000",
    "avatar": null,
    "role": "admin",
    "status": 1,
    "lastLoginAt": "2026-07-27T10:00:00.000Z"
  }
}
```

---

## 四、附录

### 4.1 Track 事件类型

| 类型           | 说明       |
| -------------- | ---------- |
| `custom`       | 自定义事件 |
| `click`        | 点击事件   |
| `page_view`    | 页面浏览   |
| `exposure`     | 元素曝光   |
| `error`        | 错误事件   |
| `performance`  | 性能指标   |
| `white_screen` | 白屏检测   |

### 4.2 时间间隔

| 间隔   | 说明       |
| ------ | ---------- |
| `hour` | 按小时聚合 |
| `day`  | 按天聚合   |
| `week` | 按周聚合   |

### 4.3 通用查询参数

所有需要时间范围的接口均支持以下可选参数：

| 参数        | 类型   | 说明                        |
| ----------- | ------ | --------------------------- |
| `startTime` | string | 开始时间，格式 `YYYY-MM-DD` |
| `endTime`   | string | 结束时间，格式 `YYYY-MM-DD` |
| `appId`     | string | 应用/项目 ID                |

不传时间参数时默认查询全部数据。
