import { type ReactNode } from 'react'
import { Button, Popover, Select } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { PatientAvatar } from './Medix'
import { isDemoPatient, type MedixPatient } from './clinical'
import '../../styles/medix-clinical.css'

export function ClinicalPanel({ title, actions, children, className = '' }: { title: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`ml-surface ml-clinical-panel ${className}`}><div className="ml-section-head"><h2>{title}</h2>{actions}</div>{children}</section>
}
export function InfoHint({ label = '统计口径', children }: { label?: string; children: ReactNode }) {
  return <Popover content={<div className="ml-info-copy">{children}</div>} trigger={['click']}><button className="ml-info-button" type="button" aria-label={label}><InfoCircleOutlined /></button></Popover>
}
export function LoadError({ error, retry }: { error: string; retry?: () => void }) {
  return <div className="ml-section-error" role="alert">{error}{retry && <Button type="link" onClick={retry}>重试</Button>}</div>
}
export function PatientPicker({ patients, value, onChange, disabled, loading }: { patients: MedixPatient[]; value?: string; onChange: (id: string) => void; disabled?: boolean; loading?: boolean }) {
  const patient = patients.find(p => p.id === value)
  return <div className="ml-patient-picker">{patient && <PatientAvatar key={patient.id} code={patient.patient_code} src={patient.avatar_url} demoPatient={isDemoPatient(patient)} />}<Select variant="borderless" aria-label="选择患者" value={value} disabled={disabled} loading={loading} onChange={onChange} placeholder="选择患者" showSearch optionFilterProp="search"
    labelRender={p => patients.find(item => item.id === p.value)?.display_name ?? p.label}
    options={patients.map(p => ({ value: p.id, label: patients.some(x => x.id !== p.id && x.display_name === p.display_name) ? `${p.display_name}（${p.patient_code}）` : p.display_name, search: `${p.display_name} ${p.patient_code}` }))} /></div>
}
