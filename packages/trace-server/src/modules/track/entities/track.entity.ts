export interface TrackEvent {
  eventId?: string
  eventType: string
  eventName: string
  appId: string
  userId?: string
  sessionId?: string
  properties?: Record<string, any>
  timestamp?: number
  url?: string
  referrer?: string
  userAgent?: string
  ip?: string
}