// ErrorBoundary — 渲染错误边界
// 捕获子组件树渲染异常，显示友好错误页 + 重试按钮，避免白屏

import React from 'react'
import { Result } from 'antd'
import { Button } from '@/components/ui/Button'
import { ReloadOutlined, HomeOutlined } from '@ant-design/icons'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** 错误上报回调（可选，用于接入日志平台） */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] 渲染异常:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'var(--tk-color-bg-layout, #f5f5f5)',
          }}
        >
          <Result
            status="error"
            title="页面发生错误"
            subTitle={this.state.error?.message ?? '未知错误，请刷新后重试'}
            extra={
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <Button type="primary" icon={<ReloadOutlined />} onClick={this.handleRetry}>
                  重试
                </Button>
                <Button
                  icon={<HomeOutlined />}
                  onClick={() => {
                    window.location.href = '/dashboard'
                  }}
                >
                  返回首页
                </Button>
              </div>
            }
          />
        </div>
      )
    }

    return this.props.children
  }
}
