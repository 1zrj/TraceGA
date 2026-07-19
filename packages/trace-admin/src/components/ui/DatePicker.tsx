// DatePicker / RangePicker — 二次封装（基于 antd DatePicker）
// 固定格式 / 快捷预设 / B 端支持时分秒

import React from 'react'
import { DatePicker as AntDatePicker } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { cn, cnVar } from '@/utils/cn'
import type { Variant } from '@/tokens'

// ─── 共享快捷日期预设（运行时计算，避免 import-time 固定日期） ──

export function getSharedPresets(): {
  label: string
  value: [Dayjs, Dayjs]
}[] {
  const now = dayjs()
  return [
    { label: '今日', value: [now.startOf('day'), now.endOf('day')] },
    { label: '本周', value: [now.startOf('week'), now.endOf('week')] },
    { label: '本月', value: [now.startOf('month'), now.endOf('month')] },
    { label: '近 7 天', value: [now.subtract(7, 'day'), now] },
    { label: '近 30 天', value: [now.subtract(30, 'day'), now] },
  ]
}

/** 静态预设引用（import time 固定）。推荐在组件中使用 getSharedPresets() 以获取实时日期。 */
export const SHARED_PRESETS = getSharedPresets()

// 类型 

type AntDatePickerType = typeof AntDatePicker
type AntRangePickerType = typeof AntDatePicker.RangePicker

export interface AppDatePickerProps
  extends Omit<
    React.ComponentProps<AntDatePickerType>,
    'variant' | 'format'
  > {
  variant?: Variant
}

export interface AppRangePickerProps
  extends Omit<
    React.ComponentProps<AntRangePickerType>,
    'variant' | 'format'
  > {
  variant?: Variant
  presets?: ReturnType<typeof getSharedPresets>
}

//  DatePicker 
export const DatePicker: React.FC<AppDatePickerProps> = ({
  variant = 'b',
  format = 'YYYY-MM-DD',
  placeholder,
  className,
  ...rest
}) => {
  return (
    <AntDatePicker
      format={format}
      placeholder={placeholder ?? '选择日期'}
      className={cn('datepicker', cnVar(variant), className)}
      {...rest}
    />
  )
}

//  RangePicker

export const RangePicker: React.FC<AppRangePickerProps> = ({
  variant = 'b',
  format = 'YYYY-MM-DD',
  presets,
  placeholder,
  className,
  ...rest
}) => {
  const resolvedPresets = presets ?? getSharedPresets()
  return (
    <AntDatePicker.RangePicker
      format={format}
      presets={resolvedPresets}
      placeholder={placeholder ?? ['开始日期', '结束日期']}
      className={cn('datepicker', cnVar(variant), className)}
      {...rest}
    />
  )
}
