import React from 'react'
import { Card, Descriptions, Avatar, Button, Space, Typography } from 'antd'
import { UserOutlined, LogoutOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store'

const { Title } = Typography

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const userInfo = useAppStore((s) => s.userInfo)
  const logout = useAppStore((s) => s.logout)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* 标题区域 */}
      <Space style={{ marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
        <Title level={4} style={{ margin: 0 }}>
          个人中心
        </Title>
      </Space>

      {/* 用户头像与基本信息 */}
      <Card style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <Avatar
            size={80}
            icon={<UserOutlined />}
            src={userInfo?.avatar}
            style={{ backgroundColor: '#1677ff', flexShrink: 0 }}
          />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {userInfo?.name || '用户'}
            </Title>
            <Typography.Text type="secondary">{userInfo?.username || '-'}</Typography.Text>
          </div>
        </div>
      </Card>

      {/* 详细信息 */}
      <Card title="账号信息" style={{ marginBottom: 24 }}>
        <Descriptions column={1} labelStyle={{ width: 120 }}>
          <Descriptions.Item label="用户名">{userInfo?.username || '-'}</Descriptions.Item>
          <Descriptions.Item label="显示名称">{userInfo?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{userInfo?.email || '未设置'}</Descriptions.Item>
          <Descriptions.Item label="角色">Admin</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 退出登录 */}
      <Card>
        <Button danger icon={<LogoutOutlined />} onClick={handleLogout} block>
          退出登录
        </Button>
      </Card>
    </div>
  )
}
