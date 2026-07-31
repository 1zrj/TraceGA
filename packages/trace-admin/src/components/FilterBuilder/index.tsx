// FilterBuilder - 动态参数筛选器 - 组员B

import React, { useState, useCallback } from 'react'
import { Select, Input, Button, Tag, Space } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ParamValueType } from './types'

const OPERATORS = [
  { value: 'eq', label: '等于', types: ['string', 'number'] as ParamValueType[], needsVal: true },
  {
    value: 'neq',
    label: '不等于',
    types: ['string', 'number'] as ParamValueType[],
    needsVal: true,
  },
  { value: 'contains', label: '包含', types: ['string'] as ParamValueType[], needsVal: true },
  { value: 'gt', label: '>', types: ['number'] as ParamValueType[], needsVal: true },
  { value: 'gte', label: '≥', types: ['number'] as ParamValueType[], needsVal: true },
  { value: 'lt', label: '<', types: ['number'] as ParamValueType[], needsVal: true },
  { value: 'lte', label: '≤', types: ['number'] as ParamValueType[], needsVal: true },
  {
    value: 'exists',
    label: '有值',
    types: ['string', 'number', 'boolean'] as ParamValueType[],
    needsVal: false,
  },
  {
    value: 'not_exists',
    label: '无值',
    types: ['string', 'number', 'boolean'] as ParamValueType[],
    needsVal: false,
  },
]

interface Param {
  key: string
  label: string
  valueType: ParamValueType
}
interface Cond {
  id: string
  paramKey: string
  operator: string
  value: any
}

interface Props {
  eventOptions: { value: string; label: string }[]
  onFetchParams: (name: string) => Promise<Param[]>
  onApply: (result: any) => void
}

export const FilterBuilder: React.FC<Props> = ({ eventOptions, onFetchParams, onApply }) => {
  const [eventName, setEventName] = useState<string>('')
  const [params, setParams] = useState<Param[]>([])
  const [conds, setConds] = useState<Cond[]>([])
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND')

  const handleEvent = useCallback(
    async (val: string) => {
      setEventName(val)
      setConds([])
      if (val) {
        const list = await onFetchParams(val)
        setParams(list)
      } else setParams([])
    },
    [onFetchParams],
  )

  const addCond = () =>
    setConds([...conds, { id: `c${Date.now()}`, paramKey: '', operator: 'eq', value: '' }])

  const updateCond = (id: string, field: keyof Cond, val: any) => {
    setConds(
      conds.map((c) => {
        if (c.id !== id) return c
        const next: any = { ...c, [field]: val }
        if (field === 'paramKey') {
          const p = params.find((x) => x.key === val)
          if (p) {
            next.value = p.valueType === 'number' ? 0 : ''
          }
        }
        return next
      }),
    )
  }

  const removeCond = (id: string) => setConds(conds.filter((c) => c.id !== id))

  const getOps = (paramKey: string) => {
    const p = params.find((x) => x.key === paramKey)
    if (!p) return OPERATORS.filter((o) => o.needsVal)
    return OPERATORS.filter((o) => o.types.includes(p.valueType))
  }

  const handleApply = () => {
    const valid = conds.filter((c) => c.paramKey)
    if (!eventName || valid.length === 0) return
    onApply({ eventName, filters: valid, logic })
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: 14,
        background: '#f8fafc',
        border: '1px dashed #cbd5e1',
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>🎯 动态参数筛选器</div>

      <Space style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>事件：</span>
        <Select
          placeholder="选择事件"
          value={eventName || undefined}
          onChange={handleEvent}
          style={{ width: 220 }}
          allowClear
          options={eventOptions}
        />
      </Space>

      {eventName && (
        <>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
            可选参数：
            {params.map((p) => (
              <Tag key={p.key} color="blue">
                {p.label}({p.valueType})
              </Tag>
            ))}
          </div>
          {conds.map((c) => {
            const ops = getOps(c.paramKey)
            const curOp = ops.find((o) => o.value === c.operator) || ops[0]
            const paramDef = params.find((p) => p.key === c.paramKey)
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Select
                  placeholder="参数"
                  value={c.paramKey || undefined}
                  onChange={(v) => updateCond(c.id, 'paramKey', v)}
                  style={{ width: 160 }}
                  options={params.map((p) => ({ value: p.key, label: p.label }))}
                />
                <Select
                  placeholder="操作符"
                  value={c.operator}
                  onChange={(v) => updateCond(c.id, 'operator', v)}
                  style={{ width: 110 }}
                  disabled={!c.paramKey}
                  options={ops.map((o) => ({ value: o.value, label: o.label }))}
                />
                {curOp?.needsVal &&
                  (paramDef?.valueType === 'number' ? (
                    <Input
                      type="number"
                      placeholder="数值"
                      value={c.value}
                      onChange={(e) => updateCond(c.id, 'value', Number(e.target.value))}
                      style={{ width: 130 }}
                    />
                  ) : (
                    <Input
                      placeholder="值"
                      value={c.value}
                      onChange={(e) => updateCond(c.id, 'value', e.target.value)}
                      style={{ width: 160 }}
                    />
                  ))}
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeCond(c.id)}
                />
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button type="dashed" icon={<PlusOutlined />} onClick={addCond} size="small">
              添加条件
            </Button>
            {conds.length > 1 && (
              <Select
                value={logic}
                onChange={setLogic}
                style={{ width: 160 }}
                size="small"
                options={[
                  { value: 'AND', label: 'AND（全部满足)' },
                  { value: 'OR', label: 'OR（满足其一)' },
                ]}
              />
            )}
          </div>
        </>
      )}

      {eventName && conds.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <Button type="primary" size="small" onClick={handleApply}>
            应用筛选
          </Button>
        </div>
      )}
    </div>
  )
}
