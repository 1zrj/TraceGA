import { Injectable } from '@nestjs/common'
import { Repository } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { TrackEvent, TrackEntity } from '../entities/track.entity'
import { generateId } from '@/common/utils'

@Injectable()
export class TrackRepository {
  constructor(
    @InjectRepository(TrackEntity)
    private readonly trackRepository: Repository<TrackEntity>,
  ) {}

  async insertEvent(event: TrackEvent, ip: string, userAgent: string): Promise<void> {
    const entity = this.trackRepository.create({
      eventId: event.eventId || generateId('evt'),
      eventType: event.eventType,
      eventName: event.eventName,
      appId: event.appId,
      userId: event.userId || '',
      sessionId: event.sessionId || '',
      properties: event.properties || {},
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      url: event.url || '',
      referrer: event.referrer || '',
      userAgent: userAgent || '',
      ip: ip || '',
    })

    await this.trackRepository.save(entity)
  }

  async insertBatch(events: TrackEvent[], ip: string, userAgent: string): Promise<void> {
    const entities = events.map((event) =>
      this.trackRepository.create({
        eventId: event.eventId || generateId('evt'),
        eventType: event.eventType,
        eventName: event.eventName,
        appId: event.appId,
        userId: event.userId || '',
        sessionId: event.sessionId || '',
        properties: event.properties || {},
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
        url: event.url || '',
        referrer: event.referrer || '',
        userAgent: userAgent || '',
        ip: ip || '',
      }),
    )

    await this.trackRepository.save(entities)
  }
}