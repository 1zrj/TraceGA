import request from '@/utils/request'
import type {
  AlarmItem,
  PagedResponse,
  AlarmQueryDto,
  AlarmTrendItem,
  UpdateAlarmStatusDto,
} from '@/types'

export const getAlarmList = (params: AlarmQueryDto) => {
  return request.get<PagedResponse<AlarmItem>>('/alarm/list', { params })
}

export const getAlarmById = (id: string) => {
  return request.get<AlarmItem>(`/alarm/${id}`)
}

export const getAlarmTrend = (params: { timeRange: string }) => {
  return request.get<AlarmTrendItem[]>('/alarm/trend', { params })
}

export const updateAlarmStatus = (id: string, body: UpdateAlarmStatusDto) => {
  return request.patch<AlarmItem>(`/alarm/${id}/status`, body)
}
