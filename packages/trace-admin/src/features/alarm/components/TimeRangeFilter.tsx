import React, { useCallback } from 'react'
import { Radio } from 'antd'
import { useAlarmStore } from '@/store/useAlarmStore'

const TIME_OPTIONS = [
  { label: '15分钟', value: '15m' },
  { label: '1小时', value: '1h' },
  { label: '4小时', value: '4h' },
  { label: '1天', value: '1d' },
  { label: '7天', value: '7d' },
]

export const TimeRangeFilter: React.FC = () => {
  const timeRange = useAlarmStore((s) => s.filters.timeRange)
  const setFilters = useAlarmStore((s) => s.setFilters)
  const fetchTrend = useAlarmStore((s) => s.fetchTrend)
  const fetchList = useAlarmStore((s) => s.fetchList)

  const handleChange = useCallback(
    (e: { target: { value: string } }) => {
      setFilters({ timeRange: e.target.value })
      fetchTrend()
      fetchList()
    },
    [setFilters, fetchTrend, fetchList],
  )

  return (
    <Radio.Group
      value={timeRange}
      onChange={handleChange}
      optionType="button"
      buttonStyle="solid"
      options={TIME_OPTIONS}
    />
  )
}
