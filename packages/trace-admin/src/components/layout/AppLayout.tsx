// AppLayout — B/C 端全局布局（基于 antd Layout）
// variant 驱动：侧边栏宽度 / Header 高度 / 内容区 padding / 面包屑 / 水印 / 页脚

import React, { useState, useMemo } from 'react'
import {
  Layout,
  Menu,
  Breadcrumb,
  Avatar,
  Dropdown,
  Badge,
  Switch,
  Space,
  Typography,
} from 'antd'
type MenuClickHandler = (info: { key: string; keyPath: string[]; domEvent: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement> }) => void
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet, Link } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { cn, cnVar } from '@/utils/cn'
import type { Variant } from '@/tokens'

const { Header, Sider, Content, Footer } = Layout
const { Text } = Typography

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export interface MenuItem {
  key: string
  label: string
  icon?: React.ReactNode
  children?: MenuItem[]
}

export interface AppLayoutProps {
  /** 模块变体 */
  variant?: Variant
  /** 平台名称 */
  title?: string
  /** 菜单数据 */
  menuItems: MenuItem[]
  /** 通知数量 */
  notificationCount?: number
}

// ═══════════════════════════════════════════════════════════════
// B / C 端布局预设常量
// ═══════════════════════════════════════════════════════════════

const LAYOUT_PRESETS = {
  b: {
    navTheme: 'dark' as const,
    siderWidth: 256,
    collapsedWidth: 64,
    headerHeight: 56,
    contentPadding: 24,
    showBreadcrumb: true,
    showWatermark: true,
    showFooter: true,
    headerSpaceSize: 16,
  },
  c: {
    navTheme: 'light' as const,
    siderWidth: 240,
    collapsedWidth: 64,
    headerHeight: 64,
    contentPadding: 32,
    showBreadcrumb: false,
    showWatermark: false,
    showFooter: false,
    headerSpaceSize: 20,
  },
} as const

// ═══════════════════════════════════════════════════════════════
// 面包屑路径 → 中文名映射
// ═══════════════════════════════════════════════════════════════

const BREADCRUMB_MAP: Record<string, string> = {
  '': '首页',
  dashboard: '数据看板',
  'event-management': '事件管理',
  events: '事件列表',
  create: '新建事件',
  edit: '编辑事件',
  settings: '设置',
  account: '账号设置',
  profile: '个人中心',
  users: '用户管理',
}

// ═══════════════════════════════════════════════════════════════
// AppLayout 组件主体
// ═══════════════════════════════════════════════════════════════

