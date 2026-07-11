import request from '@/utils/request'
import type {
  AnalyticsOverview,
  TrendData,
  SummaryQueryDto,
  TrendQueryDto,
  FilterQueryDto,
} from '@/types'

export const getSummary = (params: SummaryQueryDto) => {
  return request.get<AnalyticsOverview>('/analysis/summary', { params })
}

export const getTrend = (params: TrendQueryDto) => {
  return request.get<TrendData[]>('/analysis/trend', { params })
}

export const filterData = (data: FilterQueryDto) => {
  return request.post<{ list: unknown[]; total: number }>('/analysis/filter', data)
}