import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { TrackRepository } from '../repositories/track.repository'
import { TrackEventDto } from '../dto/track-event.dto'
import { TrackBatchDto } from '../dto/track-batch.dto'
import { EventProcessorFactory } from '../processors/event.processor'
import { TrackBatchResult, TrackEvent, TrackEventDefinition, TrackFailure, TrackResult } from '../entities/track.entity'

@Injectable()
export class TrackService {
  constructor(
    private readonly trackRepository: TrackRepository,
    private readonly processorFactory: EventProcessorFactory,
  ) {}

  async trackEvent(eventDto: TrackEventDto, ip: string, userAgent: string): Promise<TrackResult> {
    const [projects, definitions] = await Promise.all([
      this.trackRepository.findExistingProjects([eventDto.appId]),
      this.trackRepository.findActiveEventDefinitions([eventDto.appId], [eventDto.eventName]),
    ])
    this.validateBusinessRules(eventDto, projects, definitions)

    const processor = this.processorFactory.getProcessor(eventDto.eventType)
    const processedEvent = processor.process(eventDto)
    await this.trackRepository.insertEvent(processedEvent, ip, userAgent)
    return { eventId: eventDto.eventId ?? null, received: true }
  }

  async trackBatch(batchDto: TrackBatchDto, ip: string, userAgent: string): Promise<TrackBatchResult> {
    const appIds = batchDto.events.map(event => event.appId)
    const eventNames = batchDto.events.map(event => event.eventName)
    const [projects, definitions] = await Promise.all([this.trackRepository.findExistingProjects(appIds), this.trackRepository.findActiveEventDefinitions(appIds, eventNames)])

    const eventIds = new Set<string>()
    const processedEvents: TrackEvent[] = []
    const failures: TrackFailure[] = []

    for (const [index, event] of batchDto.events.entries()) {
      if (event.eventId && eventIds.has(event.eventId)) {
        failures.push({
          index,
          eventId: event.eventId,
          reason: 'duplicated eventId in batch',
        })
        continue
      }

      if (event.eventId) {
        eventIds.add(event.eventId)
      }

      try {
        this.validateBusinessRules(event, projects, definitions)
        const processor = this.processorFactory.getProcessor(event.eventType)
        processedEvents.push(processor.process(event))
      } catch (error) {
        failures.push({
          index,
          eventId: event.eventId ?? null,
          reason: this.getFailureReason(error),
        })
      }
    }

    await this.trackRepository.insertBatch(processedEvents, ip, userAgent)

    return {
      successCount: processedEvents.length,
      failedCount: failures.length,
      failures,
    }
  }

  private validateBusinessRules(event: TrackEventDto, projects: Set<string>, definitions: TrackEventDefinition[]): void {
    if (!projects.has(event.appId)) {
      throw new NotFoundException('appId does not exist')
    }

    const definition = definitions.find(item => item.appId === event.appId && item.eventName === event.eventName)
    if (!definition) {
      throw new NotFoundException('eventName does not exist or is disabled')
    }

    if (definition.eventType && definition.eventType !== event.eventType) {
      throw new BadRequestException('eventType does not match the event definition')
    }
  }

  private getFailureReason(error: unknown): string {
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      const response = error.getResponse()
      if (typeof response === 'string') {
        return response
      }
      const message = (response as { message?: string | string[] }).message
      return Array.isArray(message) ? message.join(', ') : (message ?? error.message)
    }

    return 'event processing failed'
  }
}
