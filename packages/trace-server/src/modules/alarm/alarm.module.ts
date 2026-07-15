import { Module } from '@nestjs/common'
import { AlarmController } from './controllers/alarm.controller'
import { AlarmService } from './services/alarm.service'
import { AlarmRepository } from './repositories/alarm.repository'

@Module({
  controllers: [AlarmController],
  providers: [AlarmService, AlarmRepository],
  exports: [AlarmService],
})
export class AlarmModule {}
