import { Injectable, Logger } from '@nestjs/common'
import { AiAnalyzeDto } from '../dto/ai-analyze.dto'
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
    // 1. 从 ClickHouse 查询真实数据
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

    // 2. 如果有自然语言问题，调用 GLM 分析
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

    // 如果没有问题，直接返回数据
    return {
      insight: '请提供一个具体问题以获得 AI 分析。',
      suggestions: [],
      metrics: summary,
      trend,
    }
  }

  /**
   * 调用 GLM 进行数据分析
   *
   * 步骤：
   * 1. 组装数据摘要文本
   * 2. 从 Prompt 文件加载 system/user 提示词并填充变量
   * 3. 调用 GlmClientService 发起请求
   * 4. 解析 GLM 返回的 JSON
   */
  private async callAI(
    question: string,
    summary: { pv: number; uv: number; eventCount: number },
    trend: any[],
  ) {
    // 组装数据摘要
    const dataSummary = `
当前数据概览：
- PV（页面访问量）：${summary.pv}
- UV（独立访客）：${summary.uv}
- 事件种类数：${summary.eventCount}
- 近期趋势（最近 ${trend.length} 个周期）：${JSON.stringify(trend.slice(-7))}
    `.trim()

    // 从 Prompt 文件加载并填充变量
    const systemPrompt = this.promptService.system('analyze')
    const userPrompt = this.promptService.user('analyze', {
      dataSummary,
      question,
    })

    // 调用 GLM
    const result = await this.glmClient.chat(systemPrompt, userPrompt, {
      temperature: 0.3,
      maxTokens: 1024,
    })

    // 解析 GLM 返回的 JSON
    return this.parseAIResponse(result.content)
  }

  /**
   * 解析 AI 返回的 JSON 文本
   *
   * 做两层容错：
   * 1. 先尝试直接 JSON.parse
   * 2. 失败则尝试用正则从文本中提取 {...} 再 parse
   * 3. 再失败就把原文当 insight 返回（兜底）
   */
  private parseAIResponse(content: string): { insight: string; suggestions: string[] } {
    // 第一层：直接解析
    try {
      const parsed = JSON.parse(content)
      return {
        insight: parsed.insight || '',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      }
    } catch {
      // 第二层：AI 可能在 JSON 外面包了 markdown 代码块，尝试提取
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          return {
            insight: parsed.insight || '',
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
          }
        } catch {
          // 提取出来的也不是合法 JSON，走兜底
        }
      }

      // 第三层：完全兜底，把 AI 返回的原文当 insight 展示
      return {
        insight: content,
        suggestions: [],
      }
    }
  }
  /**
   * 生成 AI 数据日报
   *
   * @param appId  应用 ID
   * @param date   报表日期，格式 YYYY-MM-DD，默认昨天
   */
  async generateDailyReport(appId: string, date?: string) {
    // 1. 确定日期：默认昨天
    const targetDate = date || this.getYesterday()
    const yesterdayDate = this.getDayBefore(targetDate)

    // 2. 并行查询：今日汇总 + 昨日汇总 + 今日事件排行 + 昨日事件排行 + 错误事件
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

    // 3. 计算环比变化
    const pvChange = this.calcChange(todaySummary.pv, yesterdaySummary.pv)
    const uvChange = this.calcChange(todaySummary.uv, yesterdaySummary.uv)

    // 4. 计算每个事件的环比变化
    const eventTrends = this.buildEventTrends(todayEvents, yesterdayEvents)

    // 5. 组装结构化 JSON
    const stats = {
      date: targetDate,
      totalPv: todaySummary.pv,
      totalUv: todaySummary.uv,
      pvChange,       // 如 -3.2
      uvChange,       // 如 1.5
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

    // 6. 从 Prompt 文件加载模板
    const systemPrompt = this.promptService.system('daily-report')
    const userPrompt = this.promptService.user('daily-report', {
      statsJson: JSON.stringify(stats, null, 2),
    })

    // 7. 调用 GLM
    try {
      const result = await this.glmClient.chat(systemPrompt, userPrompt, {
        temperature: 0.5,   // 日报可以稍微有点创造性
        maxTokens: 800,     // 200 字中文 ≈ 400-600 tokens
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

  // ===== 辅助方法 =====

  /** 获取昨天的日期字符串 YYYY-MM-DD */
  private getYesterday(): string {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }

  /** 获取指定日期前一天的日期字符串 */
  private getDayBefore(date: string): string {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }

  /** 计算环比变化百分比，保留 1 位小数 */
  private calcChange(today: number, yesterday: number): number {
    if (yesterday === 0) return today > 0 ? 100 : 0
    return Math.round(((today - yesterday) / yesterday) * 1000) / 10
  }

  /** 构建每个事件的环比变化列表 */
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