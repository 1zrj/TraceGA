import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { AiAnalyzeService } from '../services/ai-analyze.service'
import { DailyReportService } from '../services/daily-report.service'
import { AnomalyExplainService } from '../services/anomaly-explain.service'
import { AiAnalyzeDto } from '../dto/ai-analyze.dto'
import { DailyReportDto } from '../dto/daily-report.dto'
import { AnomalyExplainDto } from '../dto/anomaly-explain.dto'

@Controller('api/ai')
export class AiController {
  constructor(
    private readonly aiAnalyzeService: AiAnalyzeService,
    private readonly dailyReportService: DailyReportService,
    private readonly anomalyExplainService: AnomalyExplainService,
  ) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  analyze(@Body() query: AiAnalyzeDto) {
    return this.aiAnalyzeService.analyze(query)
  }

  @Post('daily-report')
  @HttpCode(HttpStatus.OK)
  async dailyReport(@Body() dto: DailyReportDto) {
    return this.dailyReportService.generateDailyReport(dto.appId, dto.date)
  }

  @Post('anomaly-explain')
  @HttpCode(HttpStatus.OK)
  async anomalyExplain(@Body() dto: AnomalyExplainDto) {
    return this.anomalyExplainService.explainAnomaly(dto)
  }
}
