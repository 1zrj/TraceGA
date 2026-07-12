import { Injectable, NotFoundException } from '@nestjs/common'
import { AlarmRepository } from '../repositories/alarm.repository'
import { GetAlarmListDto } from '../dto/get-alarm-list.dto'

@Injectable()
export class AlarmService {
  constructor(private readonly alarmRepository: AlarmRepository) {}

  async findAll(query: GetAlarmListDto) {
    return this.alarmRepository.findAll(query)
  }

  async findById(id: string) {
    const alarm = await this.alarmRepository.findById(id)
    if (!alarm) {
      throw new NotFoundException('报警记录不存在')
    }
    return alarm
  }
}
