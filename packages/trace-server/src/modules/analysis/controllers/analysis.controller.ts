import { Controller, Get, Post, Query, Body } from '@nestjs/common'
import { AnalysisService } from '../services/analysis.service'
import { AnalysisSummaryDto, AnalysisTrendDto, AnalysisFilterDto } from '../dto/analysis.dto'

@Controller('api/analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get('summary')
  getSummary(@Query() query: AnalysisSummaryDto) {
    return this.analysisService.getSummary(query)
  }

  @Get('trend')
  getTrend(@Query() query: AnalysisTrendDto) {
    return this.analysisService.getTrend(query)
  }

  @Post('filter')
  getFiltered(@Body() query: AnalysisFilterDto) {
    return this.analysisService.getFiltered(query)
  }
}
