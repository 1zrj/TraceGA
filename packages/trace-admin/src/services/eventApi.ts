// API + Mock数据 - 组员B

import type { EventItem, EventType, EventStatus, ParamValueType } from './types'

// ===== Mock 数据 =====
const mockData: EventItem[] = [
  {
    id: '1',
    eventName: 'page_view',
    description: '页面浏览事件',
    eventType: 'exposure',
    paramCount: 5,
    pvCount: 128345,
    uvCount: 45801,
    status: 'active',
    updatedAt: '2026-07-24',
    paramTemplate: [
      { key: 'page_url', valueType: 'string', isRequired: true },
      { key: 'page_title', valueType: 'string', isRequired: false },
      { key: 'referrer', valueType: 'string', isRequired: false },
      { key: 'load_time', valueType: 'number', isRequired: true },
      { key: 'is_spa', valueType: 'boolean', isRequired: false },
    ],
  },
  {
    id: '2',
    eventName: 'btn_click',
    description: '按钮点击事件',
    eventType: 'click',
    paramCount: 3,
    pvCount: 56578,
    uvCount: 18346,
    status: 'active',
    updatedAt: '2026-07-23',
    paramTemplate: [
      { key: 'button_id', valueType: 'string', isRequired: true },
      { key: 'button_text', valueType: 'string', isRequired: false },
      { key: 'click_count', valueType: 'number', isRequired: false },
    ],
  },
  {
    id: '3',
    eventName: 'form_submit',
    description: '表单提交事件',
    eventType: 'custom',
    paramCount: 8,
    pvCount: 8124,
    uvCount: 5290,
    status: 'inactive',
    updatedAt: '2026-07-20',
    paramTemplate: [
      { key: 'form_id', valueType: 'string', isRequired: true },
      { key: 'form_name', valueType: 'string', isRequired: false },
      { key: 'success', valueType: 'boolean', isRequired: true },
      { key: 'error_msg', valueType: 'string', isRequired: false },
      { key: 'duration', valueType: 'number', isRequired: false },
      { key: 'field_count', valueType: 'number', isRequired: false },
      { key: 'page_url', valueType: 'string', isRequired: false },
      { key: 'user_type', valueType: 'string', isRequired: false },
    ],
  },
  {
    id: '4',
    eventName: 'user_login',
    description: '用户登录事件',
    eventType: 'custom',
    paramCount: 2,
    pvCount: 39876,
    uvCount: 27234,
    status: 'active',
    updatedAt: '2026-07-22',
    paramTemplate: [
      { key: 'login_type', valueType: 'string', isRequired: true },
      { key: 'is_success', valueType: 'boolean', isRequired: true },
    ],
  },
  {
    id: '5',
    eventName: 'video_play',
    description: '视频播放事件',
    eventType: 'click',
    paramCount: 6,
    pvCount: 23456,
    uvCount: 12123,
    status: 'active',
    updatedAt: '2026-07-21',
    paramTemplate: [
      { key: 'video_id', valueType: 'string', isRequired: true },
      { key: 'video_title', valueType: 'string', isRequired: false },
      { key: 'play_duration', valueType: 'number', isRequired: false },
      { key: 'total_duration', valueType: 'number', isRequired: false },
      { key: 'quality', valueType: 'string', isRequired: false },
      { key: 'is_fullscreen', valueType: 'boolean', isRequired: false },
    ],
  },
  {
    id: '6',
    eventName: 'search_query',
    description: '搜索查询事件',
    eventType: 'custom',
    paramCount: 4,
    pvCount: 67890,
    uvCount: 34567,
    status: 'active',
    updatedAt: '2026-07-24',
    paramTemplate: [
      { key: 'keyword', valueType: 'string', isRequired: true },
      { key: 'result_count', valueType: 'number', isRequired: false },
      { key: 'search_type', valueType: 'string', isRequired: false },
      { key: 'has_clicked', valueType: 'boolean', isRequired: false },
    ],
  },
  {
    id: '7',
    eventName: 'page_exit',
    description: '页面离开事件',
    eventType: 'exposure',
    paramCount: 3,
    pvCount: 112345,
    uvCount: 42801,
    status: 'active',
    updatedAt: '2026-07-23',
    paramTemplate: [
      { key: 'page_url', valueType: 'string', isRequired: true },
      { key: 'stay_duration', valueType: 'number', isRequired: true },
      { key: 'exit_type', valueType: 'string', isRequired: false },
    ],
  },
  {
    id: '8',
    eventName: 'ad_impression',
    description: '广告曝光事件',
    eventType: 'exposure',
    paramCount: 4,
    pvCount: 245678,
    uvCount: 89234,
    status: 'active',
    updatedAt: '2026-07-24',
    paramTemplate: [
      { key: 'ad_id', valueType: 'string', isRequired: true },
      { key: 'ad_position', valueType: 'string', isRequired: true },
      { key: 'ad_type', valueType: 'string', isRequired: false },
      { key: 'is_visible', valueType: 'boolean', isRequired: false },
    ],
  },
  {
    id: '9',
    eventName: 'share_click',
    description: '分享点击事件',
    eventType: 'click',
    paramCount: 3,
    pvCount: 3421,
    uvCount: 2890,
    status: 'inactive',
    updatedAt: '2026-07-18',
    paramTemplate: [
      { key: 'share_target', valueType: 'string', isRequired: true },
      { key: 'content_type', valueType: 'string', isRequired: false },
      { key: 'content_id', valueType: 'string', isRequired: false },
    ],
  },
  {
    id: '10',
    eventName: 'error_occur',
    description: '前端错误上报',
    eventType: 'custom',
    paramCount: 5,
    pvCount: 1523,
    uvCount: 1205,
    status: 'active',
    updatedAt: '2026-07-25',
    paramTemplate: [
      { key: 'error_type', valueType: 'string', isRequired: true },
      { key: 'error_msg', valueType: 'string', isRequired: true },
      { key: 'stack_trace', valueType: 'string', isRequired: false },
      { key: 'page_url', valueType: 'string', isRequired: false },
      { key: 'browser', valueType: 'string', isRequired: false },
    ],
  },
]

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms))

