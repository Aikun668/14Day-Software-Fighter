import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AutoComplete, Drawer, Menu, type MenuProps } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiFetch } from '../../api/client.ts'
import { useAuth } from '../../features/auth/AuthContext.tsx'
import doctorUrl from '../../assets/medix/doctor-assistant.svg'
import logoUrl from '../../assets/medix/logo.svg'
import neutralUrl from '../../assets/medix/avatar-neutral.svg'
import { IconAccounts, IconAudit, IconDevices, IconFollowups, IconGuides, IconKnowledge, IconPatients, IconPlans, IconStats, IconWorkbench } from '../navIcons.tsx'
import { normalizeAdminTab } from '../../pages/admin/adminShared.tsx'
import MedixThemeBoundary from './MedixThemeBoundary.tsx'

interface PatientHit {
  id: string
  patient_code: string
  display_name: string
  diagnosis_label: string | null
}

type Viewport = 'wide' | 'medium' | 'narrow'

function readViewport(): Viewport {
  if (typeof window === 'undefined') return 'wide'
  if (window.matchMedia('(max-width: 767px)').matches) return 'narrow'
  if (window.matchMedia('(max-width: 1199px)').matches) return 'medium'
  return 'wide'
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function ShellMenu({
  items,
  selectedKey,
  collapsed,
  onNavigate,
}: {
  items: MenuProps['items']
  selectedKey: string
  collapsed: boolean
  onNavigate: (key: string) => void
}) {
  return (
    <nav className="ml-nav" aria-label="主导航">
      <Menu
        mode="inline"
        inlineCollapsed={collapsed}
        selectedKeys={[selectedKey]}
        items={items}
        onClick={({ key }) => onNavigate(String(key))}
      />
    </nav>
  )
}

// 医护外壳。搜索仍只覆盖已加载的前 100 条，最多展示 8 条，不是全库搜索。
export default function MedixAppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [viewport, setViewport] = useState(readViewport)
  const [navOpen, setNavOpen] = useState(false)
  const [roster, setRoster] = useState<PatientHit[]>([])
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 767px)')
    const medium = window.matchMedia('(max-width: 1199px)')
    const onChange = () => {
      const next = readViewport()
      setViewport(next)
      if (next !== 'narrow') setNavOpen(false)
    }
    narrow.addEventListener('change', onChange)
    medium.addEventListener('change', onChange)
    return () => {
      narrow.removeEventListener('change', onChange)
      medium.removeEventListener('change', onChange)
    }
  }, [])

  useEffect(() => {
    if (user?.role !== 'CLINICIAN') return
    let alive = true
    apiFetch<{ items: PatientHit[] }>('/api/patients?page_size=100')
      .then((result) => {
        if (alive) setRoster(result.items)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [user?.role])

  const hits = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    if (!query) return []
    return roster
      .filter((patient) =>
        patient.patient_code.toLowerCase().includes(query)
        || (patient.display_name || '').toLowerCase().includes(query),
      )
      .slice(0, 8)
  }, [keyword, roster])

  const isAdmin = user?.role === 'ADMIN'
  const adminTab = normalizeAdminTab(new URLSearchParams(location.search).get('tab'))
  const items: MenuProps['items'] = isAdmin
    ? [
        { key: 'model', icon: <IconDevices />, label: '装置型号' },
        { key: 'guide', icon: <IconGuides />, label: '指导版本' },
        { key: 'user', icon: <IconAccounts />, label: '账号管理' },
        { key: 'kb', icon: <IconKnowledge />, label: '知识内容' },
        { key: 'audit', icon: <IconAudit />, label: '审计日志' },
      ]
    : [
        { key: '/workbench', icon: <IconWorkbench />, label: '工作台' },
        { key: '/patients', icon: <IconPatients />, label: '患者管理' },
        { key: '/plans', icon: <IconPlans />, label: '用药计划' },
        { key: '/stats', icon: <IconStats />, label: '统计与核查' },
        { key: '/followups', icon: <IconFollowups />, label: '随访中心' },
      ]

  const keys = (items ?? []).map((item) => String(item?.key))
  const selectedKey = isAdmin
    ? adminTab
    : keys.find((key) => location.pathname === key || location.pathname.startsWith(`${key}/`))
      ?? location.pathname
  const collapsed = viewport === 'medium'
  const showSearch = user?.role === 'CLINICIAN'

  const go = (key: string) => {
    setNavOpen(false)
    if (isAdmin) {
      navigate(`/admin?tab=${key}`)
      return
    }
    navigate(key)
  }

  const onLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <MedixThemeBoundary scope="shell">
      <div className={`ml-shell-layout${collapsed ? ' is-collapsed' : ''}${viewport === 'narrow' ? ' is-narrow' : ''}`}>
        {items.length > 1 && (
          <aside className="ml-sider">
            <div className="ml-brand">
              <img className="ml-brand-mark" src={logoUrl} alt="" />
              <span className="ml-brand-name">吸入治疗管理</span>
            </div>
            <ShellMenu items={items} selectedKey={selectedKey} collapsed={collapsed} onNavigate={go} />
            <div className="ml-sider-art" aria-hidden="true">
              <img src={doctorUrl} alt="" />
            </div>
          </aside>
        )}
        <div className="ml-main">
          <header className="ml-topbar">
            <button
              type="button"
              className="ml-nav-toggle"
              aria-label="打开导航菜单"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <MenuIcon />
            </button>
            {isAdmin ? <span className="ml-topbar-title">内容与账号管理</span> : null}
            {showSearch && (
              <div className="ml-topbar-search">
                <AutoComplete
                  className="ml-search"
                  classNames={{ popup: { root: 'ml-shell' } }}
                  value={keyword}
                  options={hits.map((patient) => ({
                    value: patient.id,
                    label: (
                      <div className="ml-search-hit">
                        <span className="ml-search-name">{patient.display_name}</span>
                        <span className="ml-search-meta">
                          {patient.patient_code}{patient.diagnosis_label ? ` · ${patient.diagnosis_label}` : ''}
                        </span>
                      </div>
                    ),
                  }))}
                  onChange={setKeyword}
                  onSelect={(patientId: string) => {
                    setKeyword('')
                    navigate(`/patients/${patientId}`)
                  }}
                  placeholder="搜索患者编号或姓名"
                  aria-label="全局搜索患者"
                  allowClear
                />
              </div>
            )}
            <div className="ml-account">
              <img className="ml-account-avatar" src={neutralUrl} alt="" />
              <span className="ml-account-name">{user?.account}</span>
              <button type="button" className="ml-logout" onClick={onLogout}>退出</button>
            </div>
          </header>
          <div className="ml-content">
            <div className="ml-page">{children}</div>
          </div>
        </div>
      </div>
      <Drawer
        placement="left"
        open={navOpen}
        onClose={() => setNavOpen(false)}
        size="15rem"
        destroyOnHidden
        title={<span className="ml-drawer-title">吸入治疗管理</span>}
        classNames={{ root: 'ml-shell' }}
      >
        <ShellMenu items={items} selectedKey={selectedKey} collapsed={false} onNavigate={go} />
      </Drawer>
    </MedixThemeBoundary>
  )
}
