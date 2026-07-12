import { Controller, Get, Param, Query } from '@nestjs/common'
import { AlarmService } from '../services/alarm.service'
import { GetAlarmListDto } from '../dto/get-alarm-list.dto'

@Controller('api/alarm')
export class AlarmController {
  constructor(private readonly alarmService: AlarmService) {}

  @Get('list')
  findAll(@Query() query: GetAlarmListDto) {
    return this.alarmService.findAll(query)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.alarmService.findById(id)
  }
}