// ===== API =====
export async function getEvents(params: any): Promise<{ list: EventItem[]; total: number }> {
  await delay()
  let list = [...mockData]
  if (params.search) {
    const s = params.search.toLowerCase()
    list = list.filter((e) => e.eventName.includes(s) || e.description.includes(s))
  }
  if (params.type) list = list.filter((e) => e.eventType === params.type)
  if (params.status) list = list.filter((e) => e.status === params.status)
  if (params.sortBy) {
    list.sort((a: any, b: any) => {
      const order = params.sortOrder === 'asc' ? 1 : -1
      return (a[params.sortBy] > b[params.sortBy] ? 1 : -1) * order
    })
  }
  const total = list.length
  const start = (params.page - 1) * params.pageSize
  return { list: list.slice(start, start + params.pageSize), total }
}

export async function createEvent(data: Partial<EventItem>): Promise<EventItem> {
  await delay()
  const item: EventItem = {
    id: Date.now().toString(),
    eventName: data.eventName!,
    description: data.description!,
    eventType: data.eventType!,
    paramCount: data.paramTemplate?.length || 0,
    pvCount: 0,
    uvCount: 0,
    status: data.status || 'active',
    updatedAt: new Date().toISOString().slice(0, 10),
    paramTemplate: data.paramTemplate || [],
  }
  mockData.push(item)
  return item
}

export async function updateEvent(id: string, data: Partial<EventItem>): Promise<EventItem> {
  await delay()
  const idx = mockData.findIndex((e) => e.id === id)
  if (idx === -1) throw new Error('事件不存在')
  mockData[idx] = {
    ...mockData[idx],
    ...data,
    paramCount: data.paramTemplate?.length ?? mockData[idx].paramCount,
    updatedAt: new Date().toISOString().slice(0, 10),
  } as EventItem
  return mockData[idx]
}

export async function deleteEvent(id: string): Promise<void> {
  await delay()
  const idx = mockData.findIndex((e) => e.id === id)
  if (idx === -1) throw new Error('事件不存在')
  mockData.splice(idx, 1)
}

export async function checkName(name: string): Promise<{ available: boolean; reason?: string }> {
  await delay(100)
  return mockData.some((e) => e.eventName === name)
    ? { available: false, reason: '名称已存在' }
    : { available: true }
}

export async function getParams(eventName: string): Promise<any[]> {
  await delay(100)
  const e = mockData.find((x) => x.eventName === eventName)
  return e ? e.paramTemplate.map((p) => ({ key: p.key, label: p.key, valueType: p.valueType })) : []
}

// ===== 校验 =====
export function validateForm(data: any): { ok: boolean; msg?: string } {
  if (!data.eventName) return { ok: false, msg: '请输入事件名称' }
  if (!/^[a-z][a-z0-9_]*$/.test(data.eventName)) return { ok: false, msg: '仅小写字母+数字+下划线' }
  if (!data.description) return { ok: false, msg: '请输入描述' }
  if (!data.eventType) return { ok: false, msg: '请选择事件类型' }
  return { ok: true }
}
