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

export interface TrackEventDefinition {
  appId: string
  eventName: string
  eventType: string
}

export interface TrackFailure {
  index: number
  eventId: string | null
  reason: string
}

export interface TrackResult {
  eventId: string | null
  received: true
}

export interface TrackBatchResult {
  successCount: number
  failedCount: number
  failures: TrackFailure[]
}
