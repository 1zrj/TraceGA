import request from '@/utils/request'
import type { AiAnalysisResult, AiAnalyzeDto, DailyReportDto, AnomalyExplainDto, AiChatResult } from '@/types'

export const analyze = (data: AiAnalyzeDto) => {
  return request.post<AiAnalysisResult>('/ai/analyze', data)
}

export const getDailyReport = (data: DailyReportDto) => {
  return request.post<AiChatResult>('/ai/daily-report', data)
}

export const explainAnomaly = (data: AnomalyExplainDto) => {
  return request.post<AiChatResult>('/ai/anomaly-explain', data)
}