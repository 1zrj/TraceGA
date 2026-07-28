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

export interface TrackEventEntity {
  event_id: string
  event_type: string
  event_name: string
  app_id: string
  user_id: string
  session_id: string
  properties: string
  timestamp: Date
  url: string
  referrer: string
  user_agent: string
  ip: string
  created_at: Date
}
