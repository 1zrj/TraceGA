# TraceGA 后端接口设计文档

## 一、概述

本文档定义了 TraceGA 埋点分析平台的后端 API 接口规范，包括接口路径、请求参数、响应格式、错误码等。

## 二、基础规范

### 2.1 统一响应格式

所有接口统一返回以下格式：

```json
{
  "code": 0,
  "data": {},
  "msg": "success"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | number | 0 表示成功，非 0 表示错误码 |
| `data` | any | 业务数据 |
| `msg` | string | 提示信息 |

### 2.2 分页响应格式

```json
{
  "code": 0,
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 20
  },
  "msg": "success"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `list` | array | 数据列表 |
| `total` | number | 总条数 |
| `page` | number | 当前页码 |
| `pageSize` | number | 每页条数 |

### 2.3 错误码体系

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 10001 | 事件不存在 |
| 10002 | 事件名称已存在 |
| 20001 | 埋点数据校验失败 |
| 20002 | 埋点请求限流 |
| 30001 | 数据分析查询失败 |
| 40001 | 报警规则不存在 |
| 50001 | AI 服务调用失败 |

### 2.4 认证方式

- 管理后台接口：JWT Token（放在 `Authorization: Bearer <token>` 头中）
- SDK 接口（埋点上报）：无需认证

---

## 三、接口列表

### 3.1 Track 模块（埋点上报）

#### POST /api/track - 单条埋点上报

