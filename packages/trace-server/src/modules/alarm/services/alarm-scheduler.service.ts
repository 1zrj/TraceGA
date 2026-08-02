import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AlarmRepository } from '../repositories/alarm.repository';
import { AlarmNotifyService } from './alarm-notify.service';

/** 扫描间隔：每 60 秒检测一次 */
const SCAN_INTERVAL_MS = 60 * 1000;

/** 统计窗口：统计最近 10 分钟内的事件量 */
const WINDOW_MS = 10 * 60 * 1000;

interface RuleSnapshot {
  id: string;
  projectId: string;
  eventName: string;
  threshold: number;
  operator: string;
  notifyType: string;
  webhookUrl: string;
}

@Injectable()
export class AlarmSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AlarmScheduler');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly alarmRepository: AlarmRepository,
    private readonly alarmNotifyService: AlarmNotifyService,
  ) {}

  onModuleInit(): void {
    // 启动后先执行一次，之后每 60 秒扫描
    void this.runCheck();
    this.timer = setInterval(() => void this.runCheck(), SCAN_INTERVAL_MS);
    this.logger.log(`告警检测定时任务已启动（间隔 ${SCAN_INTERVAL_MS / 1000}s，窗口 ${WINDOW_MS / 60000}min）`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 单次检测：遍历启用中的告警规则，统计窗口期事件量并判断是否触发 */
  private async runCheck(): Promise<void> {
    try {
      const rules = await this.alarmRepository.findActiveRules();
      if (rules.length === 0) {
        return;
      }

      const since = new Date(Date.now() - WINDOW_MS);
      for (const rule of rules) {
        await this.evaluateRule(rule, since);
      }
    } catch (error) {
      this.logger.error('告警检测执行失败', (error as Error).stack);
    }
  }

  /** 评估单条规则：统计事件量 → 阈值比较 → 防重复 → 写入告警记录 */
  private async evaluateRule(rule: RuleSnapshot, since: Date): Promise<void> {
    const count = await this.alarmRepository.countEvents(rule.projectId, rule.eventName, since);
    if (!this.isTriggered(count, rule.threshold, rule.operator)) {
      return;
    }

    // 防重复：同一项目 + 事件已有 pending/processing 记录时不再触发
    const open = await this.alarmRepository.findOpenRecord(rule.projectId, rule.eventName);
    if (open) {
      return;
    }

    const level = this.resolveLevel(count, rule.threshold, rule.operator);
    const ruleText = `${rule.eventName} ${rule.operator} ${rule.threshold}`;
    const message = this.buildMessage(rule, count, since);

    await this.alarmRepository
      .createRecord({
        projectId: rule.projectId,
        eventName: rule.eventName,
        name: `${rule.eventName} 事件量异常`,
        type: rule.operator === 'gt' ? '事件量超阈值' : '事件量低于阈值',
        level,
        rule: ruleText,
        message,
        recordData: {
          eventName: rule.eventName,
          currentValue: count,
          threshold: rule.threshold,
          operator: rule.operator,
          windowMin: WINDOW_MS / 60000,
        },
      })
      .then(record => {
        this.logger.warn(`告警触发 [${rule.projectId}/${rule.eventName}] 当前 ${count}，阈值 ${rule.threshold}（${rule.operator}），级别 ${level}`);

        // webhook 通知：fire-and-forget，失败由 AlarmNotifyService 记录日志，不影响主流程
        if (rule.notifyType === 'webhook' && rule.webhookUrl) {
          void this.alarmNotifyService.sendWebhook(rule.webhookUrl, {
            alarmId: record.id,
            appId: rule.projectId,
            eventName: rule.eventName,
            level,
            message,
            triggeredAt: new Date().toISOString(),
          });
        }
      });
  }

  /** 阈值比较：gt = 大于触发，lt = 小于触发 */
  private isTriggered(count: number, threshold: number, operator: string): boolean {
    return operator === 'lt' ? count < threshold : count > threshold;
  }

  /** 级别判定：超出阈值越多级别越高 */
  private resolveLevel(count: number, threshold: number, operator: string): string {
    if (operator === 'lt') {
      return threshold > 0 && count <= threshold / 2 ? 'high' : 'medium';
    }
    if (threshold <= 0) {
      return count > 0 ? 'medium' : 'low';
    }
    const ratio = count / threshold;
    if (ratio >= 3) return 'critical';
    if (ratio >= 2) return 'high';
    return 'medium';
  }

  /** 生成告警描述消息 */
  private buildMessage(rule: RuleSnapshot, count: number, since: Date): string {
    const direction = rule.operator === 'lt' ? '低于' : '超过';
    return `最近 ${WINDOW_MS / 60000} 分钟内 ${rule.eventName} 事件量 ${count}，${direction}阈值 ${rule.threshold}，触发告警（规则 #${rule.id}）`;
  }
}
