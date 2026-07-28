import { Injectable } from '@nestjs/common'
import { TrackEvent } from '../entities/track.entity'

export interface EventProcessor {
  canProcess(eventType: string): boolean
  process(event: TrackEvent): TrackEvent
}

@Injectable()
export class PageViewProcessor implements EventProcessor {
  canProcess(eventType: string): boolean {
    return eventType === 'page_view'
  }

  process(event: TrackEvent): TrackEvent {
    return event
  }
}

@Injectable()
export class CustomEventProcessor implements EventProcessor {
  canProcess(eventType: string): boolean {
    return eventType === 'custom'
  }

  process(event: TrackEvent): TrackEvent {
    return event
  }
}

@Injectable()
export class ClickEventProcessor implements EventProcessor {
  canProcess(eventType: string): boolean {
    return eventType === 'click'
  }

  process(event: TrackEvent): TrackEvent {
    return event
  }
}

@Injectable()
export class DefaultProcessor implements EventProcessor {
  canProcess(eventType: string): boolean {
    return true
  }

  process(event: TrackEvent): TrackEvent {
    return event
  }
}

@Injectable()
export class EventProcessorFactory {
  private processors: EventProcessor[]

  constructor(
    private pageViewProcessor: PageViewProcessor,
    private customEventProcessor: CustomEventProcessor,
    private clickEventProcessor: ClickEventProcessor,
    private defaultProcessor: DefaultProcessor,
  ) {
    this.processors = [
      this.pageViewProcessor,
      this.customEventProcessor,
      this.clickEventProcessor,
      this.defaultProcessor,
    ]
  }

  getProcessor(eventType: string): EventProcessor {
    return this.processors.find((p) => p.canProcess(eventType)) || this.defaultProcessor
  }
}
