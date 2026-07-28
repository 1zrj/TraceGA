import request from '@/utils/request'
import type { AnalyticsOverview, EventTrend, TopEvent } from '@/types'

export const getOverview = (params: {
  startTime?: string
  endTime?: string
}) => {
  return request.get<{ data: AnalyticsOverview }>('/api/analytics/overview', { params })
}

export const getEventTrend = (params: {
  startTime?: string
  endTime?: string
  interval?: 'hour' | 'day' | 'week'
}) => {
  return request.get<{ data: EventTrend[] }>('/api/analytics/event-trend', { params })
}

export const getTopEvents = (params: {
  limit?: number
  startTime?: string
  endTime?: string
}) => {
  return request.get<{ data: TopEvent[] }>('/api/analytics/top-events', { params })
}

export const getConversionRate = (params: {
  startTime?: string
  endTime?: string
}) => {
  return request.get<{ data: { rate: number } }>('/api/analytics/conversion-rate', { params })
}