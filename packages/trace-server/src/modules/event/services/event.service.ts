import { Injectable, NotFoundException } from '@nestjs/common'
import { EventRepository } from '../repositories/event.repository'
import { GetEventsDto } from '../dto/get-events.dto'
import { CreateEventDto } from '../dto/create-event.dto'
import { UpdateEventDto } from '../dto/update-event.dto'

@Injectable()
export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  findAll(query: GetEventsDto) {
    return this.eventRepository.findAll(query)
  }

  async findById(id: string) {
    const event = await this.eventRepository.findById(id)
    if (!event) throw new NotFoundException('事件不存在')
    return event
  }

  async create(data: CreateEventDto) {
    const event = await this.eventRepository.create(data)
    return { id: event.id.toString(), createdAt: event.createdAt }
  }

  async update(id: string, data: UpdateEventDto) {
    await this.findById(id)
    const event = await this.eventRepository.update(id, data)
    return { id: event.id.toString(), updatedAt: event.updatedAt }
  }

  async remove(id: string): Promise<void> {
    await this.findById(id)
    await this.eventRepository.softDelete(id)
  }
}
