import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { AiService } from '../services/ai.service'
import { AiAnalyzeDto } from '../dto/ai-analyze.dto'
import { DailyReportDto } from '../dto/daily-report.dto'
import { AnomalyExplainDto } from '../dto/anomaly-explain.dto'

@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  analyze(@Body() query: AiAnalyzeDto) {
    return this.aiService.analyze(query)
  }

  @Post('daily-report')
  @HttpCode(HttpStatus.OK)
  async dailyReport(@Body() dto: DailyReportDto) {
    return this.aiService.generateDailyReport(dto.appId, dto.date)
  }

  @Post('anomaly-explain')
  @HttpCode(HttpStatus.OK)
  async anomalyExplain(@Body() dto: AnomalyExplainDto) {
    return this.aiService.explainAnomaly(dto)
  }
}