**请求体：**
```json
{
  "eventType": "string",
  "appId": "string",
  "userId": "string",
  "sessionId": "string",
  "properties": {},
  "timestamp": 1719993600000,
  "ip": "string",
  "userAgent": "string",
  "source": "string"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `eventType` | string | ✅ | 事件类型 |
| `appId` | string | ✅ | 应用 ID |
| `userId` | string | ❌ | 用户 ID |
| `sessionId` | string | ❌ | 会话 ID |
| `properties` | object | ❌ | 事件属性 |
| `timestamp` | number | ❌ | 时间戳（毫秒） |
| `ip` | string | ❌ | IP 地址 |
| `userAgent` | string | ❌ | 用户代理 |
| `source` | string | ❌ | 来源渠道 |

**响应：**
```json
{
  "code": 0,
  "data": null,
  "msg": "success"
}
```

#### POST /api/track/batch - 批量埋点上报

**请求体：**
```json
{
  "events": [
    {
      "eventType": "string",
      "appId": "string",
      "properties": {}
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `events` | array | ✅ | 事件数组，最多 20 条 |

**响应：**
```json
{
  "code": 0,
  "data": {
    "success": 20,
    "failed": 0
  },
  "msg": "success"
}
```

---

### 3.2 Event 模块（事件管理）

#### GET /api/events - 查询事件列表

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | number | ❌ | 1 | 页码 |
| `pageSize` | number | ❌ | 20 | 每页条数 |
| `eventType` | string | ❌ | - | 事件类型筛选 |
| `appId` | string | ❌ | - | 应用筛选 |
| `keyword` | string | ❌ | - | 关键词搜索 |

**响应：**
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "evt_001",
        "eventName": "用户注册",
        "eventType": "register",
        "category": "conversion",
        "description": "用户完成注册流程",
        "propertySchema": {
          "type": "object",
          "properties": {
            "method": {
              "type": "string"
            }
          }
        },
        "appId": "app_xxx",
        "createdAt": "2026-07-01T10:00:00Z",
        "updatedAt": "2026-07-01T10:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20
  },
  "msg": "success"
}
```

#### GET /api/events/:id - 查询事件详情

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 事件 ID |

**响应：**
```json
{
  "code": 0,
  "data": {
    "id": "evt_001",
    "eventName": "用户注册",
    "eventType": "register",
    "category": "conversion",
    "description": "用户完成注册流程",
    "propertySchema": {},
    "appId": "app_xxx",
    "createdAt": "2026-07-01T10:00:00Z",
    "updatedAt": "2026-07-01T10:00:00Z"
  },
  "msg": "success"
}
```

#### POST /api/events - 新增事件定义

**请求体：**
```json
{
  "eventName": "用户注册",
  "eventType": "register",
  "category": "conversion",
  "description": "用户完成注册流程",
  "propertySchema": {
    "type": "object",
    "properties": {
      "method": {
        "type": "string",
        "enum": ["phone", "email"]
      }
    }
  },
  "appId": "app_xxx"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `eventName` | string | ✅ | 事件名称 |
| `eventType` | string | ✅ | 事件类型 |
| `category` | string | ✅ | 分类 |
| `description` | string | ❌ | 描述 |
| `propertySchema` | object | ❌ | 属性 Schema |
| `appId` | string | ✅ | 应用 ID |

**响应：**
```json
{
  "code": 0,
  "data": {
    "id": "evt_001",
    "createdAt": "2026-07-04T08:00:00Z"
  },
  "msg": "success"
}
```

#### PUT /api/events/:id - 修改事件定义

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 事件 ID |

**请求体（支持部分字段更新）：**
```json
{
  "eventName": "用户注册（新）",
  "description": "用户完成注册流程，包含手机号验证"
}
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "id": "evt_001",
    "updatedAt": "2026-07-04T08:30:00Z"
  },
  "msg": "success"
}
```

#### DELETE /api/events/:id - 删除事件定义（软删除）

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 事件 ID |

**响应：**
```json
{
  "code": 0,
  "data": null,
  "msg": "success"
}
```

---

### 3.3 Analysis 模块（数据分析）

#### GET /api/analysis/summary - 查询 PV/UV 汇总

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `startTime` | string | ✅ | 开始时间（ISO 格式） |
| `endTime` | string | ✅ | 结束时间（ISO 格式） |
| `appId` | string | ❌ | 应用筛选 |
| `eventType` | string | ❌ | 事件类型筛选 |

**响应：**
```json
{
  "code": 0,
  "data": {
    "pv": 100000,
    "uv": 50000,
    "rate": "2.00",
    "startTime": "2026-07-01T00:00:00Z",
    "endTime": "2026-07-07T23:59:59Z"
  },
  "msg": "success"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `pv` | number | 页面浏览量 |
| `uv` | number | 独立访客数 |
| `rate` | string | 转化率 |

#### GET /api/analysis/trend - 查询趋势数据

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `startTime` | string | ✅ | 开始时间 |
| `endTime` | string | ✅ | 结束时间 |
| `interval` | string | ✅ | 时间间隔（hour/day/week） |
| `appId` | string | ❌ | 应用筛选 |
| `eventType` | string | ❌ | 事件类型筛选 |

**响应：**
```json
{
  "code": 0,
  "data": [
    {
      "time": "2026-07-01T00:00:00Z",
      "pv": 15000,
      "uv": 8000
    },
    {
      "time": "2026-07-02T00:00:00Z",
      "pv": 18000,
      "uv": 9500
    }
  ],
  "msg": "success"
}
```

#### POST /api/analysis/filter - 条件筛选查询

**请求体：**
```json
{
  "startTime": "2026-07-01T00:00:00Z",
  "endTime": "2026-07-07T23:59:59Z",
  "filters": [
    {
      "key": "eventType",
      "operator": "eq",
      "value": "register"
    }
  ],
  "groupBy": ["eventType"],
  "orderBy": {
    "field": "pv",
    "direction": "DESC"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `startTime` | string | ✅ | 开始时间 |
| `endTime` | string | ✅ | 结束时间 |
| `filters` | array | ❌ | 筛选条件 |
| `groupBy` | array | ❌ | 分组字段 |
| `orderBy` | object | ❌ | 排序规则 |

**响应：**
```json
{
  "code": 0,
  "data": {
    "list": [],
    "total": 0
  },
  "msg": "success"
}
```

---

### 3.4 AI 模块（智能分析）

#### POST /api/ai/analyze - AI 智能分析

**请求体：**
```json
{
  "prompt": "分析最近一周的用户注册趋势",
  "startTime": "2026-07-01T00:00:00Z",
  "endTime": "2026-07-07T23:59:59Z",
  "appId": "app_xxx"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | ✅ | 分析提示 |
| `startTime` | string | ❌ | 数据时间范围 |
| `endTime` | string | ❌ | 数据时间范围 |
| `appId` | string | ❌ | 应用筛选 |

**响应：**
```json
{
  "code": 0,
  "data": {
    "conclusion": "用户注册量本周环比增长 20%",
    "suggestions": ["优化注册流程", "增加注册奖励"],
    "data": {}
  },
  "msg": "success"
}
```

---

### 3.5 Alarm 模块（报警）

#### GET /api/alarm/list - 查询报警记录

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | number | ❌ | 1 | 页码 |
| `pageSize` | number | ❌ | 20 | 每页条数 |
| `level` | string | ❌ | - | 报警级别 |
| `status` | string | ❌ | - | 报警状态 |
| `startTime` | string | ❌ | - | 开始时间 |
| `endTime` | string | ❌ | - | 结束时间 |

**响应：**
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "alm_001",
        "alarmType": "pv_drop",
        "level": "high",
        "message": "PV 下降超过 30%",
        "data": {},
        "status": "pending",
        "createdAt": "2026-07-07T10:00:00Z",
        "updatedAt": "2026-07-07T10:00:00Z"
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 20
  },
  "msg": "success"
}
```

#### GET /api/alarm/:id - 查询报警详情

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 报警 ID |

**响应：**
```json
{
  "code": 0,
  "data": {
    "id": "alm_001",
    "alarmType": "pv_drop",
    "level": "high",
    "message": "PV 下降超过 30%",
    "data": {},
    "status": "pending",
    "createdAt": "2026-07-07T10:00:00Z",
    "updatedAt": "2026-07-07T10:00:00Z"
  },
  "msg": "success"
}
```

---

### 3.6 Auth 模块（认证）

#### POST /api/auth/login - 用户登录

**请求体：**
```json
{
  "username": "admin",
  "password": "password"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | ✅ | 用户名 |
| `password` | string | ✅ | 密码 |

**响应：**
```json
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_001",
      "username": "admin",
      "role": "admin"
    }
  },
  "msg": "success"
}
```

#### POST /api/auth/logout - 用户登出

**响应：**
```json
{
  "code": 0,
  "data": null,
  "msg": "success"
}
```

---

## 四、附录

### 4.1 报警级别说明

| 级别 | 说明 |
|------|------|
| `low` | 低级别，一般提醒 |
| `medium` | 中级别，需要关注 |
| `high` | 高级别，需要处理 |
| `critical` | 严重级别，立即处理 |

### 4.2 报警状态说明

| 状态 | 说明 |
|------|------|
| `pending` | 待处理 |
| `acknowledged` | 已确认 |
| `resolved` | 已解决 |

### 4.3 时间间隔说明

| 间隔 | 说明 |
|------|------|
| `hour` | 按小时聚合 |
| `day` | 按天聚合 |
| `week` | 按周聚合 |