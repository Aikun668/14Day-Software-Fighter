import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AutoComplete, Badge, Button, Avatar, Dropdown, Layout, Menu, Typography } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { apiFetch } from '../api/client'
import BrandMark from './BrandMark'
import { IconFollowups, IconPatients, IconStats, IconWorkbench } from './navIcons'

const { Header, Sider, Content } = Layout

interface PatientHit {
  id: string
  patient_code: string
  display_name: string
  diagnosis_label: string | null
}

// 医护 Web 布局（UI_DESIGN §5）：顶栏 56px + 左侧导航 232px + 内容区 28px 留白
export default function WebLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [openTasks, setOpenTasks] = useState(0)
  const [hits, setHits] = useState<PatientHit[]>([])
  const [keyword, setKeyword] = useState('')

  // 侧栏待办数角标：仅医护拉取 OPEN 任务数（管理员无此菜单）
  useEffect(() => {
    if (user?.role !== 'CLINICIAN') return
    let alive = true
    apiFetch<{ total: number }>('/api/tasks?status=OPEN&page_size=1')
      .then((r) => { if (alive) setOpenTasks(r.total) })
      .catch(() => {})
    return () => { alive = false }
  }, [user?.role, location.pathname])

  // 顶栏全局搜索：仅医护可用（按编号/姓名过滤，本地过滤已加载列表）
  const [roster, setRoster] = useState<PatientHit[]>([])
  useEffect(() => {
    if (user?.role !== 'CLINICIAN') return
    let alive = true
    apiFetch<{ items: PatientHit[] }>('/api/patients?page_size=100')
      .then((r) => { if (alive) setRoster(r.items) })
      .catch(() => {})
    return () => { alive = false }
  }, [user?.role])

  useEffect(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) { setHits([]); return }
    setHits(roster.filter(
      (p) => p.patient_code.toLowerCase().includes(kw) || (p.display_name || '').toLowerCase().includes(kw),
    ).slice(0, 8))
  }, [keyword, roster])

  const searchOptions = useMemo(
    () => hits.map((p) => ({
      value: p.id,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: 'var(--ink)' }}>{p.display_name}</span>
          <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            {p.patient_code}{p.diagnosis_label ? ` · ${p.diagnosis_label}` : ''}
          </span>
        </div>
      ),
    })),
    [hits],
  )

  // 按角色区分菜单（PRD：管理员不继承患者临床数据访问权）
  const isAdmin = user?.role === 'ADMIN'
  const items: { key: string; label: ReactNode; icon?: ReactNode }[] = isAdmin
    ? [{ key: '/admin', label: '内容与账号管理' }]
    : [
        {
          key: '/workbench',
          icon: <IconWorkbench />,
          label: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              工作台
              {openTasks > 0 && <Badge count={openTasks} size="small" title={`${openTasks} 条待核查任务`} />}
            </span>
          ),
        },
        { key: '/patients', label: '患者管理', icon: <IconPatients /> },
        { key: '/stats', label: '统计与核查', icon: <IconStats /> },
        { key: '/followups', label: '随访中心', icon: <IconFollowups /> },
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

        {/* 顶栏全局搜索（仅医护）：输入编号或姓名，选择后直达患者详情 */}
        {user?.role === 'CLINICIAN' && (
          <AutoComplete
            style={{ width: 320 }}
            value={keyword}
            options={searchOptions}
            onChange={setKeyword}
            onSelect={(pid: string) => {
              setKeyword('')
              navigate(`/patients/${pid}`)
            }}
            placeholder="搜索患者编号或姓名"
            aria-label="全局搜索患者"
            allowClear
          />
        )}

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
