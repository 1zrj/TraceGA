import { Module } from '@nestjs/common';
import { AlarmController } from './controllers/alarm.controller';
import { AlarmService } from './services/alarm.service';
import { AlarmRepository } from './repositories/alarm.repository';
import { AlarmSchedulerService } from './services/alarm-scheduler.service';
import { AlarmNotifyService } from './services/alarm-notify.service';

@Module({
  controllers: [AlarmController],
  providers: [AlarmService, AlarmRepository, AlarmSchedulerService, AlarmNotifyService],
  exports: [AlarmService],
})
export class AlarmModule {}
