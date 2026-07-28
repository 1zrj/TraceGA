import { Injectable } from '@nestjs/common'
import { AiAnalyzeDto } from '../dto/ai-analyze.dto'

@Injectable()
export class AiService {
  async analyze(query: AiAnalyzeDto) {
    return {
      insight: '基于当前数据分析，用户留存率呈上升趋势，建议关注新用户引导流程优化。',
      suggestions: [
        '优化注册流程，减少用户流失',
        '增加新手引导，提升用户活跃度',
        '关注核心功能使用频率',
      ],
      metrics: {
        retentionRate: 0.65,
        conversionRate: 0.12,
        avgSessionDuration: 180,
      },
    }
  }
}
