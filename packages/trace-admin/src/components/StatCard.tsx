// StatCard — 统计卡片（Token 化 + variant + loading 骨架屏）

import React from 'react'
import { Skeleton } from 'antd'
import { cn, cnVar } from '@/utils/cn'
import type { Variant } from '@/tokens'

// ─── 类型 ──────────────────────────────────────────────────────

export interface StatCardProps {
  title: string
  value: string | number
  change?: string
  /** positive = 绿涨, negative = 红跌 */
  changeType?: 'positive' | 'negative'
  /** 模块变体 */
  variant?: Variant
  /** 加载态 — 显示骨架屏 */
  loading?: boolean
}

// ─── 组件 ──────────────────────────────────────────────────────

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeType = 'positive',
  variant = 'b',
  loading = false,
}) => {
  return (
    <div
      className={cn('stat-card', cnVar(variant))}
      style={{
        background: 'var(--tk-color-bg-container, #fff)',
        padding: variant === 'b' ? 20 : 28,
        borderRadius: variant === 'b' ? 'var(--tk-radius-md, 6px)' : 'var(--tk-radius-xl, 12px)',
        boxShadow: 'var(--tk-shadow-sm)',
      }}
    >
      {loading ? (
        <>
          <Skeleton.Input
            active
            size="large"
            style={{ width: '60%', height: 38, marginBottom: 4 }}
          />
          <Skeleton.Input active size="small" style={{ width: '40%', marginBottom: 8 }} />
          {change && <Skeleton.Input active size="small" style={{ width: '30%' }} />}
        </>
      ) : (
        <>
          <div
            style={{
              fontSize:
                variant === 'b' ? 'var(--tk-font-size-4xl, 38px)' : 'var(--tk-font-size-3xl, 30px)',
              fontWeight: 'var(--tk-font-weight-bold, 700)',
              lineHeight: 'var(--tk-line-height-tight, 1.2)',
              color: 'var(--tk-color-text, #1e293b)',
              marginBottom: 4,
            }}
          >
            {value}
          </div>
          <div
            style={{
              fontSize: 'var(--tk-font-size-base, 14px)',
              color: 'var(--tk-color-text-secondary, #64748b)',
              marginBottom: change ? 8 : 0,
            }}
          >
            {title}
          </div>
          {change && (
            <div
              style={{
                fontSize: 'var(--tk-font-size-xs, 12px)',
                fontWeight: 500,
                color:
                  changeType === 'positive'
                    ? 'var(--tk-color-success, #10b981)'
                    : 'var(--tk-color-error, #ef4444)',
              }}
            >
              {change}
            </div>
          )}
        </>
      )}
    </div>
  )
}
