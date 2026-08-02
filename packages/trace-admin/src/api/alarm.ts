import request from '@/utils/request'
import type {
  AlarmItem,
  PagedResponse,
  AlarmQueryDto,
  AlarmTrendItem,
  UpdateAlarmStatusDto,
  AlarmRuleItem,
  CreateAlarmRuleDto,
  UpdateAlarmRuleDto,
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

// ─── 告警规则 ─────────────────────────────────────────────

export const getAlarmRules = (params: AlarmQueryDto) => {
  return request.get<PagedResponse<AlarmRuleItem>>('/alarm/rules', { params })
}

export const createAlarmRule = (body: CreateAlarmRuleDto) => {
  return request.post<AlarmRuleItem>('/alarm/rules', body)
}

export const updateAlarmRule = (id: string, body: UpdateAlarmRuleDto) => {
  return request.patch<AlarmRuleItem>(`/alarm/rules/${id}`, body)
}

export const deleteAlarmRule = (id: string) => {
  return request.delete<AlarmRuleItem>(`/alarm/rules/${id}`)
}
