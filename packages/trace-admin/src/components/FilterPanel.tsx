import React, { useCallback } from 'react'
import { Input, Select, DatePicker, Button, Space } from 'antd'
import type { FilterItem } from '@/types'

interface FilterPanelProps {
  filters: FilterItem[]
  modelValue?: Record<string, string>
  onSearch: () => void
  onReset: () => void
  /** 筛选值变化时回调 */
  onValuesChange?: (values: Record<string, string>) => void
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  modelValue = {},
  onSearch,
  onReset,
  onValuesChange,
}) => {
  const handleChange = useCallback(
    (key: string, value: string) => {
      onValuesChange?.({ ...modelValue, [key]: value })
    },
    [modelValue, onValuesChange],
  )

  const handleDateChange = useCallback(
    (key: string, date: unknown) => {
      const dateStr = date ? (date as Date).toISOString().split('T')[0] : ''
      onValuesChange?.({ ...modelValue, [key]: dateStr })
    },
    [modelValue, onValuesChange],
  )

  const handleReset = useCallback(() => {
    onValuesChange?.({})
    onReset()
  }, [onValuesChange, onReset])

  return (
    <div style={{ padding: 16, background: '#f5f7fa', borderRadius: 8 }}>
      <Space wrap size="middle">
        {filters.map((filter) => (
          <div key={filter.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: '#606266', whiteSpace: 'nowrap' }}>
              {filter.label}
            </span>
            {filter.type === 'input' && (
              <Input
                style={{ width: 180 }}
                placeholder={filter.placeholder}
                value={modelValue[filter.key]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleChange(filter.key, e.target.value)
                }
              />
            )}
            {filter.type === 'select' && filter.options && (
              <Select
                style={{ width: 180 }}
                placeholder="请选择"
                options={filter.options}
                value={modelValue[filter.key] || undefined}
                onChange={(value: string | undefined) => handleChange(filter.key, value || '')}
              />
            )}
            {filter.type === 'date' && (
              <DatePicker
                style={{ width: 180 }}
                value={modelValue[filter.key] ? new Date(modelValue[filter.key]) : undefined}
                onChange={(date: Date | null) => handleDateChange(filter.key, date)}
              />
            )}
          </div>
        ))}
        <Space>
          <Button type="primary" onClick={onSearch}>
            搜索
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Space>
    </div>
  )
}
