import request from '@/utils/request'
import type {
  AiAnalysisResult,
  AiAnalyzeDto,
  DailyReportDto,
  DailyReportResult,
  AnomalyExplainDto,
  AnomalyExplainResult,
  NlQueryDto,
  NlQueryResult,
  RecommendDto,
  RecommendResult,
} from '@/types'

export const analyze = (data: AiAnalyzeDto) => {
  return request.post<AiAnalysisResult>('/ai/analyze', data)
}

export const getDailyReport = (data: DailyReportDto) => {
  return request.post<DailyReportResult>('/ai/daily-report', data)
}

export const explainAnomaly = (data: AnomalyExplainDto) => {
  return request.post<AnomalyExplainResult>('/ai/anomaly-explain', data)
}

/** 自然语言查询：用户输入中文问题，AI 解析后执行查询并返回自然语言回答 */
export const nlQuery = (data: NlQueryDto) => {
  return request.post<NlQueryResult>('/ai/nl-query', data)
}

/** 埋点推荐：根据业务描述，AI 推荐需要埋点的事件列表 */
export const recommend = (data: RecommendDto) => {
  return request.post<RecommendResult>('/ai/recommend', data)
}
