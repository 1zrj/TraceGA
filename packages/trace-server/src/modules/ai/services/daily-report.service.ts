/**
 * DailyReportService
 *
 * 职责：生成每日数据日报。
 * 对比目标日期与前一日的数据（PV/UV/事件排行/趋势/错误事件），
 * 将统计数据拼成 JSON 发给 GLM，返回自然语言日报。
 *
 * 不涉及通用问答或异常解释 —— 那是另外两个 Service 的职责。
 */

import { Injectable, Logger } from '@nestjs/common';
import { AnalysisService } from '../../analysis/services/analysis.service';
import { GlmClientService } from './glm-client.service';
import { PromptService } from './prompt.service';
import { calcChange } from './ai.utils';

@Injectable()
export class DailyReportService {
  private readonly logger = new Logger(DailyReportService.name);

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly glmClient: GlmClientService,
    private readonly promptService: PromptService,
  ) {}

  async generateDailyReport(appId: string, date?: string) {
    const targetDate = date || this.getYesterday();
    const yesterdayDate = this.getDayBefore(targetDate);

    const startOfDay = `${targetDate}T00:00:00`;
    const endOfDay = `${targetDate}T23:59:59`;
    const startOfYesterday = `${yesterdayDate}T00:00:00`;
    const endOfYesterday = `${yesterdayDate}T23:59:59`;

    const [todaySummary, yesterdaySummary, todayEvents, yesterdayEvents, errorEvents] = await Promise.all([
      this.analysisService.getSummary({ appId, startTime: startOfDay, endTime: endOfDay }),
      this.analysisService.getSummary({ appId, startTime: startOfYesterday, endTime: endOfYesterday }),
      this.analysisService.getFiltered({ appId, startTime: startOfDay, endTime: endOfDay }),
      this.analysisService.getFiltered({ appId, startTime: startOfYesterday, endTime: endOfYesterday }),
      this.analysisService.getFiltered({ appId, eventTypes: ['error'], startTime: startOfDay, endTime: endOfDay }),
    ]);

    const pvChange = calcChange(todaySummary.pv, yesterdaySummary.pv);
    const uvChange = calcChange(todaySummary.uv, yesterdaySummary.uv);
    const eventTrends = this.buildEventTrends(todayEvents, yesterdayEvents);

    const stats = {
      date: targetDate,
      totalPv: todaySummary.pv,
      totalUv: todaySummary.uv,
      pvChange,
      uvChange,
      topEvents: todayEvents.slice(0, 5).map(e => ({
        eventName: e.event_name,
        pv: e.count,
      })),
      eventTrends: eventTrends.filter(t => Math.abs(t.pvChange) >= 10),
      errorEvents: errorEvents.map(e => ({
        eventName: e.event_name,
        count: e.count,
      })),
    };

    const systemPrompt = this.promptService.system('daily-report');
    const userPrompt = this.promptService.user('daily-report', {
      statsJson: JSON.stringify(stats, null, 2),
    });

    try {
      const result = await this.glmClient.chat(systemPrompt, userPrompt, {
        temperature: 0.5,
        maxTokens: 1024,
      });

      return {
        stats,
        report: result.content,
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      this.logger.error('日报生成失败', err);
      return {
        stats,
        report: 'AI 日报生成失败，请稍后重试。以下是今日原始数据。',
        generatedAt: new Date().toISOString(),
      };
    }
  }

  // ===== 辅助方法 =====

  private getYesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  private getDayBefore(date: string): string {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  private buildEventTrends(
    todayEvents: Array<{ event_name: string; count: number }>,
    yesterdayEvents: Array<{ event_name: string; count: number }>,
  ): Array<{ eventName: string; todayPv: number; yesterdayPv: number; pvChange: number }> {
    const yesterdayMap = new Map<string, number>();
    yesterdayEvents.forEach(e => yesterdayMap.set(e.event_name, e.count));

    return todayEvents.map(e => {
      const yesterdayPv = yesterdayMap.get(e.event_name) || 0;
      return {
        eventName: e.event_name,
        todayPv: e.count,
        yesterdayPv,
        pvChange: calcChange(e.count, yesterdayPv),
      };
    });
  }
}
