import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TrackController } from './controllers/track.controller'
import { TrackService } from './services/track.service'
import { TrackRepository } from './repositories/track.repository'
import { TrackEntity } from './entities/track.entity'
import {
  EventProcessorFactory,
  PageViewProcessor,
  CustomEventProcessor,
  ClickEventProcessor,
  DefaultProcessor,
} from './processors/event.processor'

@Module({
  imports: [TypeOrmModule.forFeature([TrackEntity])],
  controllers: [TrackController],
  providers: [
    TrackService,
    TrackRepository,
    EventProcessorFactory,
    PageViewProcessor,
    CustomEventProcessor,
    ClickEventProcessor,
    DefaultProcessor,
  ],
  exports: [TrackService],
})
export class TrackModule {}