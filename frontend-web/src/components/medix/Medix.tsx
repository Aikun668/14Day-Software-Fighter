import { useState, type CSSProperties, type ReactNode } from 'react'
import { ConfigProvider, Tooltip } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { medixTheme } from '../../styles/medix-theme'
import '../../styles/medix-light.css'
import doctor from '../../assets/medix/doctor-assistant.png'
import portraits from '../../assets/medix/demo-portraits.png'
import brand from '../../assets/medix/brand-symbol.png'

export function MedixThemeBoundary({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={medixTheme} button={{ autoInsertSpace: false }}><div className="ml-theme">{children}</div></ConfigProvider>
}
export function MedixBrand() {
  return <div className="ml-brand"><img src={brand} alt="" /><span>吸入治疗管理</span></div>
}
export function DoctorIllustration({ className = '' }: { className?: string }) {
  return <img className={`ml-doctor ${className}`} src={doctor} alt="" />
}
// Only an explicitly enabled fixture session receives generated portraits.
const demoPortraits: Record<string, number> = {
  'P-004': 0, 'P-006': 1, 'P-002': 2, 'P-007': 3, 'P-009': 4,
  'P-001': 5, 'P-005': 6, 'P-008': 7, 'P-003': 8, 'P-014': 9,
}
export function PatientAvatar({ code, src, clinician = false, large = false, demoPatient = false }: { code?: string; src?: string | null; clinician?: boolean; large?: boolean; demoPatient?: boolean }) {
  const [failed, setFailed] = useState(false)
  const demo = demoPatient || (import.meta.env.DEV && sessionStorage.getItem('medix-demo-assets') === 'approved-fixture-v1')
  const index = demo ? (clinician ? 11 : demoPortraits[code || '']) : undefined
  const style: CSSProperties | undefined = index === undefined ? undefined : {
    backgroundImage: `url("${portraits}")`,
    backgroundPosition: `${(index % 4) * 100 / 3}% ${Math.floor(index / 4) * 50}%`,
  }
  return <span className={`ml-avatar${large ? ' ml-avatar-large' : ''}${clinician ? ' ml-avatar-clinician' : ''}${index !== undefined ? ' ml-avatar-demo' : ''}`} style={style} aria-hidden="true">
    {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : index === undefined ? <UserOutlined /> : null}
  </span>
}
export function PatientIdentity({ name, code, src, onClick, demoPatient = false }: { name: string; code?: string; src?: string | null; onClick?: () => void; demoPatient?: boolean }) {
  const content = <><PatientAvatar code={code} src={src} demoPatient={demoPatient} /><span>{name}</span></>
  return onClick ? <button className="ml-identity" type="button" onClick={onClick}>{content}</button> : <span className="ml-identity">{content}</span>
}
export function RowAction({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return <Tooltip title={label}><button type="button" className="ml-icon-button" aria-label={label} onClick={e => { e.stopPropagation(); onClick() }}>{icon}</button></Tooltip>
}
export function PageHeading({ title, date, children }: { title: string; date?: string; children?: ReactNode }) {
  return <header className="ml-page-heading"><div className="ml-heading-text"><h1>{title}</h1>{date && <span className="ml-date">{date}</span>}</div><div className="ml-toolbar">{children}</div></header>
}
export function StatusTag({ bound }: { bound: boolean }) {
  return <span className={`ml-status ${bound ? 'ml-status-bound' : 'ml-status-unbound'}`}>{bound ? '已绑定' : '未绑定'}</span>
}
