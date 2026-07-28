import { Injectable } from '@nestjs/common'
import { TrackRepository } from '../repositories/track.repository'
import { TrackEventDto } from '../dto/track-event.dto'
import { TrackBatchDto } from '../dto/track-batch.dto'
import { EventProcessorFactory } from '../processors/event.processor'

@Injectable()
export class TrackService {
  constructor(
    private readonly trackRepository: TrackRepository,
    private readonly processorFactory: EventProcessorFactory,
  ) {}

  async trackEvent(eventDto: TrackEventDto, ip: string, userAgent: string): Promise<void> {
    const processor = this.processorFactory.getProcessor(eventDto.eventType)
    const processedEvent = processor.process(eventDto as any)
    await this.trackRepository.insertEvent(processedEvent, ip, userAgent)
  }

  async trackBatch(batchDto: TrackBatchDto, ip: string, userAgent: string): Promise<void> {
    const processedEvents = batchDto.events.map((event) => {
      const processor = this.processorFactory.getProcessor(event.eventType)
      return processor.process(event as any)
    })
    await this.trackRepository.insertBatch(processedEvents, ip, userAgent)
  }
}
