import { Injectable, NotFoundException } from '@nestjs/common'
import { EventRepository } from '../repositories/event.repository'
import { GetEventsDto } from '../dto/get-events.dto'
import { CreateEventDto } from '../dto/create-event.dto'
import { UpdateEventDto } from '../dto/update-event.dto'
import { Event } from '../entities/event.entity'

@Injectable()
export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  async findAll(query: GetEventsDto) {
    return this.eventRepository.findAll(query)
  }

  async findById(id: string): Promise<Event> {
    const event = await this.eventRepository.findById(id)
    if (!event) {
      throw new NotFoundException('事件不存在')
    }
    return event
  }

  async create(createEventDto: CreateEventDto) {
    const event = await this.eventRepository.create(createEventDto)
    return {
      id: event.id,
      createdAt: event.createdAt,
    }
  }

  async update(id: string, updateEventDto: UpdateEventDto) {
    const event = await this.findById(id)
    const updated = await this.eventRepository.update(id, updateEventDto)
    return {
      id: updated.id,
      updatedAt: updated.updatedAt,
    }
  }

  async remove(id: string): Promise<void> {
    await this.findById(id)
    await this.eventRepository.softDelete(id)
  }
}
