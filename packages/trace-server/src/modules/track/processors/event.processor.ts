import { BadRequestException, Injectable } from '@nestjs/common'
import { TrackEvent } from '../entities/track.entity'

const MAX_PROPERTIES_BYTES = 10 * 1024
const MAX_PROPERTY_DEPTH = 5
const MAX_PROPERTY_KEYS = 100
const MAX_PROPERTY_STRING_LENGTH = 512
const REDACTED_VALUE = '[REDACTED]'
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const SENSITIVE_KEYS = new Set(['authorization', 'cookie', 'password', 'passwd', 'secret', 'token', 'access_token', 'refresh_token', 'phone', 'mobile', 'id_card'])

export interface EventProcessor {
  canProcess(eventType: string): boolean
  process(event: TrackEvent): TrackEvent
}

abstract class BaseEventProcessor implements EventProcessor {
  abstract canProcess(eventType: string): boolean

  process(event: TrackEvent): TrackEvent {
    const processed = this.sanitizeEvent(event)
    this.validate(processed)
    return processed
  }

  protected validate(_event: TrackEvent): void {}

  private sanitizeEvent(event: TrackEvent): TrackEvent {
    const properties = event.properties ? (this.sanitizeValue(event.properties, 0) as Record<string, any>) : undefined

    if (properties && Buffer.byteLength(JSON.stringify(properties), 'utf8') > MAX_PROPERTIES_BYTES) {
      throw new BadRequestException('properties must not exceed 10 KB')
    }

    return {
      ...event,
      eventId: event.eventId?.trim(),
      eventType: event.eventType.trim(),
      eventName: event.eventName.trim(),
      appId: event.appId.trim(),
      userId: event.userId?.trim() || undefined,
      sessionId: event.sessionId?.trim() || undefined,
      url: event.url?.trim() || undefined,
      referrer: event.referrer?.trim() || undefined,
      properties,
    }
  }

  private sanitizeValue(value: unknown, depth: number, key?: string): unknown {
    if (depth > MAX_PROPERTY_DEPTH) {
      throw new BadRequestException(`properties depth must not exceed ${MAX_PROPERTY_DEPTH}`)
    }

    if (key && SENSITIVE_KEYS.has(key.toLowerCase())) {
      return REDACTED_VALUE
    }

    if (typeof value === 'string') {
      return value.trim().slice(0, MAX_PROPERTY_STRING_LENGTH)
    }

    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new BadRequestException('properties must contain finite numbers')
    }

    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeValue(item, depth + 1))
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
      if (entries.length > MAX_PROPERTY_KEYS) {
        throw new BadRequestException(`properties must not exceed ${MAX_PROPERTY_KEYS} keys per object`)
      }

      return Object.fromEntries(
        entries
          .map(([entryKey, entryValue]): [string, unknown] => {
            const normalizedKey = entryKey.trim()
            return [normalizedKey, this.sanitizeValue(entryValue, depth + 1, normalizedKey)]
          })
          .filter(([entryKey]) => !UNSAFE_KEYS.has(entryKey)),
      )
    }

    return value
  }
}

@Injectable()
export class PageViewProcessor extends BaseEventProcessor {
  canProcess(eventType: string): boolean {
    return eventType === 'page_view'
  }

  protected validate(event: TrackEvent): void {
    if (!event.url) {
      throw new BadRequestException('url is required for page_view events')
    }
  }
}

@Injectable()
export class CustomEventProcessor extends BaseEventProcessor {
  canProcess(eventType: string): boolean {
    return eventType === 'custom'
  }
}

@Injectable()
export class ClickEventProcessor extends BaseEventProcessor {
  canProcess(eventType: string): boolean {
    return eventType === 'click'
  }

  protected validate(event: TrackEvent): void {
    const properties = event.properties ?? {}
    const hasTarget = ['buttonId', 'buttonName', 'elementId', 'button_id', 'button_name', 'element_id'].some(key => typeof properties[key] === 'string' && properties[key].trim())

    if (!hasTarget) {
      throw new BadRequestException('click events require a button or element identifier')
    }
  }
}

@Injectable()
export class ErrorEventProcessor extends BaseEventProcessor {
  canProcess(eventType: string): boolean {
    return eventType === 'error'
  }

  protected validate(event: TrackEvent): void {
    if (typeof event.properties?.message !== 'string' || !event.properties.message.trim()) {
      throw new BadRequestException('message is required for error events')
    }
  }
}

@Injectable()
export class PerformanceEventProcessor extends BaseEventProcessor {
  canProcess(eventType: string): boolean {
    return eventType === 'performance'
  }

  protected validate(event: TrackEvent): void {
    const metrics = Object.values(event.properties ?? {}).filter(value => typeof value === 'number')
    if (metrics.length === 0 || metrics.some(value => value < 0)) {
      throw new BadRequestException('performance events require non-negative numeric metrics')
    }
  }
}

@Injectable()
export class WhiteScreenProcessor extends BaseEventProcessor {
  canProcess(eventType: string): boolean {
    return eventType === 'white_screen'
  }

  protected validate(event: TrackEvent): void {
    const blankDuration = event.properties?.blankDuration ?? event.properties?.blank_duration
    const domCount = event.properties?.domCount ?? event.properties?.dom_count
    if (typeof blankDuration !== 'number' || blankDuration < 0 || typeof domCount !== 'number' || domCount < 0) {
      throw new BadRequestException('white_screen events require blankDuration and domCount')
    }
  }
}

@Injectable()
export class DefaultProcessor extends BaseEventProcessor {
  canProcess(eventType: string): boolean {
    return true
  }
}

@Injectable()
export class EventProcessorFactory {
  private processors: EventProcessor[]

  constructor(
    private pageViewProcessor: PageViewProcessor,
    private customEventProcessor: CustomEventProcessor,
    private clickEventProcessor: ClickEventProcessor,
    private errorEventProcessor: ErrorEventProcessor,
    private performanceEventProcessor: PerformanceEventProcessor,
    private whiteScreenProcessor: WhiteScreenProcessor,
    private defaultProcessor: DefaultProcessor,
  ) {
    this.processors = [
      this.pageViewProcessor,
      this.customEventProcessor,
      this.clickEventProcessor,
      this.errorEventProcessor,
      this.performanceEventProcessor,
      this.whiteScreenProcessor,
      this.defaultProcessor,
    ]
  }

  getProcessor(eventType: string): EventProcessor {
    return this.processors.find(p => p.canProcess(eventType)) || this.defaultProcessor
  }
}