export const AppLayout: React.FC<AppLayoutProps> = ({
  variant = 'b',
  title = 'TraceGA',
  menuItems,
  notificationCount = 0,
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar, userInfo, setUserInfo } =
    useAppStore()
  const [darkMode, setDarkMode] = useState(false)

  const preset = LAYOUT_PRESETS[variant]
  const isB = variant === 'b'

  // ── 选中菜单项（根据当前路径） ─────────────────────────────
  const selectedKeys = useMemo(
    () => [location.pathname === '/' ? '/' : `/${location.pathname.split('/')[1]}`],
    [location.pathname],
  )

  // ── 面包屑路径 ─────────────────────────────────────────────
  const breadcrumbItems = useMemo(() => {
    if (!preset.showBreadcrumb) return []
    const parts = location.pathname.split('/').filter(Boolean)
    const items: { title: React.ReactNode }[] = [
      { title: <Link to="/">{BREADCRUMB_MAP['']}</Link> },
    ]
    let cumPath = ''
    for (const part of parts) {
      cumPath += `/${part}`
      const label = BREADCRUMB_MAP[part] ?? part
      const isLast = cumPath === location.pathname
      items.push({
        title: isLast ? label : <Link to={cumPath}>{label}</Link>,
      })
    }
    return items
  }, [location.pathname, preset.showBreadcrumb])

  // ── 用户下拉菜单 ──────────────────────────────────────────
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '账号设置',
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ]

  const onUserMenuClick: MenuClickHandler = ({ key }) => {
    switch (key) {
      case 'profile':
        navigate('/profile')
        break
      case 'settings':
        navigate('/settings/account')
        break
      case 'logout':
        setUserInfo(null)
        localStorage.removeItem('token')
        navigate('/login')
        break
    }
  }

  // ── 菜单点击 ──────────────────────────────────────────────
  const handleMenuClick: MenuClickHandler = ({ key }) => {
    navigate(key)
  }

  // ═══════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════
  return (
    <div
      data-theme={variant}
      className={cn('layout', cnVar(variant))}
      style={{ height: '100vh' }}
    >
      <Layout style={{ height: '100%' }}>
        {/* ════ 侧边栏 ═══════════════════════════════════════ */}
        <Sider
          trigger={null}
          collapsible
          collapsed={sidebarCollapsed}
          width={preset.siderWidth}
          collapsedWidth={preset.collapsedWidth}
          theme={darkMode ? 'dark' : preset.navTheme}
          style={{
            background:
              preset.navTheme === 'dark'
                ? '#001529'
                : darkMode
                  ? '#001529'
                  : '#fafbfc',
            borderRight:
              preset.navTheme === 'light'
                ? '1px solid var(--tk-color-border, #d9d9d9)'
                : undefined,
          }}
        >
          {/* Logo / 标题区 */}
          <div
            style={{
              height: preset.headerHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom:
                preset.navTheme === 'dark'
                  ? '1px solid rgba(255,255,255,0.1)'
                  : '1px solid var(--tk-color-border, #d9d9d9)',
              color:
                preset.navTheme === 'dark' ? '#fff' : 'var(--tk-color-text)',
              fontSize: sidebarCollapsed ? 14 : 18,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              transition: 'all 0.2s',
            }}
          >
            {sidebarCollapsed ? title.slice(0, 2) : title}
          </div>

          {/* 菜单 */}
          <Menu
            mode="inline"
            theme={darkMode ? 'dark' : preset.navTheme}
            selectedKeys={selectedKeys}
            items={menuItems as MenuItem[]}
            onClick={handleMenuClick}
            style={{ borderRight: 0 }}
          />

          {/* 菜单底部 — 帮助文档（仅 B 端） */}
          {isB && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                width: '100%',
                padding: '8px 16px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <a
                href="/help"
                style={{
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <QuestionCircleOutlined /> 帮助文档
              </a>
            </div>
          )}
        </Sider>

        {/* ════ 右侧主区域 ═══════════════════════════════════ */}
        <Layout>
          {/* Header */}
          <Header
            style={{
              height: preset.headerHeight,
              padding: `0 ${preset.contentPadding}px`,
              background: darkMode ? '#001529' : '#fff',
              borderBottom: darkMode
                ? '1px solid rgba(255,255,255,0.1)'
                : '1px solid var(--tk-color-border, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              lineHeight: `${preset.headerHeight}px`,
            }}
          >
            {/* 左侧：折叠按钮 */}
            <Space>
              <button
                onClick={toggleSidebar}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {sidebarCollapsed ? (
                  <MenuUnfoldOutlined
                    style={{ fontSize: 18, color: darkMode ? '#fff' : '#64748b' }}
                  />
                ) : (
                  <MenuFoldOutlined
                    style={{ fontSize: 18, color: darkMode ? '#fff' : '#64748b' }}
                  />
                )}
              </button>
            </Space>

            {/* 右侧：通知 / 帮助 / 暗色模式 / 用户 */}
            <Space size={preset.headerSpaceSize}>
              {/* 通知 */}
              <Badge count={notificationCount} size="small" offset={[-2, 2]}>
                <BellOutlined
                  style={{
                    fontSize: isB ? 16 : 18,
                    cursor: 'pointer',
                    color: darkMode ? 'rgba(255,255,255,0.65)' : '#64748b',
                  }}
                />
              </Badge>

              {/* 帮助（仅 B 端） */}
              {isB && (
                <QuestionCircleOutlined
                  style={{
                    fontSize: 16,
                    cursor: 'pointer',
                    color: darkMode ? 'rgba(255,255,255,0.65)' : '#64748b',
                  }}
                  onClick={() => window.open('/help')}
                />
              )}

              {/* 暗色模式 */}
              <Switch
                checkedChildren={<MoonOutlined />}
                unCheckedChildren={<SunOutlined />}
                checked={darkMode}
                onChange={setDarkMode}
              />

              {/* 用户下拉菜单 */}
              <Dropdown
                menu={{ items: userMenuItems, onClick: onUserMenuClick }}
              >
                <Space
                  style={{
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 6,
                    transition: 'background 0.2s',
                  }}
                >
                  <Avatar
                    size={isB ? 'small' : 'default'}
                    icon={<UserOutlined />}
                    src={userInfo?.avatar}
                    style={{ backgroundColor: darkMode ? '#1677ff' : undefined }}
                  />
                  <Text
                    style={{
                      fontSize: isB ? 13 : 14,
                      color: darkMode ? 'rgba(255,255,255,0.85)' : '#475569',
                    }}
                  >
                    {userInfo?.name ?? '用户'}
                  </Text>
                </Space>
              </Dropdown>
            </Space>
          </Header>

          {/* 面包屑（仅 B 端） */}
          {breadcrumbItems.length > 0 && (
            <div
              style={{
                padding: `12px ${preset.contentPadding}px 0`,
                background: darkMode ? '#001529' : '#fff',
              }}
            >
              <Breadcrumb items={breadcrumbItems} />
            </div>
          )}

          {/* 内容区 */}
          <Content
            style={{
              margin: preset.contentPadding,
              padding: preset.contentPadding,
              background: darkMode
                ? '#141414'
                : 'var(--tk-color-bg-layout, #f1f5f9)',
              borderRadius: 'var(--tk-radius-lg, 8px)',
              overflow: 'auto',
              flex: 1,
            }}
          >
            {/* B 端水印（通过 CSS overlay 实现） */}
            {preset.showWatermark && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  pointerEvents: 'none',
                  zIndex: 9999,
                  opacity: 0.06,
                  fontSize: 14,
                  color: '#000',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignContent: 'flex-start',
                  transform: 'rotate(-20deg) translate(-10%, -10%)',
                  userSelect: 'none',
                }}
              >
                {Array.from({ length: 40 }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      margin: '120px 80px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {userInfo?.name ?? '用户'}
                  </span>
                ))}
              </div>
            )}

            <Outlet />
          </Content>

          {/* 页脚（仅 B 端） */}
          {preset.showFooter && (
            <Footer
              style={{
                textAlign: 'center',
                color: 'var(--tk-color-text-tertiary, rgba(0,0,0,0.45))',
                fontSize: 12,
                padding: '12px 0',
                background: darkMode ? '#141414' : '#fff',
              }}
            >
              {title} ©{new Date().getFullYear()} 版权所有
            </Footer>
          )}
        </Layout>
      </Layout>
    </div>
  )
}
