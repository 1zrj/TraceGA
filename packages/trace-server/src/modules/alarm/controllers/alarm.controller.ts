import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AlarmService } from '../services/alarm.service';
import { GetAlarmListDto } from '../dto/get-alarm-list.dto';
import { GetAlarmTrendDto } from '../dto/get-alarm-trend.dto';
import { UpdateAlarmStatusDto } from '../dto/update-alarm-status.dto';
import { CreateAlarmRuleDto } from '../dto/create-alarm-rule.dto';
import { UpdateAlarmRuleDto } from '../dto/update-alarm-rule.dto';

@Controller('api/alarm')
export class AlarmController {
  constructor(private readonly alarmService: AlarmService) {}

  @Get('list')
  findAll(@Query() query: GetAlarmListDto) {
    return this.alarmService.findAll(query);
  }

  @Get('trend')
  findTrend(@Query() query: GetAlarmTrendDto) {
    return this.alarmService.findTrend(query);
  }

  @Get('rules')
  findRules(@Query() query: GetAlarmListDto) {
    return this.alarmService.findRules(query);
  }

  @Get('rules/:id')
  findRule(@Param('id') id: string) {
    return this.alarmService.findRuleById(id);
  }

  @Post('rules')
  createRule(@Body() body: CreateAlarmRuleDto) {
    return this.alarmService.createRule(body);
  }

  @Patch('rules/:id')
  updateRule(@Param('id') id: string, @Body() body: UpdateAlarmRuleDto) {
    return this.alarmService.updateRule(id, body);
  }

  @Delete('rules/:id')
  removeRule(@Param('id') id: string) {
    return this.alarmService.removeRule(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.alarmService.findById(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateAlarmStatusDto) {
    return this.alarmService.updateStatus(id, body);
  }
}
