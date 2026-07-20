// ConfirmButton — 带确认弹窗的按钮
// 点击自动弹出 Modal.confirm，确认后执行 onConfirm（支持 async）
// antd v5 Modal.confirm 的 onOk 返回 Promise 会自动管理按钮 loading

import React, { useCallback, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { AppButtonProps } from '@/components/ui/Button'

// ─── 类型 ──────────────────────────────────────────────────────

export interface ConfirmButtonProps extends Omit<AppButtonProps, 'onClick'> {
  /** 弹窗标题 */
  confirmTitle?: string
  /** 弹窗内容（支持 ReactNode） */
  confirmContent?: React.ReactNode
  /** 确认按钮文案 */
  okText?: string
  /** 取消按钮文案 */
  cancelText?: string
  /** 确认回调，支持 async（antd 自动管理 loading，无需手动 setState） */
  onConfirm?: () => void | Promise<void>
  /** 是否为危险操作（okButton 红色） */
  danger?: boolean
  /** 点击按钮时的额外逻辑（在弹窗前执行） */
  onClick?: () => void
}

// ─── 组件 ──────────────────────────────────────────────────────

export const ConfirmButton: React.FC<ConfirmButtonProps> = ({
  confirmTitle = '确认操作',
  confirmContent = '确定要执行此操作吗？',
  okText = '确认',
  cancelText = '取消',
  onConfirm,
  danger = false,
  onClick,
  children,
  ...buttonProps
}) => {
  const modalOpenRef = useRef(false)

  const handleClick = useCallback(() => {
    // 防止连点打开多个 Modal
    if (modalOpenRef.current) return
    modalOpenRef.current = true

    onClick?.()

    Modal.confirm({
      title: confirmTitle,
      content: confirmContent,
      okText,
      cancelText,
      okButtonProps: { danger },
      // antd v5: onOk 返回 Promise 时自动在确认按钮上显示 loading
      onOk: async () => {
        try {
          if (onConfirm) {
            await onConfirm()
          }
        } finally {
          modalOpenRef.current = false
        }
      },
      onCancel: () => {
        modalOpenRef.current = false
      },
    })
  }, [confirmTitle, confirmContent, okText, cancelText, danger, confirmLoading, onConfirm, onClick])

  return (
    <Button danger={danger} onClick={handleClick} {...buttonProps}>
      {children}
    </Button>
  )
}
