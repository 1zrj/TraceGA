// useFormValidation — 表单校验 hook
// 支持失焦单字段校验 + 提交全量校验


import { useState, useCallback, useRef } from 'react'

// 类型定义

export type ValidationType = 'error' | 'warning'

export interface FieldError {
  message: string
  type: ValidationType
}

export interface ValidationRule {
  /** 必填校验 */
  required?: boolean
  /** 必填时的自定义提示 */
  requiredMessage?: string
  /** 最大长度 */
  maxLength?: number
  maxLengthMessage?: string
  /** 最小长度 */
  minLength?: number
  minLengthMessage?: string
  /** 正则校验 */
  pattern?: RegExp
  patternMessage?: string
  /** 自定义校验函数，返回 string 表示错误，返回 null 表示通过 */
  custom?: (value: unknown, allValues: Record<string, unknown>) => string | null
}

export type ValidationRules<T extends Record<string, unknown>> = {
  [K in keyof T]?: ValidationRule
}

export type FormErrors<T extends Record<string, unknown>> = {
  [K in keyof T]?: FieldError
}

// 校验逻辑 

/** 校验单个字段，返回 FieldError | null */
function validateOne(
  value: unknown,
  rule: ValidationRule,
  allValues: Record<string, unknown>,
): FieldError | null {
  const strValue = typeof value === 'string' ? value : String(value ?? '')

  // 1. 必填校验
  if (rule.required) {
    if (value === undefined || value === null || strValue.trim() === '') {
      return {
        message: rule.requiredMessage ?? '此项为必填',
        type: 'error',
      }
    }
  }

  // 空值不做后续校验（允许非必填字段为空）
  if (strValue === '' && !rule.required) {
    return null
  }

  // 2. 最小长度
  if (rule.minLength !== undefined && strValue.length < rule.minLength) {
    return {
      message:
        rule.minLengthMessage ??
        `最少输入 ${rule.minLength} 个字符`,
      type: 'error',
    }
  }

  // 3. 最大长度
  if (rule.maxLength !== undefined && strValue.length > rule.maxLength) {
    return {
      message:
        rule.maxLengthMessage ??
        `最多输入 ${rule.maxLength} 个字符`,
      type: 'error',
    }
  }

  // 4. 正则校验
  if (rule.pattern && !rule.pattern.test(strValue)) {
    return {
      message: rule.patternMessage ?? '格式不正确',
      type: 'error',
    }
  }

  // 5. 自定义校验
  if (rule.custom) {
    const customResult = rule.custom(value, allValues)
    if (typeof customResult === 'string') {
      return {
        message: customResult,
        type: 'error',
      }
    }
  }

  return null
}

//  Hook 

export function useFormValidation<T extends Record<string, unknown>>(
  rules: ValidationRules<T>,
) {
  const [errors, setErrors] = useState<FormErrors<T>>({})
  // 追踪哪些字段已被"触摸"过（失焦过），用于控制错误展示时机
  const touchedRef = useRef<Set<string>>(new Set())

  /** 校验单个字段（失焦时调用） */
  const validateField = useCallback(
    (field: keyof T, value: unknown, allValues?: Record<string, unknown>) => {
      const rule = rules[field]
      if (!rule) return null

      touchedRef.current.add(field as string)

      const error = validateOne(value, rule, allValues ?? ({} as Record<string, unknown>))
      setErrors((prev) => {
        const next = { ...prev }
        if (error) {
          ;(next as Record<string, FieldError>)[field as string] = error
        } else {
          delete (next as Record<string, FieldError | undefined>)[field as string]
        }
        return next
      })
      return error
    },
    [rules],
  )

  /** 全量校验（提交时调用），返回是否通过 */
  const validate = useCallback(
    (values: T): boolean => {
      const newErrors: Record<string, FieldError> = {}
      let hasError = false

      for (const key of Object.keys(rules) as (keyof T)[]) {
        const rule = rules[key]
        if (!rule) continue

        touchedRef.current.add(key as string)

        const error = validateOne(
          values[key],
          rule,
          values as Record<string, unknown>,
        )
        if (error) {
          newErrors[key as string] = error
          hasError = true
        }
      }

      setErrors(newErrors as FormErrors<T>)
      return !hasError
    },
    [rules],
  )

  /** 清除所有错误 */
  const clearErrors = useCallback(() => {
    setErrors({})
    touchedRef.current.clear()
  }, [])

  /** 清除指定字段的错误和触摸状态 */
  const clearFieldError = useCallback((field: keyof T) => {
    touchedRef.current.delete(field as string)
    setErrors((prev) => {
      const next = { ...prev }
      delete (next as Record<string, FieldError | undefined>)[field as string]
      return next
    })
  }, [])

  return {
    errors,
    validate,
    validateField,
    clearErrors,
    clearFieldError,
    /** 字段是否已被触摸过 */
    isTouched: (field: keyof T) => touchedRef.current.has(field as string),
  }
}
