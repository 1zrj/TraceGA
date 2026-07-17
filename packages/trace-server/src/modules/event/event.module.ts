import { Module } from '@nestjs/common'
import { EventController } from './controllers/event.controller'
import { EventService } from './services/event.service'
import { EventRepository } from './repositories/event.repository'

@Module({
  controllers: [EventController],
  providers: [EventService, EventRepository],
  exports: [EventService],
})
export class EventModule {}
