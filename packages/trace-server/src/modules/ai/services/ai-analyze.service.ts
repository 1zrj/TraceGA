/**
 * AiAnalyzeService
 *
 * 职责：AI 通用问答分析。
 * 前端传入时间和事件范围 + 一个具体问题，本服务查 ClickHouse 获取
 * 数据概览和趋势，连同用户问题一起发给 GLM，返回 insight + suggestions。
 *
 * 不涉及日报生成或异常事件解释 —— 那是另外两个 Service 的职责。
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiAnalyzeDto } from '../dto/ai-analyze.dto';
import { AnalysisService } from '../../analysis/services/analysis.service';
import { GlmClientService } from './glm-client.service';
import { PromptService } from './prompt.service';

@Injectable()
export class AiAnalyzeService {
  private readonly logger = new Logger(AiAnalyzeService.name);

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly glmClient: GlmClientService,
    private readonly promptService: PromptService,
  ) {}

  async analyze(query: AiAnalyzeDto) {
    const [summary, trend] = await Promise.all([
      this.analysisService.getSummary({
        appId: query.appId,
        startTime: query.startTime,
        endTime: query.endTime,
      }),
      this.analysisService.getTrend({
        appId: query.appId,
        startTime: query.startTime,
        endTime: query.endTime,
        interval: 'day',
      }),
    ]);

    if (query.question) {
      try {
        const aiReply = await this.callAI(query.question, summary, trend);
        return {
          insight: aiReply.insight,
          suggestions: aiReply.suggestions,
          metrics: summary,
          trend,
        };
      } catch (err) {
        this.logger.error('GLM API 调用失败', err);
        return {
          insight: 'AI 分析暂时不可用，以下是原始数据供参考。',
          suggestions: ['请检查 GLM_API_KEY 配置是否正确'],
          metrics: summary,
          trend,
        };
      }
    }

    return {
      insight: '请提供一个具体问题以获得 AI 分析。',
      suggestions: [],
      metrics: summary,
      trend,
    };
  }

  private async callAI(question: string, summary: { pv: number; uv: number; eventCount: number }, trend: any[]) {
    const dataSummary = `
当前数据概览：
- PV（页面访问量）：${summary.pv}
- UV（独立访客）：${summary.uv}
- 事件种类数：${summary.eventCount}
- 近期趋势（最近 ${trend.length} 个周期）：${JSON.stringify(trend.slice(-7))}
    `.trim();

    const systemPrompt = this.promptService.system('analyze');
    const userPrompt = this.promptService.user('analyze', {
      dataSummary,
      question,
    });

    const result = await this.glmClient.chat(systemPrompt, userPrompt, {
      temperature: 0.3,
      maxTokens: 1024,
    });

    return this.parseAIResponse(result.content);
  }

  private parseAIResponse(content: string): { insight: string; suggestions: string[] } {
    try {
      const parsed = JSON.parse(content);
      return {
        insight: parsed.insight || '',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            insight: parsed.insight || '',
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
          };
        } catch {
          // Fall back to returning the raw model response below.
        }
      }
      return {
        insight: content,
        suggestions: [],
      };
    }
  }
}
