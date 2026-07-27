import { Controller, Get, Query } from '@nestjs/common';
import { AnalysisService } from '../services/analysis.service';
import { AnalyticsOverviewDto, AnalyticsTrendDto, AnalyticsEventTypeTrendDto, AnalyticsTopEventsDto, AnalyticsErrorEventsDto, AnalyticsErrorTrendDto } from '../dto/analysis.dto';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get('overview')
  getOverview(@Query() query: AnalyticsOverviewDto) {
    return this.analysisService.getOverview(query);
  }

  @Get('event-trend')
  getEventTrend(@Query() query: AnalyticsTrendDto) {
    return this.analysisService.getEventTrend(query);
  }

  @Get('event-type-trend')
  getEventTypeTrend(@Query() query: AnalyticsEventTypeTrendDto) {
    return this.analysisService.getEventTypeTrend(query);
  }

  @Get('top-events')
  getTopEvents(@Query() query: AnalyticsTopEventsDto) {
    return this.analysisService.getTopEvents(query);
  }

  @Get('conversion-rate')
  getConversionRate(@Query() query: AnalyticsOverviewDto) {
    return this.analysisService.getConversionRate(query);
  }

  @Get('error-events')
  getErrorEvents(@Query() query: AnalyticsErrorEventsDto) {
    return this.analysisService.getErrorEvents(query);
  }

  @Get('error-trend')
  getErrorTrend(@Query() query: AnalyticsErrorTrendDto) {
    return this.analysisService.getErrorTrend(query);
  }
}
