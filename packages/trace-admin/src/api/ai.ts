import request from '@/utils/request'
import { postSSE, type SSEStreamCallbacks } from './sse'
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

/** 流式 AI 分析 */
export const analyzeStream = (
  data: AiAnalyzeDto,
  callbacks: SSEStreamCallbacks,
  signal?: AbortSignal,
) => {
  return postSSE('/ai/analyze/stream', data, callbacks, signal)
}

export const getDailyReport = (data: DailyReportDto) => {
  return request.post<DailyReportResult>('/ai/daily-report', data)
}

/** 流式日报 */
export const getDailyReportStream = (
  data: DailyReportDto,
  callbacks: SSEStreamCallbacks,
  signal?: AbortSignal,
) => {
  return postSSE('/ai/daily-report/stream', data, callbacks, signal)
}

export const explainAnomaly = (data: AnomalyExplainDto) => {
  return request.post<AnomalyExplainResult>('/ai/anomaly-explain', data)
}

/** 流式异常解释 */
export const explainAnomalyStream = (
  data: AnomalyExplainDto,
  callbacks: SSEStreamCallbacks,
  signal?: AbortSignal,
) => {
  return postSSE('/ai/anomaly-explain/stream', data, callbacks, signal)
}

/** 自然语言查询：用户输入中文问题，AI 解析后执行查询并返回自然语言回答 */
export const nlQuery = (data: NlQueryDto) => {
  return request.post<NlQueryResult>('/ai/nl-query', data)
}

/** 流式自然语言查询 */
export const nlQueryStream = (
  data: NlQueryDto,
  callbacks: SSEStreamCallbacks,
  signal?: AbortSignal,
) => {
  return postSSE('/ai/nl-query/stream', data, callbacks, signal)
}

/** 埋点推荐：根据业务描述，AI 推荐需要埋点的事件列表 */
export const recommend = (data: RecommendDto) => {
  return request.post<RecommendResult>('/ai/recommend', data)
}

/** 流式埋点推荐 */
export const recommendStream = (
  data: RecommendDto,
  callbacks: SSEStreamCallbacks,
  signal?: AbortSignal,
) => {
  return postSSE('/ai/recommend/stream', data, callbacks, signal)
}
