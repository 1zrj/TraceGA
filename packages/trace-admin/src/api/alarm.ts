import request from '@/utils/request'
import type { AlarmItem, PagedResponse, AlarmQueryDto } from '@/types'

export const getAlarmList = (params: AlarmQueryDto) => {
  return request.get<PagedResponse<AlarmItem>>('/alarm/list', { params })
}

export const getAlarmById = (id: string) => {
  return request.get<AlarmItem>(`/alarm/${id}`)
}