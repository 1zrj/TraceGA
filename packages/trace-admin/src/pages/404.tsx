// 404 页面不存在

import React from 'react'
import { Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export const NotFoundPage: React.FC = () => {
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
        status="404"
        title="404"
        subTitle="页面不存在"
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            返回首页
          </Button>
        }
      />
    </div>
  )
}
