export class Alarm {
  id: string
  alarmName: string
  alarmType: string
  eventName: string
  description: string | null
  conditions: Record<string, any>
  enabled: boolean
  appId: string
  triggeredAt: Date | null
  createdAt: Date | null
  updatedAt: Date | null
}
