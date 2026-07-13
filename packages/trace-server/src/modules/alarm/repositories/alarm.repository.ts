import { Injectable, NotImplementedException } from '@nestjs/common'
import { GetAlarmListDto } from '../dto/get-alarm-list.dto'

@Injectable()
export class AlarmRepository {
  findAll(_query: GetAlarmListDto): never {
    throw new NotImplementedException('云端 MySQL 尚未创建告警表')
  }

  findById(_id: string): never {
    throw new NotImplementedException('云端 MySQL 尚未创建告警表')
  }
}
