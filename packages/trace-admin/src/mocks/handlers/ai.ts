import { http, HttpResponse, type HttpHandler } from 'msw'

// ─── 模拟数据 ───────────────────────────────────────────

const mockConclusion =
  '根据近7天的数据分析，整体 PV 呈现稳定增长趋势，日均增长约 3.2%。UV 同步增长但幅度略低（日均 1.8%），说明老用户活跃度提升明显，新用户增长相对平稳。\n\n' +
  '建议关注首页和登录页的转化率，这是用户流失的主要环节。UV 增长趋缓，建议增加渠道推广或优化新用户引导流程。周末 PV 有明显下降（约 25%），考虑增加周末运营活动。'

const mockDailyReport = `▎今日数据概览
日期：2024-01-15
PV：12,580（较昨日 +3.2%）
UV：3,250（较昨日 +1.8%）

▎热门事件
1. 用户登录 — 4,500 次
2. 商品浏览 — 3,200 次
3. 添加购物车 — 1,800 次
4. 订单完成 — 980 次

▎异常事件
• 支付接口超时 — 较昨日上升 15%，请关注后端服务状态`

const mockAnomalyExplain = `▎异常分析报告
事件：用户登录
当前值：4,500
对比值：3,800
变化幅度：+18.4%

▎可能原因
1. 渠道推广活动带来大量新用户
2. 登录页面进行了 UI 优化
3. 可能存在自动化脚本访问

▎建议
1. 检查推广渠道的流量质量
2. 监控登录接口的响应时间
3. 确认是否有异常的登录频率`

const mockNlQuery = `▎查询解析
问题：近7天用户登录事件趋势如何？

▎查询参数
• 时间范围：2024-01-09 ~ 2024-01-15
• 事件类型：login
• 排序：按时间降序

▎查询结果
共检索到 15,200 条记录

▎分析结论
近7天用户登录事件整体呈上升趋势，日均登录约 2,171 次。
其中 01-13（周六）达到峰值 2,800 次，01-09（周二）为低谷 1,800 次。
周末登录量明显高于工作日，符合用户行为预期。`

const mockRecommendation = `▎埋点推荐建议
业务描述：用户注册流程优化

▎推荐埋点
1. 事件名称：register_step_start
   类型：page_view
   触发时机：进入注册页面
   参数：referrer, utm_source

2. 事件名称：register_step_verify
   类型：click
   触发时机：点击获取验证码
   参数：verify_type, phone_prefix

3. 事件名称：register_step_complete
   类型：custom
   触发时机：注册成功提交
   参数：register_duration, result

4. 事件名称：register_step_abandon
   类型：custom
   触发时机：离开注册页面未完成
   参数：current_step, duration`

// ─── 模拟异步生成 SSE 消息 ──────────────────────────────

async function* mockSSEGenerator(text: string): AsyncGenerator<string> {
  // 按句号、问号、感叹号、换行分割为块
  const chunks = text.split(/(?<=[。！？\n])/).filter(Boolean)
  for (const chunk of chunks) {
    await new Promise((r) => setTimeout(r, 80))
    yield chunk
  }
}

/** 构建 SSE 响应体（text/event-stream） */
function buildSSEResponse(stream: AsyncGenerator<string>): Response {
  const encoder = new TextEncoder()
  let cancelled = false

  const readable = new ReadableStream({
    async pull(controller) {
      for await (const chunk of stream) {
        if (cancelled) return
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`),
        )
      }
      if (!cancelled) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
      }
      controller.close()
    },
    cancel() {
      cancelled = true
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// ─── Handler ─────────────────────────────────────────────

export const aiHandlers: HttpHandler[] = [
  // 非流式
  http.post('/api/ai/analyze', () => {
    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: {
        conclusion: mockConclusion,
        suggestions: [
          '建议关注首页和登录页的转化率，这是用户流失的主要环节',
          'UV 增长趋缓，建议增加渠道推广或优化新用户引导流程',
          '周末 PV 有明显下降（约 25%），考虑增加周末运营活动',
        ],
      },
    })
  }),

  // 流式
  http.post('/api/ai/analyze/stream', () => {
    return buildSSEResponse(mockSSEGenerator(mockConclusion))
  }),

  http.post('/api/ai/daily-report/stream', () => {
    return buildSSEResponse(mockSSEGenerator(mockDailyReport))
  }),

  http.post('/api/ai/anomaly-explain/stream', () => {
    return buildSSEResponse(mockSSEGenerator(mockAnomalyExplain))
  }),

  http.post('/api/ai/nl-query/stream', () => {
    return buildSSEResponse(mockSSEGenerator(mockNlQuery))
  }),

  http.post('/api/ai/recommend/stream', () => {
    return buildSSEResponse(mockSSEGenerator(mockRecommendation))
  }),
]
