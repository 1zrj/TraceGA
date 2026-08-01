export const mockEvents = [
  {
    id: '1',
    eventName: '用户登录',
    eventType: 'login',
    category: '用户行为',
    description: '用户登录系统',
    propertySchema: { device: 'string', platform: 'string' },
    appId: 'app001',
    createdAt: '2024-01-15T10:30:00.000Z',
    updatedAt: '2024-01-15T10:30:00.000Z',
  },
  {
    id: '2',
    eventName: '商品浏览',
    eventType: 'view',
    category: '电商',
    description: '用户浏览商品详情',
    propertySchema: { productId: 'string', category: 'string' },
    appId: 'app001',
    createdAt: '2024-01-15T10:35:00.000Z',
    updatedAt: '2024-01-15T10:35:00.000Z',
  },
  {
    id: '3',
    eventName: '添加购物车',
    eventType: 'add_cart',
    category: '电商',
    description: '用户将商品加入购物车',
    propertySchema: { productId: 'string', quantity: 'number' },
    appId: 'app001',
    createdAt: '2024-01-15T10:40:00.000Z',
    updatedAt: '2024-01-15T10:40:00.000Z',
  },
  {
    id: '4',
    eventName: '用户注册',
    eventType: 'register',
    category: '用户行为',
    description: '新用户注册',
    propertySchema: { channel: 'string' },
    appId: 'app001',
    createdAt: '2024-01-15T11:00:00.000Z',
    updatedAt: '2024-01-15T11:00:00.000Z',
  },
  {
    id: '5',
    eventName: '订单完成',
    eventType: 'purchase',
    category: '电商',
    description: '用户完成订单支付',
    propertySchema: { orderId: 'string', amount: 'number' },
    appId: 'app001',
    createdAt: '2024-01-15T11:30:00.000Z',
    updatedAt: '2024-01-15T11:30:00.000Z',
  },
]

export const mockOverview = {
  pv: 12580,
  uv: 3250,
  rate: '4.5',
  startTime: '2024-01-08T00:00:00.000Z',
  endTime: '2024-01-15T23:59:59.000Z',
}

export const mockEventTrend = [
  { time: '01-09', pv: 1200, uv: 320 },
  { time: '01-10', pv: 1500, uv: 380 },
  { time: '01-11', pv: 1300, uv: 350 },
  { time: '01-12', pv: 1800, uv: 420 },
  { time: '01-13', pv: 2100, uv: 480 },
  { time: '01-14', pv: 1900, uv: 450 },
  { time: '01-15', pv: 2200, uv: 510 },
]

export const mockTopEvents = [
  { name: '用户登录', count: 3500, percentage: 27.8 },
  { name: '商品浏览', count: 2800, percentage: 22.2 },
  { name: '添加购物车', count: 2100, percentage: 16.7 },
  { name: '订单完成', count: 1800, percentage: 14.3 },
  { name: '用户注册', count: 1500, percentage: 11.9 },
]

/** 按事件类型分组的7日趋势（用于堆叠柱状图） */
export const mockEventTypeTrend = [
  { time: '01-09', type: '用户登录', count: 450 },
  { time: '01-09', type: '商品浏览', count: 380 },
  { time: '01-09', type: '添加购物车', count: 260 },
  { time: '01-09', type: '订单完成', count: 180 },
  { time: '01-10', type: '用户登录', count: 520 },
  { time: '01-10', type: '商品浏览', count: 430 },
  { time: '01-10', type: '添加购物车', count: 290 },
  { time: '01-10', type: '订单完成', count: 200 },
  { time: '01-11', type: '用户登录', count: 480 },
  { time: '01-11', type: '商品浏览', count: 400 },
  { time: '01-11', type: '添加购物车', count: 270 },
  { time: '01-11', type: '订单完成', count: 190 },
  { time: '01-12', type: '用户登录', count: 560 },
  { time: '01-12', type: '商品浏览', count: 470 },
  { time: '01-12', type: '添加购物车', count: 320 },
  { time: '01-12', type: '订单完成', count: 220 },
  { time: '01-13', type: '用户登录', count: 600 },
  { time: '01-13', type: '商品浏览', count: 510 },
  { time: '01-13', type: '添加购物车', count: 350 },
  { time: '01-13', type: '订单完成', count: 250 },
  { time: '01-14', type: '用户登录', count: 550 },
  { time: '01-14', type: '商品浏览', count: 460 },
  { time: '01-14', type: '添加购物车', count: 310 },
  { time: '01-14', type: '订单完成', count: 210 },
  { time: '01-15', type: '用户登录', count: 620 },
  { time: '01-15', type: '商品浏览', count: 530 },
  { time: '01-15', type: '添加购物车', count: 370 },
  { time: '01-15', type: '订单完成', count: 260 },
]

