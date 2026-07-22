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

// ─── Auth 类型 ─────────────────────────────────────────────

export interface LoginDto {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: {
    id: string
    username: string
    name: string
    avatar?: string
    email?: string
  }
}

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
