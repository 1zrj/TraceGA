import { Injectable } from '@nestjs/common'
import { Repository, Like, Raw } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { Event } from '../entities/event.entity'
import { GetEventsDto } from '../dto/get-events.dto'
import { paginate, buildPaginationResult } from '@/common/utils'

@Injectable()
export class EventRepository {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {}

  async findAll(query: GetEventsDto) {
    const { page, pageSize, eventType, appId, keyword } = query
    const { skip, take } = paginate(page, pageSize)

    const where: any = {}

    if (eventType) {
      where.eventType = eventType
    }

    if (appId) {
      where.appId = appId
    }

    if (keyword) {
      where.eventName = Raw((alias) => `${alias} ILIKE :keyword`, {
        keyword: `%${keyword}%`,
      })
    }

    const [list, total] = await this.eventRepository.findAndCount({
      where,
      skip,
      take,
      order: { createdAt: 'DESC' },
    })

    return buildPaginationResult(list, total, page, pageSize)
  }

  async findById(id: string): Promise<Event | null> {
    return this.eventRepository.findOne({ where: { id } })
  }

  async create(data: Partial<Event>): Promise<Event> {
    const event = this.eventRepository.create(data)
    return this.eventRepository.save(event)
  }

  async update(id: string, data: Partial<Event>): Promise<Event | null> {
    await this.eventRepository.update(id, data)
    return this.findById(id)
  }

  async softDelete(id: string): Promise<void> {
    await this.eventRepository.softDelete(id)
  }
}
