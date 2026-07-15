import { Injectable } from '@nestjs/common'
import { Alarm } from '../entities/alarm.entity'
import { GetAlarmListDto } from '../dto/get-alarm-list.dto'
import { buildPaginationResult } from '@/common/utils'

@Injectable()
export class AlarmRepository {
  async findAll(query: GetAlarmListDto) {
    const { page = 1, pageSize = 20 } = query

    return buildPaginationResult<Alarm>([], 0, page, pageSize)
  }

  async findById(id: string): Promise<Alarm | null> {
    return null
  }
}
