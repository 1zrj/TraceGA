import { Module } from '@nestjs/common'
import { TrackController } from './controllers/track.controller'
import { TrackService } from './services/track.service'
import { TrackRepository } from './repositories/track.repository'
import {
  EventProcessorFactory,
  PageViewProcessor,
  CustomEventProcessor,
  ClickEventProcessor,
  DefaultProcessor,
} from './processors/event.processor'
import { ClickHouseService } from '@/database/clickhouse.service'

@Module({
  controllers: [TrackController],
  providers: [
    TrackService,
    TrackRepository,
    ClickHouseService,
    EventProcessorFactory,
    PageViewProcessor,
    CustomEventProcessor,
    ClickEventProcessor,
    DefaultProcessor,
  ],
  exports: [TrackService],
})
export class TrackModule {}
