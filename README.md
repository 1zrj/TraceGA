# TraceGA

全链路埋点监控平台，提供从客户端数据采集、服务端存储分析到管理平台可视化展示的一站式解决方案。

项目采用 pnpm monorepo 结构，包含三个子包：

- **trace-sdk** — 浏览器端埋点 SDK，采集用户行为、JS 报错、性能指标等
- **trace-server** — NestJS 后端服务，提供埋点接入、数据分析、AI 分析、告警管理等 REST API
- **trace-admin** — React 管理平台，数据看板、事件管理、AI 分析等

## 功能概览

### 管理平台 (trace-admin)

| 页面         | 功能                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| **数据看板** | PV/UV 概览、每日事件趋势（柱状图）、热门事件（饼图）、事件类型趋势对比、用户行为漏斗、错误事件列表与详情 |
| **事件管理** | 事件定义（eventName/eventType/appId）的增删改查，支持关键词搜索与分页                                    |
| **告警管理** | 告警规则列表展示，按阈值/操作符/通知类型管理                                                             |
| **AI 分析**  | 基于 GLM-4 的对话式分析助手，支持数据分析、日报生成、异常解释、自然语言查询、事件推荐                    |

### 埋点 SDK (trace-sdk)

| 能力         | 说明                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| **行为采集** | 点击追踪、页面浏览（SPA 路由变化自动采集）、元素曝光（IntersectionObserver）     |
| **错误采集** | JS 运行时错误、Promise 未捕获拒绝、资源加载失败、HTTP 请求错误（fetch/XHR 拦截） |
| **性能采集** | Core Web Vitals：FCP、LCP、CLS                                                   |
| **白屏检测** | 多轮检测（3s/6s/10s），要素数量 + 像素对比双重判断                               |
| **上报策略** | 批量缓冲、优先级调度、并发限制、失败重试、页面离开自动 flush                     |

## 技术栈

| 层     | 技术                                                                  |
| ------ | --------------------------------------------------------------------- |
| 前端   | React 18 + TypeScript + Vite 5 + Ant Design 5 + Zustand + ECharts 5   |
| 后端   | NestJS 10 + Prisma 7 + JWT + class-validator                          |
| 数据库 | MySQL 8.0 + ClickHouse                                                |
| AI     | GLM-4-Flash API + SSE 流式输出                                        |
| Mock   | MSW v2（开发环境可选）                                                |
| 工程化 | pnpm workspace + Husky + commitlint + lint-staged + ESLint + Prettier |

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 10
- Docker（用于启动 MySQL 和 ClickHouse）

```bash
node -v
pnpm -v
```

### 1. 启动基础设施

```bash
# 启动 MySQL（tracega 管理平台必需）
docker compose --profile mysql up -d

# 如需 ClickHouse（高性能分析），额外启动
docker compose --profile clickhouse up -d
```

### 2. 配置环境变量

每个子包都提供了 `.env-example` 模板文件，复制为 `.env` 后按需修改：

**后端 (packages/trace-server/)**

```bash
cp packages/trace-server/.env-example packages/trace-server/.env
```

关键配置项：

| 变量           | 说明                             | 默认值                                       |
| -------------- | -------------------------------- | -------------------------------------------- |
| `DATABASE_URL` | MySQL 连接串                     | `mysql://root:123456@localhost:3306/tracega` |
| `JWT_SECRET`   | JWT 签名密钥（生产环境务必更换） | `dev_tracega_jwt_2024`                       |
| `GLM_API_KEY`  | GLM API 密钥（AI 功能需要）      | —                                            |

**前端 (packages/trace-admin/)**

```bash
cp packages/trace-admin/.env-example packages/trace-admin/.env
```

| 变量                | 说明                              | 默认值 |
| ------------------- | --------------------------------- | ------ |
| `VITE_API_BASE_URL` | API 地址（开发环境代理到 `/api`） | `/api` |
| `VITE_ENABLE_MOCK`  | 是否启用 MSW Mock                 | `true` |

> 开发环境建议 `VITE_ENABLE_MOCK=false` 连接真实后端。

### 3. 安装依赖

```bash
pnpm install
```

安装完成后会自动执行 `prepare` 脚本初始化 Husky Git hooks。

### 4. 初始化数据库

```bash
# 生成 Prisma Client 并执行迁移
cd packages/trace-server
npx prisma migrate dev --name init
cd ../..

# 填充测试数据
node packages/trace-server/prisma/seed.js
```

> seed 脚本会创建项目、事件定义、模拟事件日志（330 条/次）、管理员账号及告警规则。

### 5. 启动开发服务

```bash
pnpm dev
```

| 服务     | 地址                  |
| -------- | --------------------- |
| 管理平台 | http://localhost:5173 |
| 后端 API | http://localhost:3000 |

### 6. 登录

使用 seed 脚本创建的演示账号：

| 用户名  | 密码       | 角色               |
| ------- | ---------- | ------------------ |
| `admin` | `admin123` | 管理员（全部权限） |

## 常用命令

```bash
# 启动所有子包 dev 服务
pnpm dev

# 构建所有子包
pnpm build

# 代码规范检查
pnpm lint

# 自动修复规范问题
pnpm lint:fix

# 格式化代码
pnpm format
```

### 单包操作

