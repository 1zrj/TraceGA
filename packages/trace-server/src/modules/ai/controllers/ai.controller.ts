import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { AiAnalyzeService } from '../services/ai-analyze.service'
import { DailyReportService } from '../services/daily-report.service'
import { AnomalyExplainService } from '../services/anomaly-explain.service'
import { NlQueryService } from '../services/nl-query.service'
import { RecommendService } from '../services/recommend.service'
import { AiAnalyzeDto } from '../dto/ai-analyze.dto'
import { DailyReportDto } from '../dto/daily-report.dto'
import { AnomalyExplainDto } from '../dto/anomaly-explain.dto'
import { NlQueryDto } from '../dto/nl-query.dto'
import { RecommendDto } from '../dto/recommend.dto'

@Controller('api/ai')
export class AiController {
  constructor(
    private readonly aiAnalyzeService: AiAnalyzeService,
    private readonly dailyReportService: DailyReportService,
    private readonly anomalyExplainService: AnomalyExplainService,
    private readonly nlQueryService: NlQueryService,
    private readonly recommendService: RecommendService,
  ) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  analyze(@Body() query: AiAnalyzeDto) {
    return this.aiAnalyzeService.analyze(query);
  }

  @Post('daily-report')
  @HttpCode(HttpStatus.OK)
  async dailyReport(@Body() dto: DailyReportDto) {
    return this.dailyReportService.generateDailyReport(dto.appId, dto.date);
  }

  @Post('anomaly-explain')
  @HttpCode(HttpStatus.OK)
  async anomalyExplain(@Body() dto: AnomalyExplainDto) {
    return this.anomalyExplainService.explainAnomaly(dto);
  }

  @Post('nl-query')
  @HttpCode(HttpStatus.OK)
  async nlQuery(@Body() dto: NlQueryDto) {
    return this.nlQueryService.processQuery(dto)
  }

  @Post('recommend')
  @HttpCode(HttpStatus.OK)
  async recommend(@Body() dto: RecommendDto) {
    return this.recommendService.recommend(dto)
  }
}
