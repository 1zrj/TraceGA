import { Injectable, Logger } from '@nestjs/common'
import { AiAnalyzeDto } from '../dto/ai-analyze.dto'
import { AnalysisService } from '../../analysis/services/analysis.service'
import { GlmClientService } from './glm-client.service'
import { PromptService } from './prompt.service'
import { parseAIJson, withGlmFallback, SSEMessage } from './ai.utils'

@Injectable()
export class AiAnalyzeService {
  private readonly logger = new Logger(AiAnalyzeService.name)

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly glmClient: GlmClientService,
    private readonly promptService: PromptService,
  ) {}

  // ===== 非流式 =====

  async analyze(query: AiAnalyzeDto) {
    const [summary, trend] = await Promise.all([
      this.analysisService.getSummary({ appId: query.appId, startTime: query.startTime, endTime: query.endTime }),
      this.analysisService.getTrend({ appId: query.appId, startTime: query.startTime, endTime: query.endTime, interval: 'day' }),
    ])

    if (!query.question) {
      return { insight: '请提供一个具体问题以获得 AI 分析。', suggestions: [], metrics: summary, trend }
    }

    const { systemPrompt, userPrompt } = this.buildPrompts(query.question, summary, trend)

    return await withGlmFallback(
      this.glmClient,
      systemPrompt,
      userPrompt,
      { temperature: 0.3, maxTokens: 1024 },
      content => {
        const parsed = parseAIJson<{ insight?: string; suggestions?: string[] }>(content, { insight: content, suggestions: [] })
        return { insight: parsed.insight || '', suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [], metrics: summary, trend }
      },
      { insight: 'AI 分析暂时不可用，以下是原始数据供参考。', suggestions: ['请检查 GLM_API_KEY 配置是否正确'], metrics: summary, trend },
      this.logger,
      'AI 分析',
    )
  }

  // ===== 流式 =====

  async *analyzeStream(query: AiAnalyzeDto): AsyncGenerator<SSEMessage> {
    const [summary, trend] = await Promise.all([
      this.analysisService.getSummary({ appId: query.appId, startTime: query.startTime, endTime: query.endTime }),
      this.analysisService.getTrend({ appId: query.appId, startTime: query.startTime, endTime: query.endTime, interval: 'day' }),
    ])

    yield { type: 'stats', stats: { metrics: summary, trend } }

    if (!query.question) {
      yield { type: 'text', content: '请提供一个具体问题以获得 AI 分析。' }
      yield { type: 'done' }
      return
    }

    const { systemPrompt, userPrompt } = this.buildPrompts(query.question, summary, trend)

    try {
      for await (const chunk of this.glmClient.chatStream(systemPrompt, userPrompt, { temperature: 0.3, maxTokens: 1024 })) {
        yield { type: 'text', content: chunk }
      }
    } catch (err) {
      this.logger.error('AI 分析流式生成失败', err)
      yield { type: 'error', message: 'AI 分析暂时不可用，请稍后重试' }
    }

    yield { type: 'done' }
  }

  // ===== 公共 =====

  private buildPrompts(question: string, summary: any, trend: any[]) {
    const dataSummary = `当前数据概览：\n- PV：${summary.pv}\n- UV：${summary.uv}\n- 事件种类数：${summary.eventCount}\n- 近期趋势（最近 ${trend.length} 个周期）：${JSON.stringify(trend.slice(-7))}`

    return {
      systemPrompt: this.promptService.system('analyze'),
      userPrompt: this.promptService.user('analyze', { dataSummary, question }),
    }
  }
}
