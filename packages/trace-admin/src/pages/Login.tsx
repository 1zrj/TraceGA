// 登录页面

import React, { useState } from 'react'
import { Form, Card, Typography, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/auth/AuthContext'

const { Title, Text } = Typography

interface LocationState {
  from?: string
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(false)

  const from =
    (location.state as LocationState)?.from ?? '/dashboard'

  // 已登录直接重定向
  if (isAuthenticated) {
    navigate(from, { replace: true })
    return null
  }

  const handleFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      // 模拟登录：生成 mock token 并写入 localStorage
      const mockToken = btoa(
        JSON.stringify({
          user: values.username,
          roles: ['admin'],
          exp: Date.now() + 24 * 60 * 60 * 1000,
        }),
      )
      localStorage.setItem('token', mockToken)
      await login(mockToken)
      message.success('登录成功')
      navigate(from, { replace: true })
    } catch {
      message.error('登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

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
      <Card style={{ width: 400, boxShadow: 'var(--tk-shadow-md)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ marginBottom: 4 }}>
            TraceGA
          </Title>
          <Text type="secondary">埋点数据平台</Text>
        </div>

        <Form
          layout="vertical"
          onFinish={handleFinish}
          autoComplete="off"
          initialValues={{ username: 'admin', password: 'admin123' }}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
