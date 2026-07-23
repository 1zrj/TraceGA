import { Injectable, Logger } from '@nestjs/common'
import { AnalysisService } from '../../analysis/services/analysis.service'
import { GlmClientService } from './glm-client.service'
import { PromptService } from './prompt.service'
import { calcChange, SSEMessage } from './ai.utils'

const CACHE_TTL_MS = 3_600_000
const TEMPERATURE = 0.5
const MAX_TOKENS = 1024

@Injectable()
export class DailyReportService {
  private readonly logger = new Logger(DailyReportService.name)
  private readonly reportCache = new Map<string, { data: any; cachedAt: number }>()

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly glmClient: GlmClientService,
    private readonly promptService: PromptService,
  ) {}

  // ===== 非流式 =====

  async generateDailyReport(appId: string, date?: string) {
    const targetDate = date || this.getYesterday()

    const cacheKey = `${appId}:${targetDate}`
    const cached = this.reportCache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      this.logger.log(`日报缓存命中: ${cacheKey}`)
      return cached.data
    }

    const { stats, systemPrompt, userPrompt } = await this.prepareData(appId, targetDate)

    try {
      const result = await this.glmClient.chat(systemPrompt, userPrompt, {
        temperature: TEMPERATURE,
        maxTokens: MAX_TOKENS,
      })

      const data = { stats, report: result.content, generatedAt: new Date().toISOString() }
      this.reportCache.set(cacheKey, { data, cachedAt: Date.now() })
      return data
    } catch (err) {
      this.logger.error('日报生成失败', err)
      return { stats, report: 'AI 日报生成失败，请稍后重试。以下是今日原始数据。', generatedAt: new Date().toISOString() }
    }
  }

  // ===== 流式 =====

  async *generateDailyReportStream(appId: string, date?: string): AsyncGenerator<SSEMessage> {
    const targetDate = date || this.getYesterday()
    const { stats, systemPrompt, userPrompt } = await this.prepareData(appId, targetDate)

    yield { type: 'stats', stats }

    try {
      for await (const chunk of this.glmClient.chatStream(systemPrompt, userPrompt, {
        temperature: TEMPERATURE,
        maxTokens: MAX_TOKENS,
      })) {
        yield { type: 'text', content: chunk }
      }
    } catch (err) {
      this.logger.error('日报流式生成失败', err)
      yield { type: 'error', message: 'AI 日报生成失败，请稍后重试' }
    }

    yield { type: 'done' }
  }

  // ===== 数据准备（公共） =====

  private async prepareData(appId: string, targetDate: string) {
    const yesterdayDate = this.getDayBefore(targetDate)
    const startOfDay = `${targetDate}T00:00:00`
    const endOfDay = `${targetDate}T23:59:59`
    const startOfYesterday = `${yesterdayDate}T00:00:00`
    const endOfYesterday = `${yesterdayDate}T23:59:59`

    const [todaySummary, yesterdaySummary, todayEvents, yesterdayEvents, errorEvents] = await Promise.all([
      this.analysisService.getSummary({ appId, startTime: startOfDay, endTime: endOfDay }),
      this.analysisService.getSummary({ appId, startTime: startOfYesterday, endTime: endOfYesterday }),
      this.analysisService.getFiltered({ appId, startTime: startOfDay, endTime: endOfDay }),
      this.analysisService.getFiltered({ appId, startTime: startOfYesterday, endTime: endOfYesterday }),
      this.analysisService.getFiltered({ appId, eventTypes: ['error'], startTime: startOfDay, endTime: endOfDay }),
    ])

    const stats = {
      date: targetDate,
      totalPv: todaySummary.pv,
      totalUv: todaySummary.uv,
      pvChange: calcChange(todaySummary.pv, yesterdaySummary.pv),
      uvChange: calcChange(todaySummary.uv, yesterdaySummary.uv),
      topEvents: todayEvents.slice(0, 5).map(e => ({ eventName: e.event_name, pv: e.count })),
      eventTrends: this.buildEventTrends(todayEvents, yesterdayEvents).filter(t => Math.abs(t.pvChange) >= 10),
      errorEvents: errorEvents.map(e => ({ eventName: e.event_name, count: e.count })),
    }

    const systemPrompt = this.promptService.system('daily-report')
    const userPrompt = this.promptService.user('daily-report', { statsJson: JSON.stringify(stats, null, 2) })

    return { stats, systemPrompt, userPrompt }
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

  private buildEventTrends(todayEvents: Array<{ event_name: string; count: number }>, yesterdayEvents: Array<{ event_name: string; count: number }>) {
    const yesterdayMap = new Map<string, number>()
    yesterdayEvents.forEach(e => yesterdayMap.set(e.event_name, e.count))
    return todayEvents.map(e => {
      const yesterdayPv = yesterdayMap.get(e.event_name) || 0
      return { eventName: e.event_name, todayPv: e.count, yesterdayPv, pvChange: calcChange(e.count, yesterdayPv) }
    })
  }
}
