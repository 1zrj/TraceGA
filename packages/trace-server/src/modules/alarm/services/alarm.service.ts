import { Injectable, NotFoundException } from '@nestjs/common';
import { AlarmRepository } from '../repositories/alarm.repository';
import { GetAlarmListDto } from '../dto/get-alarm-list.dto';
import { GetAlarmTrendDto } from '../dto/get-alarm-trend.dto';
import { UpdateAlarmStatusDto } from '../dto/update-alarm-status.dto';
import { CreateAlarmRuleDto } from '../dto/create-alarm-rule.dto';
import { UpdateAlarmRuleDto } from '../dto/update-alarm-rule.dto';

@Injectable()
export class AlarmService {
  constructor(private readonly alarmRepository: AlarmRepository) {}

  /** 告警记录列表 */
  findAll(query: GetAlarmListDto) {
    return this.alarmRepository.findRecords(query);
  }

  /** 告警记录详情 */
  async findById(id: string) {
    const record = await this.alarmRepository.findRecordById(id);
    if (!record) {
      throw new NotFoundException('告警记录不存在');
    }
    return record;
  }

  /** 告警记录趋势 */
  findTrend(query: GetAlarmTrendDto) {
    return this.alarmRepository.findTrend(query.timeRange ?? '1d');
  }

  /** 更新告警记录状态 */
  async updateStatus(id: string, body: UpdateAlarmStatusDto) {
    const record = await this.alarmRepository.updateRecordStatus(id, body.status, body.remark);
    if (!record) {
      throw new NotFoundException('告警记录不存在');
    }
    return record;
  }

  /** 告警规则列表 */
  findRules(query: GetAlarmListDto) {
    return this.alarmRepository.findAll(query);
  }

  /** 告警规则详情 */
  async findRuleById(id: string) {
    const rule = await this.alarmRepository.findById(id);
    if (!rule) {
      throw new NotFoundException('告警规则不存在');
    }
    return rule;
  }

  /** 创建告警规则 */
  createRule(body: CreateAlarmRuleDto) {
    return this.alarmRepository.createRule({
      projectId: body.appId,
      eventName: body.eventName,
      threshold: body.threshold,
      operator: body.operator,
      notifyType: body.notifyType,
      webhookUrl: body.webhookUrl,
      status: body.status,
    });
  }

  /** 更新告警规则 */
  async updateRule(id: string, body: UpdateAlarmRuleDto) {
    const rule = await this.alarmRepository.updateRule(id, {
      projectId: body.appId,
      eventName: body.eventName,
      threshold: body.threshold,
      operator: body.operator,
      notifyType: body.notifyType,
      webhookUrl: body.webhookUrl,
      status: body.status,
    });
    if (!rule) {
      throw new NotFoundException('告警规则不存在');
    }
    return rule;
  }

  /** 删除告警规则（软删除：status=0） */
  async removeRule(id: string) {
    const removed = await this.alarmRepository.removeRule(id);
    if (!removed) {
      throw new NotFoundException('告警规则不存在');
    }
    return { id };
  }
}
