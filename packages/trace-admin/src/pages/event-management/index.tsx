// App.tsx - 事件管理主页面 - 组员B
// 功能：列表/卡片视图、防抖搜索、分页、排序、增删改查、动态筛选

import React, { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Switch,
  Drawer,
  Form,
  Modal,
  message,
  Tooltip,
  Card,
  Row,
  Col,
  Statistic,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  CopyOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  BarsOutlined,
} from '@ant-design/icons'
import { FilterBuilder } from './FilterBuilder'
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  checkName,
  getParams,
  validateForm,
} from './api'
import type { EventItem, EventType, EventStatus } from './types'

const TYPE_MAP: Record<EventType, { color: string; label: string }> = {
  click: { color: 'blue', label: '点击' },
  exposure: { color: 'geekblue', label: '曝光' },
  custom: { color: 'green', label: '自定义' },
}

export default function App() {
  // 数据
  const [data, setData] = useState<EventItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 查询
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState<string>('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [typeFilter, setTypeFilter] = useState<EventType | undefined>()
  const [statusFilter, setStatusFilter] = useState<EventStatus | undefined>()

  // UI
  const [view, setView] = useState<'table' | 'card'>('table')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<EventItem | null>(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [delTarget, setDelTarget] = useState<EventItem | null>(null)
  const [delText, setDelText] = useState('')

  // 防抖搜索
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // 加载数据
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getEvents({
        search,
        page,
        pageSize,
        sortBy,
        sortOrder,
        type: typeFilter,
        status: statusFilter,
      })
      setData(res.list)
      setTotal(res.total)
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [search, page, pageSize, sortBy, sortOrder, typeFilter, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  // 排序
  const handleSort = (field: string) => {
    if (sortBy !== field) {
      setSortBy(field)
      setSortOrder('desc')
    } else if (sortOrder === 'desc') {
      setSortOrder('asc')
    } else {
      setSortBy('updatedAt')
      setSortOrder('desc')
    }
    setPage(1)
  }

  // 新建
  const handleCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ status: 'active', paramTemplate: [] })
    setDrawerOpen(true)
  }

  // 编辑
  const handleEdit = (record: EventItem) => {
    setEditing(record)
    form.setFieldsValue({
      eventName: record.eventName,
      description: record.description,
      eventType: record.eventType,
      status: record.status,
      paramTemplate: record.paramTemplate,
    })
    setDrawerOpen(true)
  }

  // 复制
  const handleCopy = (record: EventItem) => {
    setEditing(null)
    form.setFieldsValue({
      eventName: `${record.eventName}_copy`,
      description: record.description,
      eventType: record.eventType,
      status: 'inactive',
      paramTemplate: record.paramTemplate,
    })
    setDrawerOpen(true)
    message.success('已复制，请修改后保存')
  }

  // 删除
  const confirmDelete = async () => {
    if (!delTarget) return
    if (delText !== delTarget.eventName) {
      message.warning('名称输入不正确')
      return
    }
    await deleteEvent(delTarget.id)
    message.success(`「${delTarget.eventName}」已删除`)
    setDelTarget(null)
    load()
  }

  // 提交
  const handleSubmit = async (values: any) => {
    const v = validateForm(values)
    if (!v.ok) {
      message.error(v.msg)
      return
    }
    if (!editing) {
      const check = await checkName(values.eventName)
      if (!check.available) {
        message.error(check.reason)
        return
      }
    }
    setSubmitting(true)
    try {
      if (editing) {
        await updateEvent(editing.id, values)
        message.success('✅ 更新成功')
      } else {
        await createEvent(values)
        message.success('✅ 创建成功')
      }
      setDrawerOpen(false)
      load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // 状态切换
  const handleToggle = async (record: EventItem, checked: boolean) => {
    await updateEvent(record.id, { status: checked ? 'active' : 'inactive' })
    message.success(`${checked ? '启用' : '禁用'}「${record.eventName}」`)
    load()
  }

  // 统计
  const stats = {
    active: data.filter((e) => e.status === 'active').length,
    pv: data.reduce((s, e) => s + e.pvCount, 0),
    uv: data.reduce((s, e) => s + e.uvCount, 0),
  }

  // 表格列
  const columns = [
    {
      title: '事件名称',
      dataIndex: 'eventName',
      key: 'eventName',
      render: (t: string, r: EventItem) => (
        <a onClick={() => handleEdit(r)} style={{ color: '#1677ff', fontWeight: 500 }}>
          {t}
        </a>
      ),
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '类型',
      dataIndex: 'eventType',
      key: 'eventType',
      width: 85,
      render: (t: EventType) => <Tag color={TYPE_MAP[t].color}>{TYPE_MAP[t].label}</Tag>,
    },
    {
      title: '参数',
      dataIndex: 'paramCount',
      key: 'paramCount',
      width: 60,
      align: 'center' as const,
    },
    {
      title: (
        <span style={{ cursor: 'pointer' }} onClick={() => handleSort('pvCount')}>
          PV {sortBy === 'pvCount' ? (sortOrder === 'desc' ? '↓' : '↑') : '⇅'}
        </span>
      ),
      dataIndex: 'pvCount',
      key: 'pvCount',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: (
        <span style={{ cursor: 'pointer' }} onClick={() => handleSort('uvCount')}>
          UV {sortBy === 'uvCount' ? (sortOrder === 'desc' ? '↓' : '↑') : '⇅'}
        </span>
      ),
      dataIndex: 'uvCount',
      key: 'uvCount',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 70,
      render: (s: EventStatus, r: EventItem) => (
        <Switch checked={s === 'active'} onChange={(c) => handleToggle(r, c)} size="small" />
      ),
    },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 120 },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, r: EventItem) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(r)}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopy(r)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => setDelTarget(r)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  const eventOptions = data.map((e) => ({
    value: e.eventName,
    label: `${e.eventName}（${e.description}）`,
  }))

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* 头部 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>📊 事件管理</h2>
          <span style={{ fontSize: 13, color: '#999' }}>埋点事件定义、管理与筛选 — 组员B</span>
        </div>
        <Space>
          <Space>
            <Button
              type={view === 'table' ? 'primary' : 'default'}
              icon={<BarsOutlined />}
              size="small"
              onClick={() => setView('table')}
            >
              表格
            </Button>
            <Button
              type={view === 'card' ? 'primary' : 'default'}
              icon={<AppstoreOutlined />}
              size="small"
              onClick={() => setView('card')}
            >
              卡片
            </Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建事件
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="事件数" value={data.length} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="启用中" value={stats.active} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="PV合计" value={stats.pv} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="UV合计" value={stats.uv} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      {/* 工具栏 */}
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,.05)',
        }}
      >
        <Space wrap size="middle">
          <Input
            placeholder="🔍 搜索（防抖300ms）"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="类型"
            value={typeFilter}
            onChange={(v) => {
              setTypeFilter(v)
              setPage(1)
            }}
            allowClear
            style={{ width: 120 }}
            options={[
              { value: 'click', label: '点击' },
              { value: 'exposure', label: '曝光' },
              { value: 'custom', label: '自定义' },
            ]}
          />
          <Select
            placeholder="状态"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v)
              setPage(1)
            }}
            allowClear
            style={{ width: 100 }}
            options={[
              { value: 'active', label: '启用' },
              { value: 'inactive', label: '禁用' },
            ]}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setSearchInput('')
              setTypeFilter(undefined)
              setStatusFilter(undefined)
              setSortBy('updatedAt')
              setSortOrder('desc')
              setPage(1)
            }}
          >
            重置
          </Button>
        </Space>

        {eventOptions.length > 0 && (
          <FilterBuilder
            eventOptions={eventOptions}
            onFetchParams={getParams}
            onApply={(r) => {
              console.log('筛选:', r)
              message.success(`已应用 ${r.filters.length} 条条件（${r.logic}）`)
            }}
          />
        )}
      </div>

      {/* 数据区 */}
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,.05)',
          overflow: 'hidden',
        }}
      >
        {view === 'table' ? (
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => {
                setPage(p)
                setPageSize(ps)
              },
            }}
          />
        ) : (
          <div style={{ padding: 24 }}>
            <Row gutter={[16, 16]}>
              {data.map((item) => (
                <Col xs={24} sm={12} md={8} lg={6} key={item.id}>
                  <Card
                    hoverable
                    onClick={() => handleEdit(item)}
                    actions={[
                      <EditOutlined
                        key="e"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(item)
                        }}
                      />,
                      <CopyOutlined
                        key="c"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCopy(item)
                        }}
                      />,
                      <DeleteOutlined
                        key="d"
                        style={{ color: '#ff4d4f' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDelTarget(item)
                        }}
                      />,
                    ]}
                  >
                    <div style={{ fontWeight: 600, color: '#1677ff', marginBottom: 4 }}>
                      {item.eventName}
                    </div>
                    <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                      {item.description}
                    </div>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      PV: {item.pvCount.toLocaleString()} | UV: {item.uvCount.toLocaleString()}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Tag color={TYPE_MAP[item.eventType].color}>
                        {TYPE_MAP[item.eventType].label}
                      </Tag>
                      <Tag>{item.paramCount}参数</Tag>
                      <Tag color={item.status === 'active' ? 'green' : ''}>
                        {item.status === 'active' ? '启用' : '禁用'}
                      </Tag>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}
      </div>

      {/* 抽屉表单 */}
      <Drawer
        title={editing ? '✏️ 编辑事件' : '📝 新建事件'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={600}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={submitting} onClick={() => form.submit()}>
              保存
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ status: 'active', paramTemplate: [] }}
        >
          <Form.Item
            label="事件名称 *"
            name="eventName"
            rules={[
              { required: true },
              { pattern: /^[a-z][a-z0-9_]*$/, message: '仅小写字母+数字+下划线' },
            ]}
            extra="英文标识，如 page_view"
          >
            <Input disabled={!!editing} placeholder="page_view" />
          </Form.Item>
          <Form.Item label="中文描述 *" name="description" rules={[{ required: true }]}>
            <Input placeholder="页面浏览事件" />
          </Form.Item>
          <Form.Item label="事件类型 *" name="eventType" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'click', label: '点击' },
                { value: 'exposure', label: '曝光' },
                { value: 'custom', label: '自定义' },
              ]}
            />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select
              options={[
                { value: 'active', label: '启用' },
                { value: 'inactive', label: '禁用' },
              ]}
            />
          </Form.Item>

          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              margin: '16px 0 8px',
              paddingBottom: 8,
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            参数模板
          </div>
          <Form.List name="paramTemplate">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <div
                    key={key}
                    style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}
                  >
                    <Form.Item
                      name={[name, 'key']}
                      rules={[{ required: true, message: '参数名必填' }]}
                      style={{ flex: 1, marginBottom: 0 }}
                    >
                      <Input placeholder="参数名（如 page_url）" />
                    </Form.Item>
                    <Form.Item
                      name={[name, 'valueType']}
                      rules={[{ required: true }]}
                      style={{ width: 110, marginBottom: 0 }}
                    >
                      <Select
                        options={[
                          { value: 'string', label: 'string' },
                          { value: 'number', label: 'number' },
                          { value: 'boolean', label: 'boolean' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item
                      name={[name, 'isRequired']}
                      valuePropName="checked"
                      style={{ marginBottom: 0, paddingTop: 4 }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <input type="checkbox" />
                        必传
                      </div>
                    </Form.Item>
                    <Form.Item name={[name, 'description']} style={{ flex: 1, marginBottom: 0 }}>
                      <Input placeholder="描述" />
                    </Form.Item>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(name)}
                    />
                  </div>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ key: '', valueType: 'string', isRequired: false })}
                  block
                >
                  + 添加参数
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>

      {/* 删除确认 */}
      <Modal
        title="⚠️ 确认删除"
        open={!!delTarget}
        onCancel={() => setDelTarget(null)}
        onOk={confirmDelete}
        okText="确认删除"
        okButtonProps={{ danger: true, disabled: delText !== delTarget?.eventName }}
      >
        <p>
          确定删除「<strong>{delTarget?.eventName}</strong>」吗？此操作不可恢复。
        </p>
        <p style={{ fontSize: 13, color: '#999' }}>请输入事件名称以确认：</p>
        <Input
          placeholder={delTarget?.eventName}
          value={delText}
          onChange={(e) => setDelText(e.target.value)}
        />
      </Modal>
    </div>
  )
}
