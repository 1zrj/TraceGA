import { Injectable } from '@nestjs/common'
import { Repository, Raw } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { Alarm } from '../entities/alarm.entity'
import { GetAlarmListDto } from '../dto/get-alarm-list.dto'
import { paginate, buildPaginationResult } from '@/common/utils'

@Injectable()
export class AlarmRepository {
  constructor(
    @InjectRepository(Alarm)
    private alarmRepository: Repository<Alarm>,
  ) {}

  async findAll(query: GetAlarmListDto) {
    const { page, pageSize, alarmType, appId, keyword } = query
    const { skip, take } = paginate(page, pageSize)

    const where: any = {}

    if (alarmType) {
      where.alarmType = alarmType
    }

    if (appId) {
      where.appId = appId
    }

    if (keyword) {
      where.alarmName = Raw((alias) => `${alias} ILIKE :keyword`, {
        keyword: `%${keyword}%`,
      })
    }

    const [list, total] = await this.alarmRepository.findAndCount({
      where,
      skip,
      take,
      order: { createdAt: 'DESC' },
    })

    return buildPaginationResult(list, total, page, pageSize)
  }

  async findById(id: string): Promise<Alarm | null> {
    return this.alarmRepository.findOne({ where: { id } })
  }
}
