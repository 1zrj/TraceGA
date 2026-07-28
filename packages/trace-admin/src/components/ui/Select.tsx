// Select — 二次封装（基于 antd Select）
// 搜索/清除/多选折叠默认开启

import React from 'react'
import { Select as AntSelect } from 'antd'
import { cn, cnVar } from '@/utils/cn'
import type { Variant } from '@/tokens'

// 类型

export interface AppSelectProps extends Omit<
  React.ComponentProps<typeof AntSelect>,
  'variant' | 'showSearch' | 'allowClear'
> {
  variant?: Variant
}

//  组件

export const Select: React.FC<AppSelectProps> = ({
  variant = 'b',
  showSearch = true,
  allowClear = true,
  maxTagCount = 'responsive',
  optionFilterProp = 'label',
  placeholder,
  className,
  ...rest
}) => {
  return (
    <AntSelect
      showSearch={showSearch}
      allowClear={allowClear}
      maxTagCount={maxTagCount}
      optionFilterProp={optionFilterProp}
      placeholder={placeholder ?? '请选择'}
      className={cn('select', cnVar(variant), className)}
      {...rest}
    />
  )
}
