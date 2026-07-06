import React from 'react'
import { Layout, Menu } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAppStore } from '@/store'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/', label: '首页' },
  { key: '/event-management', label: '事件管理' },
  { key: '/dashboard', label: '数据看板' },
]

export const MainLayout: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar, userInfo } = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        style={{ background: '#1e293b' }}
      >
        <div
          style={{
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #334155',
            color: '#fff',
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          TraceGA
        </div>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 16px',
            background: '#fff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={toggleSidebar}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            {sidebarCollapsed ? (
              <MenuUnfoldOutlined style={{ fontSize: 20, color: '#64748b' }} />
            ) : (
              <MenuFoldOutlined style={{ fontSize: 20, color: '#64748b' }} />
            )}
          </button>
          <span style={{ fontSize: 14, color: '#475569' }}>{userInfo?.name}</span>
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
            background: '#f1f5f9',
            borderRadius: 8,
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

