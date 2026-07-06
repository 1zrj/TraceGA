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

export interface FilterItem {
  key: string
  label: string
  type: 'input' | 'select' | 'date'
  options?: { value: string; label: string }[]
  placeholder?: string
}