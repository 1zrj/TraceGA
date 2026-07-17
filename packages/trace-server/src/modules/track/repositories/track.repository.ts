import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../database/prisma.service'
import { TrackEvent } from '../entities/track.entity'

@Injectable()
export class TrackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insertEvent(event: TrackEvent, ip: string, userAgent: string): Promise<void> {
    await this.prisma.event_log.create({
      data: {
        project_id: event.appId,
        event_name: event.eventName,
        event_type: event.eventType,
        uid: event.userId || '',
        session_id: event.sessionId || '',
        page_url: event.url || '',
        event_params: event.properties || {},
        common_params: {},
        user_agent: userAgent || '',
        ip: ip || '',
      },
    })
  }

  async insertBatch(events: TrackEvent[], ip: string, userAgent: string): Promise<void> {
    const data = events.map((event) => ({
      project_id: event.appId,
      event_name: event.eventName,
      event_type: event.eventType,
      uid: event.userId || '',
      session_id: event.sessionId || '',
      page_url: event.url || '',
      event_params: event.properties || {},
      common_params: {},
      user_agent: userAgent || '',
      ip: ip || '',
    }))

    await this.prisma.event_log.createMany({
      data,
    })
  }
}