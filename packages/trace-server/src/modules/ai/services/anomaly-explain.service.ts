import { Injectable, Logger } from '@nestjs/common'
import { AnomalyExplainDto } from '../dto/anomaly-explain.dto'
import { GlmClientService } from './glm-client.service'
import { PromptService } from './prompt.service'
import { calcChange, parseAIJson, withGlmFallback, SSEMessage } from './ai.utils'

@Injectable()
export class AnomalyExplainService {
  private readonly logger = new Logger(AnomalyExplainService.name)

  constructor(
    private readonly glmClient: GlmClientService,
    private readonly promptService: PromptService,
  ) {}

  // ===== 非流式 =====

  async explainAnomaly(dto: AnomalyExplainDto) {
    const base = this.buildBaseResult(dto)
    const { systemPrompt, userPrompt } = this.buildPrompts(dto)

    return await withGlmFallback(
      this.glmClient,
      systemPrompt,
      userPrompt,
      { temperature: 0.3, maxTokens: 1024 },
      content => {
        const parsed = parseAIJson<{ possibleReasons?: string[]; suggestions?: string[] }>(content, { possibleReasons: [content], suggestions: [] })
        return {
          ...base,
          possibleReasons: Array.isArray(parsed.possibleReasons) ? parsed.possibleReasons : [],
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        }
      },
      { ...base, possibleReasons: [], suggestions: ['AI 分析服务暂时不可用，请稍后重试或手动排查'] },
      this.logger,
      '异常解释生成',
    )
  }

  // ===== 流式 =====

  async *explainAnomalyStream(dto: AnomalyExplainDto): AsyncGenerator<SSEMessage> {
    const base = this.buildBaseResult(dto)
    const { systemPrompt, userPrompt } = this.buildPrompts(dto)

    yield { type: 'stats', stats: base }

    try {
      for await (const chunk of this.glmClient.chatStream(systemPrompt, userPrompt, { temperature: 0.3, maxTokens: 1024 })) {
        yield { type: 'text', content: chunk }
      }
    } catch (err) {
      this.logger.error('异常解释流式生成失败', err)
      yield { type: 'error', message: 'AI 分析服务暂时不可用，请稍后重试' }
    }

    yield { type: 'done' }
  }

  // ===== 公共 =====

  private buildBaseResult(dto: AnomalyExplainDto) {
    return {
      eventName: dto.eventName,
      currentValue: dto.currentValue ?? 0,
      previousValue: dto.previousValue ?? 0,
      changePercent: calcChange(dto.currentValue ?? 0, dto.previousValue ?? 0),
      compareLabel: dto.compareLabel || '前一日',
      rawContext: dto.context || {},
      generatedAt: new Date().toISOString(),
    }
  }

  private buildPrompts(dto: AnomalyExplainDto) {
    const contextLines = this.buildContextLines(dto.context)
    const systemPrompt = this.promptService.system('anomaly-explain')
    const userPrompt = this.promptService.user('anomaly-explain', {
      eventName: dto.eventName,
      currentValue: String(dto.currentValue ?? 0),
      previousValue: String(dto.previousValue ?? 0),
      compareLabel: dto.compareLabel || '前一日',
      changePercent: String(calcChange(dto.currentValue ?? 0, dto.previousValue ?? 0)),
      contextLines,
    })
    return { systemPrompt, userPrompt }
  }

  private buildContextLines(ctx?: AnomalyExplainDto['context']): string {
    if (!ctx) return '无'
    const lines: string[] = []
    if (ctx.pageUrl) lines.push(`所在页面：${ctx.pageUrl}`)
    if (ctx.pageChange !== undefined) lines.push(`页面访问量变化：${ctx.pageChange}%`)
    if (ctx.releaseNotes) lines.push(`最近发布记录：${ctx.releaseNotes}`)
    if (ctx.additionalInfo) lines.push(`补充信息：${ctx.additionalInfo}`)
    return lines.length > 0 ? lines.join('\n') : '无'
  }
}
