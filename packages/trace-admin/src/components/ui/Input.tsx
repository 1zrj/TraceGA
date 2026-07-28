// Input / TextArea / Search / Password — 二次封装（基于 antd Input）
// 固定 allowClear / showCount 等默认行为

import React from 'react'
import { Input as AntInput } from 'antd'
import { cn, cnVar } from '@/utils/cn'
import type { Variant } from '@/tokens'

//类型

type AntInputType = typeof AntInput

export interface AppInputProps extends Omit<
  React.ComponentProps<AntInputType>,
  'variant' | 'allowClear'
> {
  variant?: Variant
}

// Input

function InputFn({
  variant = 'b',
  allowClear = true,
  placeholder,
  className,
  ...rest
}: AppInputProps) {
  return (
    <AntInput
      allowClear={allowClear}
      placeholder={placeholder ?? '请输入'}
      className={cn('input', cnVar(variant), className)}
      {...rest}
    />
  )
}

// TextArea

type TextAreaType = typeof AntInput.TextArea

function TextAreaFn({
  variant = 'b',
  allowClear = true,
  rows = 4,
  showCount,
  placeholder,
  className,
  ...rest
}: Omit<React.ComponentProps<TextAreaType>, 'variant' | 'allowClear'> & {
  variant?: Variant
}) {
  return (
    <AntInput.TextArea
      allowClear={allowClear}
      rows={rows}
      showCount={showCount}
      placeholder={placeholder ?? '请输入'}
      className={cn('input', cnVar(variant), className)}
      {...rest}
    />
  )
}

//  Search
type SearchType = typeof AntInput.Search

function SearchFn({
  variant = 'b',
  allowClear = true,
  placeholder,
  className,
  ...rest
}: Omit<React.ComponentProps<SearchType>, 'variant' | 'allowClear'> & {
  variant?: Variant
}) {
  return (
    <AntInput.Search
      allowClear={allowClear}
      placeholder={placeholder ?? '请输入'}
      className={cn('input', cnVar(variant), className)}
      {...rest}
    />
  )
}

//  Password

type PasswordType = typeof AntInput.Password

function PasswordFn({
  variant = 'b',
  allowClear = true,
  placeholder,
  className,
  ...rest
}: Omit<React.ComponentProps<PasswordType>, 'variant' | 'allowClear'> & {
  variant?: Variant
}) {
  return (
    <AntInput.Password
      allowClear={allowClear}
      placeholder={placeholder ?? '请输入密码'}
      className={cn('input', cnVar(variant), className)}
      {...rest}
    />
  )
}

// 挂载子组件并导出
type InputComponent = React.FC<AppInputProps> & {
  TextArea: typeof TextAreaFn
  Search: typeof SearchFn
  Password: typeof PasswordFn
}

export const Input = InputFn as InputComponent
Input.TextArea = TextAreaFn
Input.Search = SearchFn
Input.Password = PasswordFn
