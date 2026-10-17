import type { ReactNode } from 'react'
import { Button, Avatar, Dropdown, Layout, Menu, Typography } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import BrandMark from './BrandMark'

const { Header, Sider, Content } = Layout

// 医护 Web 布局（UI_DESIGN §5）：顶栏 56px + 左侧导航 232px + 内容区 28px 留白
export default function WebLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  // 按角色区分菜单（PRD：管理员不继承患者临床数据访问权）
  const isAdmin = user?.role === 'ADMIN'
  const items = isAdmin
    ? [{ key: '/admin', label: '内容与账号管理' }]
    : [
        { key: '/workbench', label: '工作台' },
        { key: '/patients', label: '患者管理' },
        { key: '/stats', label: '统计与核查' },
        { key: '/followups', label: '随访中心' },
      ]

  // 子页面（如 /patients/:id）高亮所属菜单项
  const selectedKey =
    items.find((i) => location.pathname === i.key || location.pathname.startsWith(`${i.key}/`))?.key ?? location.pathname

  return (
    <Layout style={{ minHeight: '100vh', width: '100%' }}>
      <Header
        style={{
          height: 56,
          lineHeight: '56px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--line)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <BrandMark size={22} />
          <Typography.Text strong style={{ fontSize: 15, color: 'var(--ink)' }}>
            吸入治疗指导与依从性辅助管理软件
          </Typography.Text>
        </span>
        <Dropdown
          menu={{
            items: [
              { key: 'logout', label: '退出登录', onClick: async () => { await logout(); navigate('/login') } },
            ],
          }}
        >
          <Button type="text" style={{ height: 40, padding: '0 8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Avatar size={28} style={{ background: 'var(--brand-soft)', color: 'var(--brand-ink)', fontWeight: 600 }}>
                {(user?.account || '?').slice(0, 1).toUpperCase()}
              </Avatar>
              <span style={{ color: 'var(--ink-2)' }}>{user?.account}</span>
            </span>
          </Button>
        </Dropdown>
      </Header>

      <Layout style={{ width: '100%' }}>
        {/* 只有一个菜单项时（管理员）不占用侧栏宽度 */}
        {items.length > 1 && (
          <Sider width={232} theme="light" style={{ borderRight: '1px solid var(--line)' }}>
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              items={items}
              onClick={({ key }) => navigate(key)}
              style={{ borderInlineEnd: 'none', paddingTop: 12 }}
            />
          </Sider>
        )}
        <Content style={{ background: 'var(--bg)', padding: 28, flex: 1, minWidth: 0 }}>
          <div style={{ width: '100%' }}>{children}</div>
        </Content>
      </Layout>
    </Layout>
  )
}
