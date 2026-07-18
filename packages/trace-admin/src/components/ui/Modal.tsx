// Modal — 二次封装（基于 antd Modal）
// maskClosable=false / destroyOnClose=true / C 端居中

import React from 'react'
import { Modal as AntModal } from 'antd'
import { cn, cnVar } from '@/utils/cn'
import type { Variant } from '@/tokens'

//  类型 

export interface AppModalProps
  extends Omit<
    React.ComponentProps<typeof AntModal>,
    'variant' | 'maskClosable' | 'destroyOnClose'
  > {
  variant?: Variant
}

// Modal 组件 

function ModalFn({
  variant = 'b',
  maskClosable = false,
  destroyOnClose = true,
  centered = variant === 'c',
  className,
  ...rest
}: AppModalProps) {
  return (
    <AntModal
      maskClosable={maskClosable}
      destroyOnClose={destroyOnClose}
      centered={centered}
      className={cn('modal', cnVar(variant), className)}
      {...rest}
    />
  )
}

// ─── 挂载静态方法并导出 ────────────────────────────────────────

type ModalType = React.FC<AppModalProps> & {
  confirm: typeof AntModal.confirm
  info: typeof AntModal.info
  success: typeof AntModal.success
  error: typeof AntModal.error
  warning: typeof AntModal.warning
  useModal: typeof AntModal.useModal
  destroyAll: typeof AntModal.destroyAll
}

export const Modal = ModalFn as ModalType

Modal.confirm = AntModal.confirm
Modal.info = AntModal.info
Modal.success = AntModal.success
Modal.error = AntModal.error
Modal.warning = AntModal.warning
Modal.useModal = AntModal.useModal
Modal.destroyAll = AntModal.destroyAll
