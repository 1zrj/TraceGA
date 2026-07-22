import React, { useState } from 'react'
import { Form, Input, Button, Card, Typography, message, Space } from 'antd'
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store'
import type { LoginDto } from '@/types'

const { Title, Text } = Typography

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAppStore((s) => s.login)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)

  // 如果已登录，直接跳回首页
  React.useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: string })?.from || '/'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location.state])

  const onFinish = async (values: LoginDto) => {
    setLoading(true)
    try {
      await login(values)
      message.success('登录成功')
      const from = (location.state as { from?: string })?.from || '/'
      navigate(from, { replace: true })
    } catch (err: any) {
      message.error(err?.message || '登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          borderRadius: 12,
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 标题 */}
          <div style={{ textAlign: 'center' }}>
            <Title level={3} style={{ marginBottom: 4 }}>
              TraceGA
            </Title>
            <Text type="secondary">行为数据分析管理平台</Text>
          </div>

          {/* 登录表单 */}
          <Form<LoginDto>
            name="login"
            onFinish={onFinish}
            layout="vertical"
            size="large"
            initialValues={{ username: 'admin', password: 'admin' }}
          >
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>

            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                iconRender={(visible: boolean) =>
                  visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                }
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                登 录
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  )
}