/** 模拟错误事件趋势（各日所有错误类型的合计） */
export const mockErrorTrend = [
  { time: '01-09', count: 12 },
  { time: '01-10', count: 8 },
  { time: '01-11', count: 15 },
  { time: '01-12', count: 10 },
  { time: '01-13', count: 18 },
  { time: '01-14', count: 14 },
  { time: '01-15', count: 22 },
]

/** 模拟错误事件（对应 trace-sdk ErrorPayloadBase 字段） */
export const mockErrorEvents = [
  {
    id: 'err-001',
    type: 'js-error',
    message: 'Uncaught TypeError: Cannot read properties of undefined',
    errorName: 'TypeError',
    occurredAt: '2024-01-15 14:23:10',
    duration: 3200,
    url: '/dashboard',
    status: 'active' as const,
  },
  {
    id: 'err-002',
    type: 'promise-error',
    message: 'Unhandled Promise Rejection: Network request failed',
    errorName: 'NetworkError',
    occurredAt: '2024-01-15 13:45:22',
    duration: 1500,
    url: '/api/analytics/overview',
    status: 'active' as const,
  },
  {
    id: 'err-003',
    type: 'resource-error',
    message: 'Failed to load resource: /static/js/chunk-3a2b.js',
    errorName: 'ResourceLoadError',
    occurredAt: '2024-01-15 12:10:05',
    duration: 800,
    url: '/static/js/chunk-3a2b.js',
    status: 'active' as const,
  },
  {
    id: 'err-004',
    type: 'http-error',
    message: 'HTTP 500 Internal Server Error at /api/analytics/event-trend',
    errorName: 'HttpServerError',
    occurredAt: '2024-01-15 11:30:45',
    duration: 2100,
    url: '/api/analytics/event-trend',
    status: 'ignored' as const,
  },
  {
    id: 'err-005',
    type: 'js-error',
    message: 'ReferenceError: $ is not defined',
    errorName: 'ReferenceError',
    occurredAt: '2024-01-15 10:05:18',
    duration: 500,
    url: '/events',
    status: 'resolved' as const,
  },
]

// ─── 告警 Mock 数据 ──────────────────────────────────────────

