import { Injectable } from '@nestjs/common'
import { ClickHouseService } from '@/database/clickhouse.service'
import { TrackEvent, TrackEventEntity } from '../entities/track.entity'
import { generateId } from '@/common/utils'

@Injectable()
export class TrackRepository {
  constructor(private readonly clickHouseService: ClickHouseService) {}

  async insertEvent(event: TrackEvent, ip: string, userAgent: string): Promise<void> {
    const entity: TrackEventEntity = {
      event_id: event.eventId || generateId('evt'),
      event_type: event.eventType,
      event_name: event.eventName,
      app_id: event.appId,
      user_id: event.userId || '',
      session_id: event.sessionId || '',
      properties: JSON.stringify(event.properties || {}),
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      url: event.url || '',
      referrer: event.referrer || '',
      user_agent: userAgent,
      ip,
      created_at: new Date(),
    }

    await this.clickHouseService.insert('events', [entity])
  }

  async insertBatch(events: TrackEvent[], ip: string, userAgent: string): Promise<void> {
    const entities: TrackEventEntity[] = events.map((event) => ({
      event_id: event.eventId || generateId('evt'),
      event_type: event.eventType,
      event_name: event.eventName,
      app_id: event.appId,
      user_id: event.userId || '',
      session_id: event.sessionId || '',
      properties: JSON.stringify(event.properties || {}),
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      url: event.url || '',
      referrer: event.referrer || '',
      user_agent: userAgent,
      ip,
      created_at: new Date(),
    }))

    await this.clickHouseService.insert('events', entities)
  }
}
