// 类型定义 - 组员B

export type EventType = 'click' | 'exposure' | 'custom'
export type EventStatus = 'active' | 'inactive'
export type ParamValueType = 'string' | 'number' | 'boolean'

export interface EventParam {
  key: string
  valueType: ParamValueType
  isRequired: boolean
  description?: string
}

export interface EventItem {
  id: string
  eventName: string
  description: string
  eventType: EventType
  paramCount: number
  pvCount: number
  uvCount: number
  status: EventStatus
  updatedAt: string
  paramTemplate: EventParam[]
}

export interface FilterCondition {
  paramKey: string
  operator: string
  value: any
}
