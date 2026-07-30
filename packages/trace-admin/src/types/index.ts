// ─── 通用分页类型 ─────────────────────────────────────────

export interface PagedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// ─── 事件类型 ────────────────────────────────────────────

export interface Event {
  id: string
  eventName: string
  eventType: string
  appId: string
  description?: string
  propertySchema?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface EventQueryDto {
  page?: number
  pageSize?: number
  keyword?: string
  eventType?: string
  appId?: string
  startTime?: string
  endTime?: string
}

// ─── 告警类型 ────────────────────────────────────────────

export interface AlarmItem {
  id: string
  name: string
  type: string
  level: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'processing' | 'resolved' | 'closed'
  appId: string
  rule: string
  message: string
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface AlarmQueryDto {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  level?: string
  appId?: string
  startTime?: string
  endTime?: string
}

export interface AlarmTrendItem {
  time: string
  count: number
}

export interface UpdateAlarmStatusDto {
  status: 'processing' | 'resolved' | 'closed'
  remark?: string
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

/** 分析概览（首页用） */
export interface AnalysisSummary {
  pv: number
  uv: number
  rate: string
  startTime: string
  endTime: string
  eventCount: number
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

// ─── Auth 类型 ─────────────────────────────────────────────

export interface LoginDto {
  email: string
  password: string
}

/** 后端 UserWithoutPassword 类型 */
export interface UserProfile {
  id: string
  username: string
  email: string
  phone: string
  role: string
  avatar: string | null
  status: number
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface LoginResult {
  token: string
  user: UserProfile
}

export interface RegisterDto {
  username: string
  email: string
  phone: string
  password: string
  role?: string
}

export type RegisterResult = LoginResult

export type ProfileResult = UserProfile

// ─── AI 类型 ───────────────────────────────────────────────

export interface AiAnalyzeDto {
  appId?: string
  analysisType?: string
  eventNames?: string[]
  startTime?: string
  endTime?: string
  prompt?: string
  question?: string
}

export interface AiAnalysisResult {
  conclusion: string
  suggestions: string[]
  metrics?: {
    pv: number
    uv: number
    eventCount: number
  }
  trend?: Array<{ time: string; pv: number; uv: number }>
}

export interface DailyReportDto {
  appId: string
  date?: string
}

export interface DailyReportResult {
  stats: {
    date: string
    totalPv: number
    totalUv: number
    pvChange: number
    uvChange: number
    topEvents: Array<{ eventName: string; pv: number }>
    eventTrends: Array<{ eventName: string; pv: number; pvChange: number }>
    errorEvents: Array<{ eventName: string; count: number }>
  }
  report: string
  generatedAt: string
}

export interface AnomalyExplainDto {
  appId: string
  eventName: string
  currentValue?: number
  previousValue?: number
  compareLabel?: string
  context?: {
    pageChange?: number
    pageUrl?: string
    releaseNotes?: string
    additionalInfo?: string
  }
}

export interface AnomalyExplainResult {
  eventName: string
  currentValue: number
  previousValue: number
  changePercent: number
  compareLabel: string
  possibleReasons: string[]
  suggestions: string[]
  rawContext: object
  generatedAt: string
}

export interface NlQueryDto {
  appId: string
  question: string
}

export interface NlQueryResult {
  question: string
  queryJson: {
    startTime: string
    endTime: string
    eventTypes: string[]
    limit: number
    orderBy: 'asc' | 'desc'
  }
  data: unknown[]
  answer: string
  generatedAt: string
}

export interface RecommendDto {
  appId: string
  description: string
}

export interface Recommendation {
  eventName: string
  eventType: string
  trigger: string
  params: string
}

export interface RecommendResult {
  appId: string
  description: string
  recommendations: Recommendation[]
  generatedAt: string
  error?: string
}

// ─── Analysis 类型（/analysis 路由） ──────────────────────

export interface AnalysisSummaryDto {
  appId?: string
  startTime?: string
  endTime?: string
}

export interface AnalysisTrendDto {
  appId?: string
  eventType?: string
  startTime?: string
  endTime?: string
  interval?: string
}

export interface AnalysisTrendItem {
  time: string
  pv: number
  count?: number
}

export interface AnalysisFilterDto {
  appId?: string
  eventTypes?: string[]
  startTime?: string
  endTime?: string
  filters?: Record<string, any>[]
}

export interface AnalysisFilterItem {
  event_name: string
  count: number
  [key: string]: unknown
}
