export class Alarm {
  id: string
  appId: string
  eventName: string
  threshold: number
  operator: string
  notifyType: string
  status: number
  createdAt: Date | null
  updatedAt: Date | null
}