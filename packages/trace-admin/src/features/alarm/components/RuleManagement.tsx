import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Table, Tag, Space, Form, Input, Select, InputNumber, Switch, message } from 'antd'
import { Button, Modal } from '@/components/ui'
import dayjs from 'dayjs'
import { getAlarmRules, createAlarmRule, updateAlarmRule, deleteAlarmRule } from '@/api'
import type { AlarmRuleItem } from '@/types'

const OPERATOR_MAP: Record<string, { label: string; symbol: string }> = {
  gt: { label: '超过', symbol: '>' },
  lt: { label: '低于', symbol: '<' },
}

const NOTIFY_OPTIONS = [
  { label: 'Webhook', value: 'webhook' },
  { label: '邮件', value: 'email' },
  { label: '无', value: '' },
]

interface RuleFormValues {
  appId: string
  eventName: string
  threshold: number
  operator: 'gt' | 'lt'
  notifyType: string
  webhookUrl?: string
  status: boolean
}

const DEFAULT_FORM: RuleFormValues = {
  appId: 'trace-app',
  eventName: '',
  threshold: 100,
  operator: 'gt',
  notifyType: 'webhook',
  webhookUrl: '',
  status: true,
}

export const RuleManagement: React.FC = () => {
  const [rules, setRules] = useState<AlarmRuleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10

  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AlarmRuleItem | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [form] = Form.useForm()

  const fetchRules = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await getAlarmRules({ page: p, pageSize })
      setRules(res.list || [])
      setTotal(res.total || 0)
    } catch (error) {
      console.error('Failed to fetch alarm rules:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRules(1)
  }, [fetchRules])

  const handleCreate = useCallback(() => {
    setEditingRule(null)
    form.setFieldsValue({ ...DEFAULT_FORM })
    setModalOpen(true)
  }, [form])

  const handleEdit = useCallback(
    (record: AlarmRuleItem) => {
      setEditingRule(record)
      form.setFieldsValue({
        appId: record.appId,
        eventName: record.eventName,
        threshold: record.threshold,
        operator: record.operator,
        notifyType: record.notifyType || 'webhook',
        webhookUrl: record.webhookUrl,
        status: record.status === 1,
      })
      setModalOpen(true)
    },
    [form],
  )

  const handleDelete = useCallback(
    (record: AlarmRuleItem) => {
      Modal.confirm({
        title: '确认删除',
        content: `确认删除规则「${record.eventName}」？删除后定时任务将不再检测该规则。`,
        okText: '确认删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          try {
            await deleteAlarmRule(record.id)
            message.success('删除成功')
            fetchRules(page)
          } catch (error) {
            console.error('Failed to delete alarm rule:', error)
            message.error('删除失败，请重试')
          }
        },
      })
    },
    [fetchRules, page],
  )

  const handleToggleStatus = useCallback(
    async (record: AlarmRuleItem) => {
      const next = record.status === 1 ? 0 : 1
      try {
        await updateAlarmRule(record.id, { status: next })
        message.success(next === 1 ? '已启用规则' : '已停用规则')
        fetchRules(page)
      } catch (error) {
        console.error('Failed to toggle alarm rule status:', error)
        message.error('操作失败，请重试')
      }
    },
    [fetchRules, page],
  )

  const handleModalOk = useCallback(async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        appId: values.appId,
        eventName: values.eventName,
        threshold: values.threshold,
        operator: values.operator,
        notifyType: values.notifyType,
        webhookUrl: values.webhookUrl,
        status: values.status ? 1 : 0,
      }
      setConfirmLoading(true)
      if (editingRule) {
        await updateAlarmRule(editingRule.id, payload)
        message.success('更新成功')
      } else {
        await createAlarmRule(payload)
        message.success('创建成功')
      }
      setModalOpen(false)
      form.resetFields()
      fetchRules(page)
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
      console.error('Failed to save alarm rule:', error)
      message.error('操作失败，请重试')
    } finally {
      setConfirmLoading(false)
    }
  }, [editingRule, form, fetchRules, page])

  const handleModalCancel = useCallback(() => {
    setModalOpen(false)
    form.resetFields()
  }, [form])

  const columns = useMemo(
    () => [
      { title: '事件名称', dataIndex: 'eventName', key: 'eventName', width: 160, ellipsis: true },
      { title: '应用ID', dataIndex: 'appId', key: 'appId', width: 130 },
      { title: '阈值', dataIndex: 'threshold', key: 'threshold', width: 80 },
      {
        title: '操作符',
        dataIndex: 'operator',
        key: 'operator',
        width: 100,
        render: (operator: string) => {
          const info = OPERATOR_MAP[operator] || { label: operator, symbol: '?' }
          return (
            <span>
              <span style={{ fontWeight: 600 }}>{info.symbol}</span> {info.label}
            </span>
          )
        },
      },
      {
        title: '通知方式',
        dataIndex: 'notifyType',
        key: 'notifyType',
        width: 100,
        render: (notifyType: string) =>
          notifyType === 'webhook' ? (
            <Tag color="blue">Webhook</Tag>
          ) : notifyType === 'email' ? (
            <Tag color="purple">邮件</Tag>
          ) : (
            <Tag>无</Tag>
          ),
      },
      {
        title: 'Webhook 地址',
        dataIndex: 'webhookUrl',
        key: 'webhookUrl',
        width: 260,
        ellipsis: true,
        render: (url: string) => url || '-',
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 80,
        render: (status: number) =>
          status === 1 ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>,
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 170,
        render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: '操作',
        key: 'actions',
        width: 190,
        fixed: 'right' as const,
        render: (_: unknown, record: AlarmRuleItem) => (
          <Space size="small">
            <Button type="link" size="small" onClick={() => handleEdit(record)}>
              编辑
            </Button>
            <Button type="link" size="small" onClick={() => handleToggleStatus(record)}>
              {record.status === 1 ? '停用' : '启用'}
            </Button>
            <Button type="link" size="small" danger onClick={() => handleDelete(record)}>
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [handleEdit, handleToggleStatus, handleDelete],
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          规则列表（定时任务每 60s 按规则检测一次）
        </div>
        <Button type="primary" onClick={handleCreate}>
          新建规则
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={rules}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1300 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: (t: number) => `共 ${t} 条规则`,
          onChange: (p: number) => {
            setPage(p)
            fetchRules(p)
          },
        }}
        locale={{ emptyText: '暂无规则' }}
      />

      <Modal
        title={editingRule ? '编辑规则' : '新建规则'}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={confirmLoading}
        width={560}
        destroyOnHidden={false}
      >
        <Form
          form={form}
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 16 }}
          initialValues={DEFAULT_FORM}
        >
          <Form.Item
            name="appId"
            label="应用ID"
            rules={[{ required: true, message: '请输入应用ID' }]}
          >
            <Input placeholder="如 trace-app" />
          </Form.Item>
          <Form.Item
            name="eventName"
            label="事件名称"
            rules={[{ required: true, message: '请输入事件名称' }]}
          >
            <Input placeholder="如 page_view / button_click / error_js-error" />
          </Form.Item>
          <Form.Item
            name="threshold"
            label="阈值"
            rules={[{ required: true, message: '请输入阈值' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="窗口期内事件量" />
          </Form.Item>
          <Form.Item name="operator" label="操作符" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '超过（>）', value: 'gt' },
                { label: '低于（<）', value: 'lt' },
              ]}
            />
          </Form.Item>
          <Form.Item name="notifyType" label="通知方式">
            <Select options={NOTIFY_OPTIONS} />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev: Record<string, unknown>, cur: Record<string, unknown>) =>
              prev.notifyType !== cur.notifyType
            }
          >
            {({ getFieldValue }: { getFieldValue: (name: string) => unknown }) =>
              getFieldValue('notifyType') === 'webhook' ? (
                <Form.Item
                  name="webhookUrl"
                  label="Webhook 地址"
                  rules={[{ required: true, message: '请输入 webhook 接收地址' }]}
                >
                  <Input placeholder="如 https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
