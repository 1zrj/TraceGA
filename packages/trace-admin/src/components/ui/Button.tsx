// Button — 二次封装（基于 antd Button）
// variant 驱动 B/C 端尺寸与圆角

import React from 'react'
import { Button as AntButton } from 'antd'
import { cn, cnVar } from '@/utils/cn'
import type { Variant } from '@/tokens'

// 类型 

export interface AppButtonProps
  extends Omit<
    React.ComponentProps<typeof AntButton>,
    'variant' | 'danger' | 'size'
  > {
  /** 模块变体：B 端紧凑 / C 端宽松，自动决定 size 默认值 */
  variant?: Variant
  /** 危险操作（红色样式） */
  danger?: boolean
  /** 尺寸：variant 自动决定默认值，可手动覆盖 */
  size?: 'small' | 'middle' | 'large'
}

//组件 

export const Button: React.FC<AppButtonProps> = ({
  variant = 'b',
  size,
  danger = false,
  className,
  ...rest
}) => {
  const resolvedSize = size ?? (variant === 'b' ? 'middle' : 'large')

  return (
    <AntButton
      size={resolvedSize}
      danger={danger}
      className={cn('button', cnVar(variant), className)}
      {...rest}
    />
  )
}
