export interface Event {
  id: string
  name: string
  type: string
  timestamp: string
  properties: Record<string, unknown>
  userId?: string
  sessionId?: string
}

export interface PageInfo {
  page: number
  pageSize: number
  total: number
}

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface AnalyticsOverview {
  totalEvents: number
  totalUsers: number
  avgSessionDuration: number
  conversionRate: number
}

export interface EventTrend {
  time: string
  count: number
}

export interface TopEvent {
  name: string
  count: number
  percentage: number
}

/** 按事件类型分组的多日趋势数据 */
export interface EventTypeTrendItem {
  time: string
  type: string
  count: number
}

export interface FilterItem {
  key: string
  label: string
  type: 'input' | 'select' | 'date'
  options?: { value: string; label: string }[]
  placeholder?: string
}

/** 错误事件（对应 trace-sdk ErrorPayloadBase + 前端扩展字段） */
export interface ErrorEventItem {
  id: string
  type: string
  message: string
  errorName: string
  occurredAt: string
  duration?: number
  url?: string
  status: 'active' | 'resolved' | 'ignored'
}
