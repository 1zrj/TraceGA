// ThemeProvider — 全局主题提供者
// 组合 VariantProvider + antd ConfigProvider + data-theme 注入

import React, { useEffect } from 'react'
import { ConfigProvider } from 'antd'
import { VariantProvider } from '@/hooks/useVariant'
import { variants } from '@/tokens'
import type { Variant } from '@/tokens'

interface ThemeProviderProps {
  variant: Variant
  children: React.ReactNode
}

/** 将 variants Token 映射为 antd ConfigProvider theme.token */
function antdThemeToken(variant: Variant) {
  const v = variants[variant]
  return {
    colorPrimary: '#1677ff',
    borderRadius: parseInt(v.borderRadius),
    controlHeight: parseInt(v.controlHeight),
    fontSize: parseInt(v.fontSize),
  }
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ variant, children }) => {
  // 注入 data-theme 到 document 根元素，触发 b-theme.css / c-theme.css 切换
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', variant)
    return () => {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [variant])

  return (
    <VariantProvider variant={variant}>
      <ConfigProvider theme={{ token: antdThemeToken(variant) }}>{children}</ConfigProvider>
    </VariantProvider>
  )
}
