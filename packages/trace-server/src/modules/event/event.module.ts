import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EventController } from './controllers/event.controller'
import { EventService } from './services/event.service'
import { EventRepository } from './repositories/event.repository'
import { Event } from './entities/event.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Event])],
  controllers: [EventController],
  providers: [EventService, EventRepository],
  exports: [EventService],
})
export class EventModule {}