export const mockAlarmRecords = [
  {
    id: 'alarm-001',
    name: '页面浏览量异常飙升',
    type: '错误量超阈值',
    level: 'critical' as const,
    status: 'pending' as const,
    appId: 'app001',
    rule: 'page_view > 10000',
    message:
      '页面 page_view 事件量在 5 分钟内从均值 2000 飙升至 18500，超过阈值 10000，触发严重告警',
    data: { eventName: 'page_view', currentValue: 18500, threshold: 10000, operator: 'gt' },
    createdAt: '2026-07-30T08:15:00.000Z',
    updatedAt: '2026-07-30T08:15:00.000Z',
  },
  {
    id: 'alarm-002',
    name: 'API 响应延迟超过 2s',
    type: 'API响应延迟',
    level: 'high' as const,
    status: 'processing' as const,
    appId: 'app001',
    rule: 'api_call > 阈值',
    message:
      '/api/analytics/overview 接口 P99 延迟达到 3200ms，超过告警阈值 2000ms，已持续 10 分钟',
    data: {
      endpoint: '/api/analytics/overview',
      p99Latency: 3200,
      threshold: 2000,
      duration: '10m',
    },
    createdAt: '2026-07-30T06:42:00.000Z',
    updatedAt: '2026-07-30T07:10:00.000Z',
  },
  {
    id: 'alarm-003',
    name: '商品详情页 404 错误',
    type: '页面404错误',
    level: 'medium' as const,
    status: 'resolved' as const,
    appId: 'app001',
    rule: 'error > 100',
    message: '/product/detail 页面返回 404 状态码，近 1 小时内发生 156 次，影响用户浏览商品',
    data: { url: '/product/detail', statusCode: 404, count: 156, threshold: 100 },
    createdAt: '2026-07-29T14:30:00.000Z',
    updatedAt: '2026-07-29T16:45:00.000Z',
  },
  {
    id: 'alarm-004',
    name: '静态资源 CDN 加载失败',
    type: '资源加载失败',
    level: 'low' as const,
    status: 'closed' as const,
    appId: 'app001',
    rule: '资源加载错误',
    message:
      'CDN 静态资源 /static/js/vendor.chunk.js 加载超时，影响 23 个用户会话，已切换备用 CDN 恢复',
    data: { resource: '/static/js/vendor.chunk.js', affectedUsers: 23, recovered: true },
    createdAt: '2026-07-28T10:05:00.000Z',
    updatedAt: '2026-07-28T11:20:00.000Z',
  },
  {
    id: 'alarm-005',
    name: '用户投诉支付失败',
    type: '用户投诉',
    level: 'critical' as const,
    status: 'pending' as const,
    appId: 'app002',
    rule: '订单完成 < 500',
    message:
      '近 30 分钟内收到 18 条用户投诉，均反馈支付成功后订单状态未更新，订单完成事件量从 850 骤降至 210',
    data: {
      complaintCount: 18,
      eventName: '订单完成',
      currentValue: 210,
      threshold: 500,
      operator: 'lt',
    },
    createdAt: '2026-07-30T09:00:00.000Z',
    updatedAt: '2026-07-30T09:00:00.000Z',
  },
  {
    id: 'alarm-006',
    name: '登录错误率超 5%',
    type: '错误量超阈值',
    level: 'high' as const,
    status: 'processing' as const,
    appId: 'app002',
    rule: '错误率阈值',
    message:
      '用户登录事件错误率从 1.2% 升至 8.7%，近 1 小时登录失败 430 次，怀疑第三方 OAuth 服务异常',
    data: { eventName: '用户登录', errorRate: 0.087, normalRate: 0.012, failedCount: 430 },
    createdAt: '2026-07-30T05:20:00.000Z',
    updatedAt: '2026-07-30T06:00:00.000Z',
  },
  {
    id: 'alarm-007',
    name: '搜索结果 API 响应超时',
    type: 'API响应延迟',
    level: 'medium' as const,
    status: 'resolved' as const,
    appId: 'app002',
    rule: 'API 响应时间',
    message:
      '/api/search 接口平均响应时间 4500ms，触发 medium 级别告警，排查发现 ES 索引刷新导致，已手动优化',
    data: { endpoint: '/api/search', avgLatency: 4500, threshold: 3000, cause: 'ES索引刷新' },
    createdAt: '2026-07-29T11:10:00.000Z',
    updatedAt: '2026-07-29T12:30:00.000Z',
  },
  {
    id: 'alarm-008',
    name: '注册页跳转异常',
    type: '页面404错误',
    level: 'low' as const,
    status: 'closed' as const,
    appId: 'app002',
    rule: '页面错误监控',
    message:
      '/register 页面存在旧版链接引用，少量用户从邮件链接跳转时出现 404，已更新邮件模板中的链接',
    data: { url: '/register', affectedLinks: ['/old-register', '/signup-v1'], fix: '更新邮件模板' },
    createdAt: '2026-07-27T08:45:00.000Z',
    updatedAt: '2026-07-27T09:30:00.000Z',
  },
  {
    id: 'alarm-009',
    name: '订单列表页白屏',
    type: '资源加载失败',
    level: 'critical' as const,
    status: 'pending' as const,
    appId: 'app003',
    rule: 'JS 错误监控',
    message:
      '/orders 页面主 JS chunk 加载失败导致白屏，错误类型 ChunkLoadError，影响全部访问该页面的用户',
    data: { url: '/orders', errorType: 'ChunkLoadError', affectedUsers: 'all', impact: '白屏' },
    createdAt: '2026-07-30T10:30:00.000Z',
    updatedAt: '2026-07-30T10:30:00.000Z',
  },
  {
    id: 'alarm-010',
    name: '商品收藏功能异常',
    type: '用户投诉',
    level: 'high' as const,
    status: 'processing' as const,
    appId: 'app003',
    rule: '用户反馈监控',
    message:
      '12 名用户反馈点击收藏按钮无响应，前端监控显示 fav_add 事件近 2 小时为 0，正常日均约 200 次',
    data: { eventName: 'fav_add', currentValue: 0, dailyAvg: 200, complaintCount: 12 },
    createdAt: '2026-07-30T04:50:00.000Z',
    updatedAt: '2026-07-30T05:30:00.000Z',
  },
  {
    id: 'alarm-011',
    name: '首页点击率下降',
    type: '错误量超阈值',
    level: 'medium' as const,
    status: 'resolved' as const,
    appId: 'app003',
    rule: 'click < 5000',
    message:
      '首页 click 事件从日均 6200 降至 2800，排查发现首页 Banner 轮播组件 JS 报错导致点击区域遮挡',
    data: {
      eventName: 'click',
      currentValue: 2800,
      threshold: 5000,
      operator: 'lt',
      cause: 'Banner JS error',
    },
    createdAt: '2026-07-29T09:15:00.000Z',
    updatedAt: '2026-07-29T14:00:00.000Z',
  },
  {
    id: 'alarm-012',
    name: '用户头像上传接口慢',
    type: 'API响应延迟',
    level: 'low' as const,
    status: 'closed' as const,
    appId: 'app003',
    rule: 'API 响应监控',
    message:
      '/api/upload/avatar 接口 P95 延迟 2800ms，原因是 OSS 上传链路切换导致，已切回原链路恢复',
    data: {
      endpoint: '/api/upload/avatar',
      p95Latency: 2800,
      threshold: 2000,
      cause: 'OSS链路切换',
    },
    createdAt: '2026-07-26T15:20:00.000Z',
    updatedAt: '2026-07-26T16:10:00.000Z',
  },
]

