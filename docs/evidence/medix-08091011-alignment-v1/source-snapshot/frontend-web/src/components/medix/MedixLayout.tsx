import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AutoComplete, Button, Drawer, Input } from 'antd'
import { AppstoreFilled, CalendarFilled, MessageFilled, BarChartOutlined, IdcardFilled, SearchOutlined, DownOutlined, MenuOutlined, MedicineBoxFilled, ReadOutlined, FileTextOutlined, AuditOutlined } from '@ant-design/icons'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import { useAuth } from '../../features/auth/AuthContext'
import { DoctorIllustration, MedixBrand, MedixThemeBoundary, PatientAvatar } from './Medix'

interface PatientHit { id: string; patient_code: string; display_name: string }
const links = [
  { path: '/workbench', label: '工作台', icon: <AppstoreFilled /> },
  { path: '/patients', label: '患者管理', icon: <IdcardFilled /> },
  { path: '/plans', label: '用药计划', icon: <CalendarFilled /> },
  { path: '/stats', label: '统计与核查', icon: <BarChartOutlined /> },
  { path: '/followups', label: '随访中心', icon: <MessageFilled /> },
]
export default function MedixLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const [keyword, setKeyword] = useState('')
  const [roster, setRoster] = useState<PatientHit[]>([])
  const [drawer, setDrawer] = useState(false)
  useEffect(() => {
    let active = true
    if (user?.role === 'CLINICIAN') apiFetch<{ items: PatientHit[] }>('/api/patients?page_size=100')
      .then(r => { if (active) setRoster(r.items) }).catch(() => {})
    return () => { active = false }
  }, [user?.role])
  const options = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return q ? roster.filter(p => `${p.patient_code} ${p.display_name}`.toLowerCase().includes(q)).slice(0, 8)
      .map(p => ({ value: p.id, label: p.display_name })) : []
  }, [keyword, roster])
  const adminLinks = [{ path: '/admin?tab=model', label: '装置型号', icon: <MedicineBoxFilled /> }, { path: '/admin?tab=guide', label: '指导版本', icon: <ReadOutlined /> }, { path: '/admin?tab=user', label: '账号管理', icon: <IdcardFilled /> }, { path: '/admin?tab=kb', label: '知识内容', icon: <FileTextOutlined /> }, { path: '/admin?tab=audit', label: '审计日志', icon: <AuditOutlined /> }]
  const active = (path: string) => path.startsWith('/admin?') ? path === `/admin?tab=${new URLSearchParams(search).get('tab') ?? 'model'}` : pathname === path || (path === '/patients' && pathname.startsWith('/patients/'))
  const nav = <nav className="ml-nav" aria-label="主导航">{(user?.role === 'ADMIN' ? adminLinks : links).map(l =>
    <Link key={l.path} to={l.path} title={l.label} aria-label={l.label} aria-current={active(l.path) ? 'page' : undefined} className={active(l.path) ? 'is-active' : ''} onClick={() => setDrawer(false)}>{l.icon}<span>{l.label}</span></Link>
  )}</nav>
  return <MedixThemeBoundary><div className="ml-shell">
    <aside className="ml-sidebar"><MedixBrand />{nav}<DoctorIllustration /></aside>
    <div className="ml-main">
      <header className="ml-topbar">
        <Button className="ml-menu-toggle" type="text" icon={<MenuOutlined />} aria-label="打开导航" onClick={() => setDrawer(true)} />
        {user?.role === 'CLINICIAN' && <AutoComplete className="ml-global-search" value={keyword} options={options} onChange={setKeyword} onSelect={pid => { setKeyword(''); navigate(`/patients/${pid}`) }}>
          <Input prefix={<SearchOutlined />} placeholder="搜索患者编号或姓名" aria-label="全局搜索患者" />
        </AutoComplete>}
        {user?.role === 'ADMIN' && <span className="ml-admin-heading">内容与账号管理</span>}
        <div className="ml-account"><PatientAvatar clinician /><span>{user?.account}</span><DownOutlined className="ml-account-chevron" /><span className="ml-account-divider" /><button type="button" onClick={async () => { await logout(); navigate('/login') }}>退出</button></div>
      </header>
      <main className="ml-content">{children}</main>
    </div>
    <Drawer rootClassName="ml-theme ml-drawer" title={<MedixBrand />} open={drawer} onClose={() => setDrawer(false)} placement="left" size={260}>{nav}</Drawer>
  </div></MedixThemeBoundary>
}
