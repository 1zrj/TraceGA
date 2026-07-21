import { Module } from '@nestjs/common'
import { TrackController } from './controllers/track.controller'
import { TrackService } from './services/track.service'
import { TrackRepository } from './repositories/track.repository'
import {
  ClickEventProcessor,
  CustomEventProcessor,
  DefaultProcessor,
  ErrorEventProcessor,
  EventProcessorFactory,
  PageViewProcessor,
  PerformanceEventProcessor,
  WhiteScreenProcessor,
} from './processors/event.processor'

@Module({
  controllers: [TrackController],
  providers: [
    TrackService,
    TrackRepository,
    EventProcessorFactory,
    PageViewProcessor,
    CustomEventProcessor,
    ClickEventProcessor,
    ErrorEventProcessor,
    PerformanceEventProcessor,
    WhiteScreenProcessor,
    DefaultProcessor,
  ],
  exports: [TrackService],
})
export class TrackModule {}
