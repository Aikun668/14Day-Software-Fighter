import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AutoComplete, Badge, Button, Avatar, Dropdown, Layout, Menu, Typography, type MenuProps } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { apiFetch } from '../api/client'
import BrandMark from './BrandMark'
import { IconFollowups, IconPatients, IconPlans, IconStats, IconWorkbench } from './navIcons'

const { Header, Sider, Content } = Layout

interface PatientHit {
  id: string
  patient_code: string
  display_name: string
  diagnosis_label: string | null
}

// 医护 Web 布局（UI_DESIGN §5）：顶栏 56px + 左侧导航 232px + 内容区 28px 留白
//
// variant 决定外壳观感，不再靠 URL 判断：
//   'standard' 传统布局（顶栏 56px、内容 padding 28px、页面撑到视口底）
//   'comfort'  Clinic Comfort 变体（顶栏 64px、面包屑侧栏品牌）。
//             外壳至少一屏高，侧栏才铺满视口；主栏里的卡仍按内容高。
// 新页面要上 Clinic Comfort，显式传 variant="comfort" 即可，不再加路径判断。
export default function WebLayout({
  children,
  variant = 'standard',
  crumb,
}: {
  children: ReactNode
  variant?: 'standard' | 'comfort'
  /** comfort 变体顶栏左侧的返回面包屑，如 ['患者', '详情'] */
  crumb?: { parent: string; parentTo: string; current: string }
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const isComfort = variant === 'comfort'
  const [isCompactViewport, setIsCompactViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches,
  )
  const [openTasks, setOpenTasks] = useState(0)
  const [hits, setHits] = useState<PatientHit[]>([])
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)')
    const syncViewport = () => setIsCompactViewport(media.matches)
    syncViewport()
    media.addEventListener('change', syncViewport)
    return () => media.removeEventListener('change', syncViewport)
  }, [])

  const compactComfort = isComfort && isCompactViewport

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
  // 医护菜单按 PRD 的 M01–M05 分组：临床工作（工作台/患者/计划）+ 核查与随访（统计/随访）
  const isAdmin = user?.role === 'ADMIN'
  const clinicianItems: MenuProps['items'] = [
    {
      type: 'group',
      label: '临床工作',
      children: [
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
        { key: '/plans', label: '用药计划', icon: <IconPlans /> },
      ],
    },
    {
      type: 'group',
      label: '核查与随访',
      children: [
        { key: '/stats', label: '统计与核查', icon: <IconStats /> },
        { key: '/followups', label: '随访中心', icon: <IconFollowups /> },
      ],
    },
  ]
  const items: MenuProps['items'] = isAdmin
    ? [{ key: '/admin', label: '内容与账号管理' }]
    : clinicianItems

  // 菜单扁平化后用于匹配子页面（如 /patients/:id）高亮所属菜单项
  const flatKeys = (items ?? []).flatMap((i) =>
    i && 'children' in i && Array.isArray(i.children) ? i.children.map((c) => String(c?.key)) : [String(i?.key)],
  )
  const selectedKey =
    flatKeys.find((k) => location.pathname === k || location.pathname.startsWith(`${k}/`)) ?? location.pathname
  const roleLabel = isAdmin ? '管理员' : '医护'

  return (
    <Layout
      className={isComfort ? 'cc-shell' : undefined}
      style={{ minHeight: '100vh', width: '100%' }}
    >
      <Header
        className="cc-shell-header"
        style={{
          height: isComfort ? 64 : 56,
          lineHeight: isComfort ? '64px' : '56px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--line)',
          padding: isComfort ? '0 32px' : '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {isComfort && crumb ? (
          <button type="button" className="cc-crumb" onClick={() => navigate(crumb.parentTo)}>
            <span>{crumb.parent}</span>
            <span aria-hidden="true">/</span>
            <strong>{crumb.current}</strong>
          </button>
        ) : (
          <span className="cc-shell-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <BrandMark size={22} />
            <Typography.Text className="cc-shell-brand-title" strong style={{ fontSize: 15, color: 'var(--ink)' }}>
              吸入治疗指导与依从性辅助管理软件
            </Typography.Text>
          </span>
        )}

        {/* 顶栏全局搜索（仅医护）：输入编号或姓名，选择后直达患者详情 */}
        {user?.role === 'CLINICIAN' && (
          <AutoComplete
            className="cc-shell-search"
            style={{ width: isComfort ? 200 : 320 }}
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

        {/* 医护的用户区固定在侧栏底部；管理员无侧栏，保留顶栏下拉 */}
        {isAdmin && (
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
        )}
      </Header>

      <Layout
        className={isComfort ? 'cc-shell-body' : undefined}
        style={{ width: '100%', flexGrow: isComfort ? 1 : undefined }}
      >
        {/* 只有一个菜单项时（管理员）不占用侧栏宽度 */}
        {items.length > 1 && (
          <Sider
            width={isComfort ? 220 : 232}
            collapsed={compactComfort}
            collapsedWidth={64}
            theme="light"
            style={{ borderRight: '1px solid var(--line)', background: 'var(--surface)' }}
          >
            <div className="side-menu">
              {isComfort && !compactComfort && (
                <div className="cc-side-brand">
                  <div className="cc-side-mark" aria-hidden="true">吸</div>
                  <div>
                    <strong>吸入治疗管理</strong>
                    <span>医护工作台</span>
                  </div>
                </div>
              )}
              <Menu
                mode="inline"
                inlineCollapsed={compactComfort}
                selectedKeys={[selectedKey]}
                items={items}
                onClick={({ key }) => navigate(key)}
                style={{ borderInlineEnd: 'none', paddingTop: 12, flex: 1, overflowY: 'auto' }}
              />
              <div className="sider-foot">
                <Avatar size={28} style={{ background: 'var(--brand-soft)', color: 'var(--brand-ink)', fontWeight: 600 }}>
                  {(user?.account || '?').slice(0, 1).toUpperCase()}
                </Avatar>
                <div className="sider-user">
                  <span className="sider-name">{user?.account}</span>
                  <span className="sider-role">{roleLabel}</span>
                </div>
                <Button size="small" onClick={async () => { await logout(); navigate('/login') }}>
                  退出
                </Button>
              </div>
            </div>
          </Sider>
        )}
        <Content
          className="cc-shell-content"
          style={{
            background: 'var(--bg)',
            padding: isComfort ? '36px 40px 40px' : 28,
            flex: 1,
            minWidth: 0,
          }}
        >
          <div style={{ width: '100%' }}>{children}</div>
        </Content>
      </Layout>
    </Layout>
  )
}
