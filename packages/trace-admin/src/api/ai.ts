import request from '@/utils/request'
import type { AiAnalysisResult, AiAnalyzeDto } from '@/types'

export const analyze = (data: AiAnalyzeDto) => {
  return request.post<AiAnalysisResult>('/ai/analyze', data)
}