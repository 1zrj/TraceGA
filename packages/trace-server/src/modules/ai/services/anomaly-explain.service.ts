/**
 * AnomalyExplainService
 *
 * 职责：AI 异常事件解释。
 * 前端传入事件名称、数值变化和可选上下文（页面、发布记录等），
 * 发给 GLM 分析可能原因并给出排查建议。
 *
 * 本服务不查 ClickHouse —— 数据由前端提供，保持接口轻量。
 *
 * 不涉及通用问答或日报生成 —— 那是另外两个 Service 的职责。
 */

import { Injectable, Logger } from '@nestjs/common'
import { AnomalyExplainDto } from '../dto/anomaly-explain.dto'
import { GlmClientService } from './glm-client.service'
import { PromptService } from './prompt.service'
import { calcChange, parseAIJson, withGlmFallback } from './ai.utils'

@Injectable()
export class AnomalyExplainService {
  private readonly logger = new Logger(AnomalyExplainService.name)

  constructor(
    private readonly glmClient: GlmClientService,
    private readonly promptService: PromptService,
  ) {}

  async explainAnomaly(dto: AnomalyExplainDto) {
    const current = dto.currentValue ?? 0
    const previous = dto.previousValue ?? 0
    const changePercent = calcChange(current, previous)
    const compareLabel = dto.compareLabel || '前一日'

    const contextLines = this.buildAnomalyContextLines(dto.context)

    const systemPrompt = this.promptService.system('anomaly-explain')
    const userPrompt = this.promptService.user('anomaly-explain', {
      eventName: dto.eventName,
      currentValue: String(current),
      previousValue: String(previous),
      compareLabel,
      changePercent: String(changePercent),
      contextLines,
    })

    const baseResult = {
      eventName: dto.eventName,
      currentValue: current,
      previousValue: previous,
      changePercent,
      compareLabel,
      rawContext: dto.context || {},
      generatedAt: new Date().toISOString(),
    }

    const result = await withGlmFallback(
      this.glmClient,
      systemPrompt,
      userPrompt,
      { temperature: 0.3, maxTokens: 1024 },
      content => {
        const parsed = parseAIJson<{ possibleReasons?: string[]; suggestions?: string[] }>(content, { possibleReasons: [content], suggestions: [] })
        return {
          ...baseResult,
          possibleReasons: Array.isArray(parsed.possibleReasons) ? parsed.possibleReasons : [],
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        }
      },
      {
        ...baseResult,
        possibleReasons: [],
        suggestions: ['AI 分析服务暂时不可用，请稍后重试或手动排查'],
      },
      this.logger,
      '异常解释生成',
    )

    return result
  }

  /**
   * 将可选的 context 字段拼成 Prompt 文本
   * 有值拼一行，没值跳过；全没有返回"无"
   */
  private buildAnomalyContextLines(ctx?: AnomalyExplainDto['context']): string {
    if (!ctx) return '无'

    const lines: string[] = []
    if (ctx.pageUrl) {
      lines.push(`所在页面：${ctx.pageUrl}`)
    }
    if (ctx.pageChange !== undefined) {
      lines.push(`页面访问量变化：${ctx.pageChange}%`)
    }
    if (ctx.releaseNotes) {
      lines.push(`最近发布记录：${ctx.releaseNotes}`)
    }
    if (ctx.additionalInfo) {
      lines.push(`补充信息：${ctx.additionalInfo}`)
    }

    return lines.length > 0 ? lines.join('\n') : '无'
  }
}
