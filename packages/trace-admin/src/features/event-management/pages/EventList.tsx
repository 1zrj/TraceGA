// 事件管理页面 — 对齐公共组件库与交互规范

import React, { useState, useCallback } from 'react'
import { Space, Tag, Form, Descriptions } from 'antd'
import type { Dayjs } from 'dayjs'
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { AppTable } from '@/components/ui/AppTable'
import type { AppTableColumn, AppTableRequestParams } from '@/components/ui/AppTable'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { RangePicker } from '@/components/ui/DatePicker'
import { Modal } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmButton } from '@/components/feedback/ConfirmButton'
import { notify } from '@/components/feedback/notification'
import { getEvents, deleteEvent, createEvent, updateEvent } from '@/api'
import type { Event } from '@/types'

// 常量

const EVENT_TYPE_OPTIONS = [
  { label: '点击事件', value: 'click' },
  { label: '页面浏览', value: 'pageview' },
  { label: '曝光事件', value: 'exposure' },
  { label: '自定义事件', value: 'custom' },
]

const EVENT_TYPE_MAP: Record<string, string> = {
  click: '点击',
  pageview: '浏览',
  exposure: '曝光',
  custom: '自定义',
}

// 列配置（静态部分）

const baseColumns: AppTableColumn<Event>[] = [
  {
    title: '事件名称',
    dataIndex: 'name' as keyof Event & string,
    width: 200,
    ellipsis: true,
  },
  {
    title: '事件类型',
    dataIndex: 'type' as keyof Event & string,
    width: 100,
    render: (value: unknown) => {
      const type = String(value ?? '')
      return <Tag>{EVENT_TYPE_MAP[type] ?? type}</Tag>
    },
  },
  {
    title: '发生时间',
    dataIndex: 'timestamp' as keyof Event & string,
    width: 180,
    sorter: true,
  },
  {
    title: '用户 ID',
    dataIndex: 'userId' as keyof Event & string,
    width: 120,
    ellipsis: true,
  },
  {
    title: '会话 ID',
    dataIndex: 'sessionId' as keyof Event & string,
    width: 140,
    ellipsis: true,
  },
]

// 事件管理页面

