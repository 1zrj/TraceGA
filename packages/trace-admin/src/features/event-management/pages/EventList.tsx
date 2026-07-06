import React, { useEffect, useState, useCallback } from 'react'
import { Table, Button, Space } from 'antd'
import { getEvents } from '@/api'
import type { Event } from '@/types'
import { FilterPanel } from '@/components'
import { usePagination } from '@/hooks/usePagination'
import { useFilter } from '@/hooks/useFilter'

const filterConfig = [
  { key: 'keyword', label: '关键词', type: 'input' as const, placeholder: '搜索事件名称' },
  { key: 'startTime', label: '开始时间', type: 'date' as const },
  { key: 'endTime', label: '结束时间', type: 'date' as const },
]

const columns = [
  { title: '事件名称', dataIndex: 'name', key: 'name' },
  { title: '事件类型', dataIndex: 'type', key: 'type' },
  { title: '发生时间', dataIndex: 'timestamp', key: 'timestamp' },
  { title: '用户ID', dataIndex: 'userId', key: 'userId' },
  {
    title: '操作',
    key: 'action',
    render: () => (
      <Space>
        <Button size="small">编辑</Button>
        <Button size="small" danger>删除</Button>
      </Space>
    ),
  },
]

export const EventList: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const { currentPage, pageSize, total, setTotal, handlePageChange, handlePageSizeChange } = usePagination()
  const { filters, clearAllFilters } = useFilter<{
    keyword?: string
    startTime?: string
    endTime?: string
  }>()

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getEvents({
        page: currentPage,
        pageSize,
        ...filters,
      })
      setEvents(res.data.data.list || [])
      setTotal(res.data.data.total || 0)
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, filters, setTotal])

  const handleSearch = useCallback(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleReset = useCallback(() => {
    clearAllFilters()
    fetchEvents()
  }, [clearAllFilters, fetchEvents])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1e293b', marginBottom: 24 }}>
        事件管理
      </h1>

      <FilterPanel
        filters={filterConfig}
        modelValue={filters}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      <div style={{ marginTop: 16 }}>
        <Table
          columns={columns}
          dataSource={events}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            onChange: handlePageChange,
            onShowSizeChange: (_: unknown, size: number) => handlePageSizeChange(size),
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (totalNum: number) => `共 ${totalNum} 条记录`,
          }}
        />
      </div>
    </div>
  )
}