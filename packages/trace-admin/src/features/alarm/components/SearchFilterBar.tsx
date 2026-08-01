import React, { useState, useCallback } from 'react'
import { Space } from 'antd'
import type { Dayjs } from 'dayjs'
import { Input, Select, RangePicker, Button } from '@/components/ui'
import { useAlarmStore } from '@/store/useAlarmStore'

const LEVEL_OPTIONS = [
  { label: '全部', value: '' },
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
  { label: '严重', value: 'critical' },
]

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已解决', value: 'resolved' },
  { label: '已关闭', value: 'closed' },
]

export const SearchFilterBar: React.FC = () => {
  const filters = useAlarmStore((s) => s.filters)
  const setFilters = useAlarmStore((s) => s.setFilters)
  const resetFilters = useAlarmStore((s) => s.resetFilters)
  const setPage = useAlarmStore((s) => s.setPage)
  const fetchList = useAlarmStore((s) => s.fetchList)

  // 本地维护 RangePicker 的 Dayjs 值（store 中存 ISO 字符串）
  const [rangeValue, setRangeValue] = useState<[Dayjs, Dayjs] | null>(null)
  // key 用于重置时强制重新挂载 RangePicker
  const [resetKey, setResetKey] = useState(0)

  const handleQuery = useCallback(() => {
    setPage(1)
    fetchList()
  }, [setPage, fetchList])

  const handleReset = useCallback(() => {
    resetFilters()
    setRangeValue(null)
    setResetKey((k) => k + 1)
    fetchList()
  }, [resetFilters, fetchList])

  const handleRangeChange = useCallback(
    (dates: [Dayjs, Dayjs] | null) => {
      setRangeValue(dates)
      if (dates && dates[0] && dates[1]) {
        setFilters({
          startTime: dates[0].startOf('day').toISOString(),
          endTime: dates[1].endOf('day').toISOString(),
        })
      } else {
        setFilters({ startTime: undefined, endTime: undefined })
      }
    },
    [setFilters],
  )

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>告警记录列表</div>
      <Space wrap size="middle" style={{ width: '100%' }}>
        <Input
          placeholder="应用ID"
          value={filters.appId}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setFilters({ appId: e.target.value })
          }
          style={{ width: 140 }}
          allowClear
        />
        <Input
          placeholder="告警名称"
          value={filters.keyword}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setFilters({ keyword: e.target.value })
          }
          style={{ width: 180 }}
          allowClear
        />
        <Select
          placeholder="告警级别"
          value={filters.level || undefined}
          onChange={(value: string) => setFilters({ level: value || '' })}
          options={LEVEL_OPTIONS}
          style={{ width: 130 }}
        />
        <Select
          placeholder="告警状态"
          value={filters.status || undefined}
          onChange={(value: string) => setFilters({ status: value || '' })}
          options={STATUS_OPTIONS}
          style={{ width: 130 }}
        />
        <RangePicker
          key={resetKey}
          value={rangeValue}
          onChange={handleRangeChange}
          style={{ width: 260 }}
        />
        <Space>
          <Button type="primary" onClick={handleQuery}>
            查询
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Space>
    </div>
  )
}
