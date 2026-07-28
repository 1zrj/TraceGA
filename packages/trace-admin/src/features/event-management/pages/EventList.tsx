import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Table, Button, Space, Modal, Form, Input, Select, message } from 'antd'
import { getEvents, deleteEvent, createEvent, updateEvent } from '@/api'
import type { Event } from '@/types'
import { FilterPanel } from '@/components'
import { usePagination } from '@/hooks/usePagination'
import { useFilter } from '@/hooks/useFilter'

const filterConfig = [
  { key: 'keyword', label: '关键词', type: 'input' as const, placeholder: '搜索事件名称' },
]

export const EventList: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [form] = Form.useForm()
  const { currentPage, pageSize, total, setTotal, handlePageChange, handlePageSizeChange } =
    usePagination()
  const { filters, updateFilters, clearAllFilters } = useFilter<{ keyword?: string }>()

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getEvents({
        page: currentPage,
        pageSize,
        ...filters,
      })
      setEvents(res.list || [])
      setTotal(res.total || 0)
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

  const handleEdit = useCallback(
    (record: Event) => {
      setEditingEvent(record)
      form.setFieldsValue({
        eventName: record.eventName,
        eventType: record.eventType,
        description: record.description,
      })
      setModalOpen(true)
    },
    [form],
  )

  const handleCreate = useCallback(() => {
    setEditingEvent(null)
    form.resetFields()
    setModalOpen(true)
  }, [form])

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteEvent(id)
        message.success('删除成功')
        fetchEvents()
      } catch (error) {
        console.error('Failed to delete event:', error)
      }
    },
    [fetchEvents],
  )

  const handleModalOk = useCallback(async () => {
    try {
      const values = await form.validateFields()
      setConfirmLoading(true)
      if (editingEvent) {
        await updateEvent(editingEvent.id, {
          eventName: values.eventName,
          eventType: values.eventType,
          description: values.description,
        })
        message.success('更新成功')
      } else {
        await createEvent({
          eventName: values.eventName,
          eventType: values.eventType,
          description: values.description,
          appId: 'app001',
        })
        message.success('创建成功')
      }
      setModalOpen(false)
      form.resetFields()
      fetchEvents()
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
      console.error('Failed to save event:', error)
      message.error('操作失败')
    } finally {
      setConfirmLoading(false)
    }
  }, [editingEvent, form, fetchEvents])

  const handleModalCancel = useCallback(() => {
    setModalOpen(false)
    form.resetFields()
  }, [form])

  const columns = useMemo(
    () => [
      { title: '事件名称', dataIndex: 'eventName', key: 'eventName' },
      { title: '事件类型', dataIndex: 'eventType', key: 'eventType' },
      { title: '应用ID', dataIndex: 'appId', key: 'appId' },
      { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
      {
        title: '操作',
        key: 'action',
        render: (_: unknown, record: Event) => (
          <Space>
            <Button size="small" onClick={() => handleEdit(record)}>
              编辑
            </Button>
            <Button
              size="small"
              danger
              onClick={() => {
                Modal.confirm({
                  title: '确认删除',
                  content: `确定要删除事件「${record.eventName}」吗？`,
                  okButtonProps: { danger: true },
                  onOk: () => handleDelete(record.id),
                })
              }}
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [handleEdit, handleDelete],
  )

  useEffect(() => {
    fetchEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // useRef 持久化 timer，避免 useMemo/useCallback 重建时 timer 丢失
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const handleValuesChange = useCallback(
    (values: Record<string, unknown>) => {
      updateFilters(values)
      clearTimeout(fetchTimerRef.current)
      fetchTimerRef.current = setTimeout(fetchEvents, 500)
    },
    [updateFilters, fetchEvents],
  )

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1e293b', margin: 0 }}>事件管理</h1>
        <Button type="primary" onClick={handleCreate}>
          新建事件
        </Button>
      </div>

      <FilterPanel
        filters={filterConfig}
        modelValue={filters}
        onSearch={handleSearch}
        onReset={handleReset}
        onValuesChange={handleValuesChange}
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

      <Modal
        title={editingEvent ? '编辑事件' : '新建事件'}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={confirmLoading}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="eventName"
            label="事件名称"
            rules={[{ required: true, message: '请输入事件名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="eventType"
            label="事件类型"
            rules={[{ required: true, message: '请选择事件类型' }]}
          >
            <Select>
              <Select.Option value="click">点击</Select.Option>
              <Select.Option value="page_view">页面浏览</Select.Option>
              <Select.Option value="custom">自定义</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