```bash
pnpm --filter @tracega/sdk dev        # SDK 构建 watch
pnpm --filter tracega/server dev      # 后端 watch
pnpm --filter tracega/admin dev       # 前端 dev server
```

## 项目结构

```text
TraceGA/
├── packages/
│   ├── trace-admin/                  # React 管理平台
│   │   └── src/
│   │       ├── api/                  # 业务层 API 封装
│   │       ├── auth/                 # 认证 & 权限（RBAC）
│   │       ├── components/           # 通用 UI 组件
│   │       ├── features/
│   │       │   ├── dashboard/        # 数据看板（含9个子图表组件）
│   │       │   ├── event-management/ # 事件管理（CRUD 表格）
│   │       │   ├── alarm/            # 告警管理
│   │       │   └── ai/               # AI 分析助手（对话式）
│   │       ├── hooks/                # 通用 Hooks（分页、筛选等）
│   │       ├── mocks/                # MSW Mock handlers
│   │       ├── pages/                # 独立页面（首页 / 登录 / 403 / 404）
│   │       ├── routes/               # 路由配置
│   │       ├── store/                # Zustand 状态管理
│   │       ├── styles/               # 全局样式
│   │       ├── tokens/               # Design Token（颜色、间距、圆角等）
│   │       └── types/                # TypeScript 类型定义
│   │
│   ├── trace-sdk/                    # 浏览器埋点 SDK
│   │   └── src/
│   │       ├── core/                 # 核心（TraceCore、Reporter、调度器）
│   │       ├── plugins/
│   │       │   ├── behavior/         # 行为采集（点击、页面浏览、曝光）
│   │       │   ├── error/            # 错误采集（JS、Promise、资源、HTTP）
│   │       │   ├── performance/      # 性能采集（FCP、LCP、CLS）
│   │       │   └── whiteScreen/      # 白屏检测
│   │       └── utils/                # 工具函数
│   │
│   └── trace-server/                 # NestJS 后端服务
│       ├── prisma/
│       │   ├── schema.prisma         # 数据库模型定义（6 张表）
│       │   └── seed.js               # 测试数据种子脚本
│       ├── docs/
│       │   └── api-design.md         # API 设计文档
│       └── src/
│           ├── modules/
│           │   ├── track/            # 埋点接入（单条/批量，含校验与处理管线）
│           │   ├── event/            # 事件定义 CRUD
│           │   ├── analysis/         # 数据分析（概览、趋势、漏斗等）
│           │   ├── ai/               # AI 分析（5 种能力 + SSE 流式）
│           │   ├── alarm/            # 告警规则管理
│           │   └── auth/             # 认证（JWT 登录/注册/个人信息）
│           ├── common/               # 通用（过滤器、守卫、拦截器、中间件）
│           ├── config/               # 配置服务
│           └── database/             # Prisma + ClickHouse 连接
│
├── docker-compose.yml                # MySQL / ClickHouse 容器编排
├── pnpm-workspace.yaml               # Monorepo 配置
├── .husky/                           # Git hooks
├── commitlint.config.cjs             # 提交信息规范
├── .lintstagedrc.json                # Lint-staged 配置
└── .prettierrc                       # 代码格式化配置
```

## 初始化测试数据

seed 脚本位于 `packages/trace-server/prisma/seed.js`，执行：

```bash
node packages/trace-server/prisma/seed.js
```

脚本行为：

- **幂等创建**：项目、事件定义、管理员账号、告警规则均只创建一次
- **追加数据**：每次执行追加 330 条模拟事件日志（300 条正常事件 + 30 条错误事件），不会清空或覆盖已有数据
- **时间分布**：数据分布在最近 30 天内，模拟真实时段规律（上午较低 → 下午高峰 → 晚间中等）
- **错误事件**：包含 `js-error`、`promise-error`、`resource-error`、`http-error` 四种类型

如需重置事件日志，先手动清空表再执行 seed：

```sql
TRUNCATE TABLE event_log;
```

## API 文档

后端 API 设计文档参见 [packages/trace-server/docs/api-design.md](packages/trace-server/docs/api-design.md)，涵盖所有接口的请求/响应格式说明。

主要 API 分组：

| 分组     | 前缀                      | 说明                                                      |
| -------- | ------------------------- | --------------------------------------------------------- |
| 埋点接入 | `POST /api/track[/batch]` | 单条/批量事件上报（无需认证）                             |
| 事件定义 | `/api/events`             | 事件 CRUD                                                 |
| 数据分析 | `/api/analysis/*`         | PV/UV 汇总、趋势、筛选查询                                |
| 看板数据 | `/api/analytics/*`        | 概览、事件趋势、事件类型趋势、Top 事件、转化率、错误事件  |
| AI 分析  | `/api/ai/*`               | 5 种 AI 能力（分析/日报/异常解释/NL 查询/推荐）+ SSE 流式 |
| 告警     | `/api/alarm/*`            | 告警规则查询                                              |
| 认证     | `/api/auth/*`             | 注册、登录、登出、个人信息                                |

## Workspace 包

| 包名             | 路径                    | 说明           |
| ---------------- | ----------------------- | -------------- |
| `@tracega/sdk`   | `packages/trace-sdk`    | 客户端埋点 SDK |
| `tracega/server` | `packages/trace-server` | 后端服务       |
| `tracega/admin`  | `packages/trace-admin`  | 管理平台       |
