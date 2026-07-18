// Drawer — 二次封装（基于 antd Drawer）
// maskClosable=false / destroyOnClose=true / B 端 520px / C 端 640px

import React from 'react'
import { Drawer as AntDrawer } from 'antd'
import { cn, cnVar } from '@/utils/cn'
import type { Variant } from '@/tokens'

//  类型 

export interface AppDrawerProps
  extends Omit<
    React.ComponentProps<typeof AntDrawer>,
    'variant' | 'maskClosable' | 'destroyOnClose'
  > {
  variant?: Variant
}

//  组件 

export const Drawer: React.FC<AppDrawerProps> = ({
  variant = 'b',
  maskClosable = false,
  destroyOnClose = true,
  width = variant === 'b' ? 520 : 640,
  className,
  ...rest
}) => {
  return (
    <AntDrawer
      maskClosable={maskClosable}
      destroyOnClose={destroyOnClose}
      width={width}
      className={cn('drawer', cnVar(variant), className)}
      {...rest}
    />
  )
}