/** 根据时间范围动态生成告警趋势时序数据 */
export function generateMockAlarmTrend(timeRange: string): Array<{ time: string; count: number }> {
  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

  switch (timeRange) {
    case '15m': {
      // 15 分钟：每 1 分钟一个点，共 15 个点
      return Array.from({ length: 15 }, (_, i) => ({
        time: `${String(i).padStart(2, '0')}:00`,
        count: rand(50, 500),
      }))
    }
    case '1h': {
      // 1 小时：每 5 分钟一个点，共 12 个点
      return Array.from({ length: 12 }, (_, i) => ({
        time: `${String(i * 5).padStart(2, '0')}:00`,
        count: rand(50, 500),
      }))
    }
    case '4h': {
      // 4 小时：每 15 分钟一个点，共 16 个点
      return Array.from({ length: 16 }, (_, i) => {
        const h = Math.floor(i / 4)
        const m = (i % 4) * 15
        return {
          time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
          count: rand(50, 500),
        }
      })
    }
    case '1d': {
      // 1 天：每 1 小时一个点，共 24 个点
      return Array.from({ length: 24 }, (_, i) => ({
        time: `${String(i).padStart(2, '0')}:00`,
        count: rand(50, 500),
      }))
    }
    case '7d': {
      // 7 天：每 1 天一个点，共 7 个点
      const days = ['07-24', '07-25', '07-26', '07-27', '07-28', '07-29', '07-30']
      return days.map((day) => ({
        time: day,
        count: rand(50, 500),
      }))
    }
    default: {
      // 默认 1d
      return Array.from({ length: 24 }, (_, i) => ({
        time: `${String(i).padStart(2, '0')}:00`,
        count: rand(50, 500),
      }))
    }
  }
}