export const EventList: React.FC = () => {
  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [eventType, setEventType] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Modal / Drawer 状态
  const [modalVisible, setModalVisible] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [detailEvent, setDetailEvent] = useState<Event | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [form] = Form.useForm()

  const isEdit = !!editingEvent

  //  数据请求
  const handleRequest = useCallback(
    async (params: AppTableRequestParams) => {
      const res = await getEvents({
        page: params.current,
        pageSize: params.pageSize,
        keyword: keyword || undefined,
        eventType,
        startTime: dateRange?.[0]?.format('YYYY-MM-DD'),
        endTime: dateRange?.[1]?.format('YYYY-MM-DD'),
        sortField: params.sortField,
        sortOrder: params.sortOrder,
      })
      return {
        data: res.list ?? [],
        success: true,
        total: res.total ?? 0,
      }
    },
    [keyword, eventType, dateRange],
  )

  // 筛选操作
  const handleSearch = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const handleReset = useCallback(() => {
    setKeyword('')
    setEventType(undefined)
    setDateRange(null)
    setRefreshKey((k) => k + 1)
  }, [])

  const hasFilters = !!(keyword || eventType || dateRange)
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  //  查看详情
  const handleView = useCallback((record: Event) => {
    setDetailEvent(record)
    setDrawerVisible(true)
  }, [])

  const handleRowClick = useCallback(
    (record: Event) => {
      handleView(record)
    },
    [handleView],
  )

  //  新建 / 编辑
  const handleCreate = useCallback(() => {
    setEditingEvent(null)
    form.resetFields()
    setModalVisible(true)
  }, [form])

  const handleEdit = useCallback(
    (record: Event) => {
      setEditingEvent(record)
      form.setFieldsValue({
        name: record.name,
        type: record.type,
      })
      setModalVisible(true)
    },
    [form],
  )

  const handleModalClose = useCallback(() => {
    setModalVisible(false)
    setEditingEvent(null)
    form.resetFields()
  }, [form])

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      if (isEdit && editingEvent) {
        await updateEvent(editingEvent.id, values)
        notify.success('编辑成功')
      } else {
        await createEvent(values)
        notify.success('创建成功')
      }

      handleModalClose()
      triggerRefresh()
    } catch {
      // 表单校验失败时不处理
    } finally {
      setSubmitting(false)
    }
  }, [form, isEdit, editingEvent, handleModalClose, triggerRefresh])

  //  操作列
  const actionColumn: AppTableColumn<Event> = {
    title: '操作',
    key: 'action',
    width: 200,
    fixed: 'right',
    render: (_: unknown, record: Event) => (
      <Space size="small">
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            handleView(record)
          }}
        >
          查看
        </Button>
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            handleEdit(record)
          }}
        >
          编辑
        </Button>
        <ConfirmButton
          type="link"
          size="small"
          danger
          icon={<DeleteOutlined />}
          confirmTitle="确认删除"
          confirmContent={`确定删除事件「${record.name}」？删除后数据不可恢复。`}
          okText="确认删除"
          onConfirm={async () => {
            await deleteEvent(record.id)
            notify.success('删除成功')
            triggerRefresh()
          }}
        >
          删除
        </ConfirmButton>
      </Space>
    ),
  }

  return (
    <div>
      <h1
        style={{
          fontSize: 'var(--tk-font-size-2xl, 24px)',
          fontWeight: 600,
          color: 'var(--tk-color-text, #1e293b)',
          marginBottom: 24,
        }}
      >
        事件管理
      </h1>

      {/* 筛选栏  */}
      <div
        style={{
          padding: 16,
          background: 'var(--tk-color-bg-container, #fff)',
          borderRadius: 'var(--tk-radius-lg, 8px)',
          marginBottom: 16,
        }}
      >
        <Space wrap size="middle">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 14,
                color: 'var(--tk-color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              关键词
            </span>
            <Input.Search
              placeholder="搜索事件名称"
              value={keyword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeyword(e.target.value)}
              onSearch={handleSearch}
              style={{ width: 200 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 14,
                color: 'var(--tk-color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              事件类型
            </span>
            <Select
              placeholder="选择事件类型"
              options={EVENT_TYPE_OPTIONS}
              value={eventType}
              onChange={(val: unknown) => setEventType(val as string | undefined)}
              style={{ width: 160 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 14,
                color: 'var(--tk-color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              时间范围
            </span>
            <RangePicker
              value={dateRange ?? undefined}
              onChange={(dates: [Dayjs, Dayjs] | null) => setDateRange(dates)}
              style={{ width: 260 }}
            />
          </div>

          <Space>
            <Button onClick={handleReset}>重置</Button>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              查询
            </Button>
          </Space>
        </Space>
      </div>

      {/* 表格 */}
      <AppTable<Event>
        variant="b"
        columns={[...baseColumns, actionColumn]}
        request={handleRequest}
        refreshKey={refreshKey}
        showSearchEmpty={hasFilters}
        emptyDescription="暂无埋点事件，请创建第一个事件"
        emptyAction={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建事件
          </Button>
        }
        onRetry={handleSearch}
        defaultSort={{ field: 'timestamp', order: 'descend' }}
        onRowClick={handleRowClick}
        toolBar={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建事件
          </Button>
        }
      />

      {/* 新建/编辑 Modal  */}
      <Modal
        variant="b"
        title={isEdit ? '编辑事件' : '新建事件'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleModalClose}
        confirmLoading={submitting}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="事件名称"
            name="name"
            rules={[
              { required: true, message: '请输入事件名称' },
              { maxLength: 30, message: '最多 30 个字符' },
            ]}
          >
            <Input maxLength={30} showCount placeholder="请输入事件名称，如：首页搜索按钮点击" />
          </Form.Item>

          <Form.Item
            label="事件类型"
            name="type"
            rules={[{ required: true, message: '请选择事件类型' }]}
          >
            <Select placeholder="请选择事件类型" options={EVENT_TYPE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/*  详情 Drawer  */}
      <Drawer
        variant="b"
        title={detailEvent ? `事件详情 — ${detailEvent.name}` : '事件详情'}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={640}
        extra={
          detailEvent && (
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setDrawerVisible(false)
                handleEdit(detailEvent)
              }}
            >
              编辑
            </Button>
          )
        }
      >
        {detailEvent && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="事件 ID">{detailEvent.id}</Descriptions.Item>
            <Descriptions.Item label="事件名称">{detailEvent.name}</Descriptions.Item>
            <Descriptions.Item label="事件类型">
              <Tag>{EVENT_TYPE_MAP[detailEvent.type] ?? detailEvent.type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="发生时间">{detailEvent.timestamp}</Descriptions.Item>
            <Descriptions.Item label="用户 ID">{detailEvent.userId ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="会话 ID">{detailEvent.sessionId ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="事件参数">
              <pre
                style={{
                  fontFamily: 'var(--tk-font-family-mono, monospace)',
                  fontSize: 12,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {JSON.stringify(detailEvent.properties ?? {}, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  )
}
