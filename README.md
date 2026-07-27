# TraceGA

全链路埋点监控平台。

## 项目结构

```text
TraceGA/
+-- packages/
|   +-- trace-sdk/      # 客户端埋点 SDK
|   +-- trace-server/   # 后端服务
|   +-- trace-admin/    # 管理平台
+-- package.json        # monorepo 根配置
+-- pnpm-workspace.yaml # pnpm workspace 配置
+-- README.md
```

## 快速开始

### 环境要求

建议使用以下版本：

- Node.js >= 20
- pnpm >= 10

可以用下面的命令确认本机版本：

```bash
node -v
pnpm -v
```

### 安装依赖

在项目根目录执行：

```bash
pnpm install
```

安装完成后会执行 `prepare` 脚本，用于初始化 Husky Git hooks。

### 常用命令

```bash
# 启动所有带 dev 脚本的子包
pnpm dev

# 构建所有带 build 脚本的子包
pnpm build

# 检查 JS 代码规范
pnpm lint

# 自动修复 JS 代码规范问题
pnpm lint:fix

# 格式化 packages 下的文件
pnpm format
```

### 初始化测试数据

```bash
node packages/trace-server/prisma/seed.js
```

> **注意**：该脚本每次运行会**追加 300 条模拟事件日志**（含 30 条错误事件），不会清空或覆盖已有数据。
> 多次执行会持续增加数据量。如需重置，先手动 truncate `event_log` 表再执行。

### Workspace 包

当前 workspace 包包括：

- `@tracega/sdk`：客户端埋点 SDK
- `tracega/server`：后端服务
- `tracega/admin`：管理平台

可以针对单个包执行命令：

```bash
pnpm --filter @tracega/sdk <command>
pnpm --filter tracega/server <command>
pnpm --filter tracega/admin <command>
```
