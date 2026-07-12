import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AlarmController } from './controllers/alarm.controller'
import { AlarmService } from './services/alarm.service'
import { AlarmRepository } from './repositories/alarm.repository'
import { Alarm } from './entities/alarm.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Alarm])],
  controllers: [AlarmController],
  providers: [AlarmService, AlarmRepository],
  exports: [AlarmService],
})
export class AlarmModule {}
