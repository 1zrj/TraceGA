import { create } from 'zustand'
import { message } from 'antd'
import { getAlarmList, getAlarmTrend, updateAlarmStatus } from '@/api'
import type { AlarmItem, AlarmTrendItem } from '@/types'

interface AlarmFilters {
  keyword: string
  level: string
  status: string
  appId: string
  timeRange: string
  startTime?: string
  endTime?: string
}

const DEFAULT_FILTERS: AlarmFilters = {
  keyword: '',
  level: '',
  status: '',
  appId: '',
  timeRange: '1d',
}

interface AlarmState {
  // data
  records: AlarmItem[]
  trendData: AlarmTrendItem[]
  total: number

  // loading
  loading: boolean
  trendLoading: boolean

  // filters & pagination
  filters: AlarmFilters
  page: number
  pageSize: number

  // detail drawer
  detailDrawerOpen: boolean
  selectedRecord: AlarmItem | null

  // actions
  fetchList: () => Promise<void>
  fetchTrend: () => Promise<void>
  updateStatus: (id: string, status: string) => Promise<void>
  setFilters: (partial: Partial<AlarmFilters>) => void
  resetFilters: () => void
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  openDetail: (record: AlarmItem) => void
  closeDetail: () => void
}

export const useAlarmStore = create<AlarmState>((set, get) => ({
  // ── initial state ──
  records: [],
  trendData: [],
  total: 0,
  loading: false,
  trendLoading: false,
  filters: { ...DEFAULT_FILTERS },
  page: 1,
  pageSize: 10,
  detailDrawerOpen: false,
  selectedRecord: null,

  // ── fetch list ──
  fetchList: async () => {
    const { filters, page, pageSize } = get()
    set({ loading: true })
    try {
      const res = await getAlarmList({
        page,
        pageSize,
        keyword: filters.keyword || undefined,
        level: filters.level || undefined,
        status: filters.status || undefined,
        appId: filters.appId || undefined,
        startTime: filters.startTime,
        endTime: filters.endTime,
      })
      set({ records: res.list, total: res.total })
    } catch (error) {
      console.error('Failed to fetch alarm list:', error)
    } finally {
      set({ loading: false })
    }
  },

  // ── fetch trend ──
  fetchTrend: async () => {
    const { filters } = get()
    set({ trendLoading: true })
    try {
      const data = await getAlarmTrend({ timeRange: filters.timeRange })
      set({ trendData: data })
    } catch (error) {
      console.error('Failed to fetch alarm trend:', error)
    } finally {
      set({ trendLoading: false })
    }
  },

  // ── update status ──
  updateStatus: async (id: string, status: string) => {
    try {
      await updateAlarmStatus(id, { status: status as 'processing' | 'resolved' | 'closed' })
      message.success(
        status === 'processing' ? '已开始处理' : status === 'resolved' ? '已解决' : '已关闭',
      )
      // 刷新列表
      await get().fetchList()
    } catch (error) {
      console.error('Failed to update alarm status:', error)
      message.error('状态更新失败，请重试')
    }
  },

  // ── filters ──
  setFilters: (partial) => {
    set((state) => ({ filters: { ...state.filters, ...partial } }))
  },

  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS }, page: 1 })
  },

  // ── pagination ──
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ page: 1, pageSize }),

  // ── detail drawer ──
  openDetail: (record) => set({ detailDrawerOpen: true, selectedRecord: record }),
  closeDetail: () => set({ detailDrawerOpen: false, selectedRecord: null }),
}))
