export interface Alarm {
  id: string
  alarmName: string
  alarmType: string
  eventName: string
  description?: string
  conditions: Record<string, unknown>
  enabled: boolean
  appId: string
  triggeredAt?: Date
  createdAt: Date
  updatedAt: Date
}
