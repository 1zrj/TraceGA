import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Table, Tag } from 'antd'
import { getAlarmList } from '@/api'
import type { AlarmItem } from '@/types'
import { usePagination } from '@/hooks/usePagination'

const levelColors: Record<string, string> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
}

const statusColors: Record<string, string> = {
  active: 'red',
  acknowledged: 'orange',
  resolved: 'green',
}

const levelLabels: Record<string, string> = {
  critical: '严重',
  warning: '警告',
  info: '信息',
}

const statusLabels: Record<string, string> = {
  active: '活跃',
  acknowledged: '已确认',
  resolved: '已解决',
}

export const AlarmList: React.FC = () => {
  const [alarms, setAlarms] = useState<AlarmItem[]>([])
  const [loading, setLoading] = useState(true)
  const { currentPage, pageSize, total, setTotal, handlePageChange, handlePageSizeChange } =
    usePagination()

  const fetchAlarms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAlarmList({ page: currentPage, pageSize })
      setAlarms(res.list || [])
      setTotal(res.total || 0)
    } catch (error) {
      console.error('Failed to fetch alarms:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, setTotal])

  const columns = useMemo(
    () => [
      { title: '告警名称', dataIndex: 'name', key: 'name' },
      { title: '类型', dataIndex: 'type', key: 'type' },
      {
        title: '级别',
        dataIndex: 'level',
        key: 'level',
        render: (level: string) => (
          <Tag color={levelColors[level] || 'default'}>{levelLabels[level] || level}</Tag>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => (
          <Tag color={statusColors[status] || 'default'}>{statusLabels[status] || status}</Tag>
        ),
      },
      { title: '规则', dataIndex: 'rule', key: 'rule', ellipsis: true },
      { title: '应用ID', dataIndex: 'appId', key: 'appId' },
      { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
    ],
    [],
  )

  useEffect(() => {
    fetchAlarms()
  }, [fetchAlarms])

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1e293b', marginBottom: 24 }}>
        告警管理
      </h1>

      <Table
        columns={columns}
        dataSource={alarms}
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
  )
}
