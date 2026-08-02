import React, { useEffect, useMemo, useCallback, useState } from 'react'
import { Card, Table, Tag, Space, Empty, Tabs } from 'antd'
import dayjs from 'dayjs'
import { Modal, Button } from '@/components/ui'
import { useAlarmStore } from '@/store/useAlarmStore'
import type { AlarmItem } from '@/types'
import { TimeRangeFilter } from '../components/TimeRangeFilter'
import { AlarmTrendChart } from '../components/AlarmTrendChart'
import { SearchFilterBar } from '../components/SearchFilterBar'
import { AlarmDetailDrawer } from '../components/AlarmDetailDrawer'
import { RuleManagement } from '../components/RuleManagement'
import './AlarmList.css'

const LEVEL_MAP: Record<string, { label: string; color: string }> = {
  critical: { label: '严重', color: 'red' },
  high: { label: '高', color: 'orange' },
  medium: { label: '中', color: 'blue' },
  low: { label: '低', color: 'default' },
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '未处理', color: 'red' },
  processing: { label: '处理中', color: 'orange' },
  resolved: { label: '已解决', color: 'green' },
  closed: { label: '已关闭', color: 'default' },
}

export const AlarmList: React.FC = () => {
  const [activeTab, setActiveTab] = useState('records')

  const records = useAlarmStore((s) => s.records)
  const total = useAlarmStore((s) => s.total)
  const loading = useAlarmStore((s) => s.loading)
  const page = useAlarmStore((s) => s.page)
  const pageSize = useAlarmStore((s) => s.pageSize)
  const fetchList = useAlarmStore((s) => s.fetchList)
  const fetchTrend = useAlarmStore((s) => s.fetchTrend)
  const setPage = useAlarmStore((s) => s.setPage)
  const setPageSize = useAlarmStore((s) => s.setPageSize)
  const openDetail = useAlarmStore((s) => s.openDetail)
  const updateStatus = useAlarmStore((s) => s.updateStatus)

  // 初始化加载
  useEffect(() => {
    fetchTrend()
  }, [fetchTrend])

  // 首次加载 + 分页变化时重新请求列表
  useEffect(() => {
    fetchList()
  }, [page, pageSize, fetchList])

  // ── 操作按钮回调 ──

  const handleView = useCallback(
    (record: AlarmItem) => {
      openDetail(record)
    },
    [openDetail],
  )

  const handleProcess = useCallback(
    (record: AlarmItem) => {
      Modal.confirm({
        title: '确认处理',
        content: `确认开始处理告警「${record.name}」？`,
        okText: '确认',
        cancelText: '取消',
        onOk: () => updateStatus(record.id, 'processing'),
      })
    },
    [updateStatus],
  )

  const handleResolve = useCallback(
    (record: AlarmItem) => {
      Modal.confirm({
        title: '确认解决',
        content: `确认该告警「${record.name}」已解决？`,
        okText: '确认',
        cancelText: '取消',
        onOk: () => updateStatus(record.id, 'resolved'),
      })
    },
    [updateStatus],
  )

  const handleClose = useCallback(
    (record: AlarmItem) => {
      Modal.confirm({
        title: '确认关闭',
        content: `确认关闭告警「${record.name}」？`,
        okText: '确认',
        cancelText: '取消',
        onOk: () => updateStatus(record.id, 'closed'),
      })
    },
    [updateStatus],
  )

  // ── 表格列定义 ──

  const columns = useMemo(
    () => [
      { title: '告警名称', dataIndex: 'name', key: 'name', width: 180, ellipsis: true },
      { title: '告警类型', dataIndex: 'type', key: 'type', width: 130 },
      {
        title: '告警级别',
        dataIndex: 'level',
        key: 'level',
        width: 100,
        render: (level: string) => {
          const info = LEVEL_MAP[level] || { label: level, color: 'default' }
          return <Tag color={info.color}>{info.label}</Tag>
        },
      },
      {
        title: '告警状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (status: string) => {
          const info = STATUS_MAP[status] || { label: status, color: 'default' }
          return <Tag color={info.color}>{info.label}</Tag>
        },
      },
      { title: '关联规则', dataIndex: 'rule', key: 'rule', width: 160, ellipsis: true },
      { title: '应用ID', dataIndex: 'appId', key: 'appId', width: 120 },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        title: '操作',
        key: 'actions',
        width: 200,
        fixed: 'right' as const,
        render: (_: unknown, record: AlarmItem) => (
          <Space size="small">
            <Button type="link" size="small" onClick={() => handleView(record)}>
              查看
            </Button>
            {record.status === 'pending' && (
              <Button type="link" size="small" onClick={() => handleProcess(record)}>
                处理
              </Button>
            )}
            {record.status === 'processing' && (
              <>
                <Button type="link" size="small" onClick={() => handleResolve(record)}>
                  解决
                </Button>
                <Button type="link" size="small" danger onClick={() => handleClose(record)}>
                  关闭
                </Button>
              </>
            )}
          </Space>
        ),
      },
    ],
    [handleView, handleProcess, handleResolve, handleClose],
  )

  return (
    <div style={{ background: '#f5f7fa', minHeight: '100%', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1e293b', marginBottom: 24 }}>
        告警管理
      </h1>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'records',
            label: '告警记录',
            children: (
              <>
                {/* 时间范围筛选 */}
                <div style={{ marginBottom: 16 }}>
                  <TimeRangeFilter />
                </div>

                {/* 趋势图 */}
                <AlarmTrendChart />

                {/* 表格区域 */}
                <Card styles={{ body: { padding: 24 } }}>
                  <SearchFilterBar />
                  <Table
                    columns={columns}
                    dataSource={records}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1200 }}
                    pagination={{
                      current: page,
                      pageSize,
                      total,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      pageSizeOptions: ['10', '20', '50'],
                      showTotal: (t: number) => `共 ${t} 条记录`,
                      onChange: (p: number, ps: number) => {
                        if (ps !== pageSize) {
                          setPageSize(ps)
                        } else {
                          setPage(p)
                        }
                      },
                    }}
                    rowClassName={(_record: unknown, index: number) =>
                      index % 2 === 1 ? 'row-striped' : ''
                    }
                    locale={{
                      emptyText: <Empty description="暂无告警记录" />,
                    }}
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'rules',
            label: '规则管理',
            children: <RuleManagement />,
          },
        ]}
      />

      {/* 详情抽屉 */}
      <AlarmDetailDrawer />
    </div>
  )
}
