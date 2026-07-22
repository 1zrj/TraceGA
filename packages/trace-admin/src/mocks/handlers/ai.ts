import { http, HttpResponse } from 'msw'

export const aiHandlers = [
  http.post('/api/ai/analyze', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: {
        conclusion:
          '根据近7天的数据分析，整体 PV 呈现稳定增长趋势，日均增长约 3.2%。UV 同步增长但幅度略低（日均 1.8%），说明老用户活跃度提升明显，新用户增长相对平稳。',
        suggestions: [
          '建议关注首页和登录页的转化率，这是用户流失的主要环节',
          'UV 增长趋缓，建议增加渠道推广或优化新用户引导流程',
          '周末 PV 有明显下降（约 25%），考虑增加周末运营活动',
        ],
      },
    })
  }),
]
