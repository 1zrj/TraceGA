import { http, HttpResponse, type PathParams } from 'msw'
import { mockAlarmRecords, generateMockAlarmTrend } from '../data/mockData'

export const alarmHandlers = [
  // GET /api/alarm/list — 分页 + 筛选
  http.get('/api/alarm/list', ({ request }) => {
    const url = new URL(request.url)
    const keyword = url.searchParams.get('keyword')?.toLowerCase()
    const level = url.searchParams.get('level')
    const status = url.searchParams.get('status')
    const appId = url.searchParams.get('appId')
    const startTime = url.searchParams.get('startTime')
    const endTime = url.searchParams.get('endTime')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10)

    let filtered = [...mockAlarmRecords]

    // keyword 模糊匹配 name / type / rule
    if (keyword) {
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(keyword) ||
          r.type.toLowerCase().includes(keyword) ||
          r.rule.toLowerCase().includes(keyword),
      )
    }

    // level / status / appId 精确匹配
    if (level) {
      filtered = filtered.filter((r) => r.level === level)
    }
    if (status) {
      filtered = filtered.filter((r) => r.status === status)
    }
    if (appId) {
      filtered = filtered.filter((r) => r.appId === appId)
    }

    // 时间范围过滤
    if (startTime) {
      filtered = filtered.filter((r) => r.createdAt >= startTime)
    }
    if (endTime) {
      filtered = filtered.filter((r) => r.createdAt <= endTime)
    }

    // 分页
    const total = filtered.length
    const start = (page - 1) * pageSize
    const list = filtered.slice(start, start + pageSize)

    return HttpResponse.json({
      code: 200,
      message: 'success',
      data: { list, total },
    })
  }),

  // GET /api/alarm/trend — 告警趋势
  http.get('/api/alarm/trend', ({ request }) => {
    const url = new URL(request.url)
    const timeRange = url.searchParams.get('timeRange') || '1d'

    const data = generateMockAlarmTrend(timeRange)

    return HttpResponse.json({
      code: 200,
      message: 'success',
      data,
    })
  }),

  // GET /api/alarm/:id — 告警详情
  http.get('/api/alarm/:id', ({ params }: { params: PathParams }) => {
    const record = mockAlarmRecords.find((r) => r.id === params.id)
    if (record) {
      return HttpResponse.json({
        code: 200,
        message: 'success',
        data: record,
      })
    }
    return HttpResponse.json({ code: 404, message: '告警记录不存在', data: null }, { status: 404 })
  }),

  // PATCH /api/alarm/:id/status — 更新告警状态
  http.patch('/api/alarm/:id/status', async ({ params, request }) => {
    const body = (await request.json()) as { status: string; remark?: string }
    const record = mockAlarmRecords.find((r) => r.id === params.id)
    if (record) {
      record.status = body.status as typeof record.status
      record.updatedAt = new Date().toISOString()
      return HttpResponse.json({
        code: 200,
        message: 'success',
        data: record,
      })
    }
    return HttpResponse.json({ code: 404, message: '告警记录不存在', data: null }, { status: 404 })
  }),
]
