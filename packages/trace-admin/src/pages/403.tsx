// 403 无权限页面

import React from 'react'
import { Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate()

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
        status="403"
        title="403"
        subTitle="抱歉，您没有权限访问此页面"
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            返回首页
          </Button>
        }
      />
    </div>
  )
}
