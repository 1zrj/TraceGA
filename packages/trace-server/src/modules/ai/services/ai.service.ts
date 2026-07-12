import { Injectable, Logger } from '@nestjs/common'
import { AiAnalyzeDto } from '../dto/ai-analyze.dto'
import { AnomalyExplainDto } from '../dto/anomaly-explain.dto'
import { AnalysisService } from '../../analysis/services/analysis.service'
import { GlmClientService } from './glm-client.service'
import { PromptService } from './prompt.service'

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)

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
    ])

    if (query.question) {
      try {
        const aiReply = await this.callAI(query.question, summary, trend)
        return {
          insight: aiReply.insight,
          suggestions: aiReply.suggestions,
          metrics: summary,
          trend,
        }
      } catch (err) {
        this.logger.error('GLM API 调用失败', err)
        return {
          insight: 'AI 分析暂时不可用，以下是原始数据供参考。',
          suggestions: ['请检查 GLM_API_KEY 配置是否正确'],
          metrics: summary,
          trend,
        }
      }
    }

    return {
      insight: '请提供一个具体问题以获得 AI 分析。',
      suggestions: [],
      metrics: summary,
      trend,
    }
  }

  private async callAI(
    question: string,
    summary: { pv: number; uv: number; eventCount: number },
    trend: any[],
  ) {
    const dataSummary = `
当前数据概览：
- PV（页面访问量）：${summary.pv}
- UV（独立访客）：${summary.uv}
- 事件种类数：${summary.eventCount}
- 近期趋势（最近 ${trend.length} 个周期）：${JSON.stringify(trend.slice(-7))}
    `.trim()

    const systemPrompt = this.promptService.system('analyze')
    const userPrompt = this.promptService.user('analyze', {
      dataSummary,
      question,
    })

    const result = await this.glmClient.chat(systemPrompt, userPrompt, {
      temperature: 0.3,
      maxTokens: 1024,
    })

    return this.parseAIResponse(result.content)
  }

  private parseAIResponse(content: string): { insight: string; suggestions: string[] } {
    try {
      const parsed = JSON.parse(content)
      return {
        insight: parsed.insight || '',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      }
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          return {
            insight: parsed.insight || '',
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
          }
        } catch {}
      }
      return {
        insight: content,
        suggestions: [],
      }
    }
  }

  async generateDailyReport(appId: string, date?: string) {
    const targetDate = date || this.getYesterday()
    const yesterdayDate = this.getDayBefore(targetDate)

    const startOfDay = `${targetDate}T00:00:00`
    const endOfDay = `${targetDate}T23:59:59`
    const startOfYesterday = `${yesterdayDate}T00:00:00`
    const endOfYesterday = `${yesterdayDate}T23:59:59`

    const [
      todaySummary,
      yesterdaySummary,
      todayEvents,
      yesterdayEvents,
      errorEvents,
    ] = await Promise.all([
      this.analysisService.getSummary({ appId, startTime: startOfDay, endTime: endOfDay }),
      this.analysisService.getSummary({ appId, startTime: startOfYesterday, endTime: endOfYesterday }),
      this.analysisService.getFiltered({ appId, startTime: startOfDay, endTime: endOfDay }),
      this.analysisService.getFiltered({ appId, startTime: startOfYesterday, endTime: endOfYesterday }),
      this.analysisService.getFiltered({ appId, eventTypes: ['error'], startTime: startOfDay, endTime: endOfDay }),
    ])

    const pvChange = this.calcChange(todaySummary.pv, yesterdaySummary.pv)
    const uvChange = this.calcChange(todaySummary.uv, yesterdaySummary.uv)
    const eventTrends = this.buildEventTrends(todayEvents, yesterdayEvents)

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
    }

    const systemPrompt = this.promptService.system('daily-report')
    const userPrompt = this.promptService.user('daily-report', {
      statsJson: JSON.stringify(stats, null, 2),
    })

    try {
      const result = await this.glmClient.chat(systemPrompt, userPrompt, {
        temperature: 0.5,
        maxTokens: 1024,
      })

      return {
        stats,
        report: result.content,
        generatedAt: new Date().toISOString(),
      }
    } catch (err) {
      this.logger.error('日报生成失败', err)
      return {
        stats,
        report: 'AI 日报生成失败，请稍后重试。以下是今日原始数据。',
        generatedAt: new Date().toISOString(),
      }
    }
  }

  /**
   * AI 异常事件解释
   * 前端传入事件名称和数值，GLM 分析可能原因并给出排查建议。
   * 本方法不查 ClickHouse —— 数据由前端提供。
   */
  async explainAnomaly(dto: AnomalyExplainDto) {
    const current = dto.currentValue ?? 0
    const previous = dto.previousValue ?? 0
    const changePercent = this.calcChange(current, previous)
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

    try {
      const result = await this.glmClient.chat(systemPrompt, userPrompt, {
        temperature: 0.3,
        maxTokens: 1024,
      })

      const parsed = this.parseAnomalyResponse(result.content)

      return {
        eventName: dto.eventName,
        currentValue: current,
        previousValue: previous,
        changePercent,
        compareLabel,
        possibleReasons: parsed.possibleReasons,
        suggestions: parsed.suggestions,
        rawContext: dto.context || {},
        generatedAt: new Date().toISOString(),
      }
    } catch (err) {
      this.logger.error('异常解释生成失败', err)
      return {
        eventName: dto.eventName,
        currentValue: current,
        previousValue: previous,
        changePercent,
        compareLabel,
        possibleReasons: [],
        suggestions: ['AI 分析服务暂时不可用，请稍后重试或手动排查'],
        rawContext: dto.context || {},
        generatedAt: new Date().toISOString(),
      }
    }
  }

  /**
   * 将可选的 context 字段拼成 Prompt 文本
   * 有值拼一行，没值跳过；全没有返回"无"
   */
  private buildAnomalyContextLines(
    ctx?: AnomalyExplainDto['context'],
  ): string {
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

  /**
   * 解析异常解释 Prompt 返回的 JSON
   * 与 parseAIResponse 分开：两个 Prompt 输出字段不同
   * （possibleReasons + suggestions vs insight + suggestions）
   */
  private parseAnomalyResponse(content: string): {
    possibleReasons: string[]
    suggestions: string[]
  } {
    try {
      const parsed = JSON.parse(content)
      return {
        possibleReasons: Array.isArray(parsed.possibleReasons)
          ? parsed.possibleReasons
          : [],
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions
          : [],
      }
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          return {
            possibleReasons: Array.isArray(parsed.possibleReasons)
              ? parsed.possibleReasons
              : [],
            suggestions: Array.isArray(parsed.suggestions)
              ? parsed.suggestions
              : [],
          }
        } catch {}
      }
      return {
        possibleReasons: [content],
        suggestions: [],
      }
    }
  }

  // ===== 辅助方法 =====

  private getYesterday(): string {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }

  private getDayBefore(date: string): string {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }

  private calcChange(today: number, yesterday: number): number {
    if (yesterday === 0) return today > 0 ? 100 : 0
    return Math.round(((today - yesterday) / yesterday) * 1000) / 10
  }

  private buildEventTrends(
    todayEvents: Array<{ event_name: string; count: number }>,
    yesterdayEvents: Array<{ event_name: string; count: number }>,
  ): Array<{ eventName: string; todayPv: number; yesterdayPv: number; pvChange: number }> {
    const yesterdayMap = new Map<string, number>()
    yesterdayEvents.forEach(e => yesterdayMap.set(e.event_name, e.count))

    return todayEvents.map(e => {
      const yesterdayPv = yesterdayMap.get(e.event_name) || 0
      return {
        eventName: e.event_name,
        todayPv: e.count,
        yesterdayPv,
        pvChange: this.calcChange(e.count, yesterdayPv),
      }
    })
  }
}
