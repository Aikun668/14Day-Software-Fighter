import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Modal, Select } from 'antd'
import { ThunderboltOutlined, ProfileOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import TaskCloseModal, { type CloseTask } from '../../components/TaskCloseModal'
import { PageHeading, PatientIdentity } from '../../components/medix/Medix'
import { ClinicalPanel, LoadError } from '../../components/medix/ClinicalUI'
import { fetchAll, isDemoPatient, shortTime, type MedixPatient } from '../../components/medix/clinical'
import { useClinicalQuery } from '../../components/medix/useClinicalQuery'
import { useBatchedList } from '../../components/medix/useBatchedList'
import FollowupComposer from '../../components/medix/FollowupComposer'
import '../../styles/medix-followups.css'

interface Task { id: string; patient_id: string; status: string; task_type?: string }
interface Followup { id: string; patient_id: string; followed_at: string; feedback: string | null; action_taken: string | null; next_plan: string | null }
function RecordText({ text, tone }: { text: string | null; tone?: string }) {
  const [expanded, setExpanded] = useState(false), [overflow, setOverflow] = useState(false)
  const copy = useRef<HTMLSpanElement>(null)
  useEffect(() => { const el = copy.current; if (!el || expanded) return; const observer = new ResizeObserver(() => setOverflow(el.scrollHeight > el.clientHeight + 1)); observer.observe(el); return () => observer.disconnect() }, [text, expanded])
  if (!text) return <span className="ml-muted">—</span>
  return <div className="ml-follow-copy"><span ref={copy} className={`${tone ? 'ml-follow-tag ' + tone : ''} ${!expanded ? 'is-clamped' : ''}`}>{text}</span>{(overflow || expanded) && <button type="button" className="ml-text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? '收起' : '展开'}</button>}</div>
}
export default function FollowupPage() {
  const [params] = useSearchParams()
  return <FollowupContext key={params.get('patientId') ?? 'team'} initialPatient={params.get('patientId')} />
}
function FollowupContext({ initialPatient }: { initialPatient: string | null }) {
  const [historyPatient, setHistoryPatient] = useState<string | null>(initialPatient)
  const [composer, setComposer] = useState<{ key: number; patientId?: string; taskId?: string } | null>(null)
  const [closing, setClosing] = useState<CloseTask | null>(null), [posting, setPosting] = useState(false)
  const dirty = useRef(false), trigger = useRef<HTMLElement | null>(null), sequence = useRef(0)
  const [modal, contextHolder] = Modal.useModal()
  const patientLoader = useCallback(async (signal: AbortSignal) => {
    const all = await fetchAll<MedixPatient>('/api/patients', signal)
    if (initialPatient && !all.some(p => p.id === initialPatient)) all.push(await apiFetch<MedixPatient>(`/api/patients/${initialPatient}`, { signal }))
    return all
  }, [initialPatient])
  const directory = useClinicalQuery(initialPatient ?? 'team', patientLoader)
  const patients = directory.data ?? [], byId = new Map(patients.map(p => [p.id, p]))
  const tasks = useBatchedList<Task>('/api/tasks?status=OPEN')
  const records = useBatchedList<Followup>(historyPatient ? `/api/patients/${historyPatient}/followups` : '/api/followups')
  const refresh = () => { tasks.retry(); records.retry() }
  const restore = () => requestAnimationFrame(() => trigger.current?.isConnected && trigger.current.focus())
  const closeComposer = () => { setComposer(null); dirty.current = false; restore() }
  const guard = (action: () => void) => {
    if (posting) return
    if (dirty.current) modal.confirm({ title: '放弃未保存的随访？', okText: '放弃', cancelText: '继续填写', centered: true, onOk: () => { dirty.current = false; action() } })
    else action()
  }
  const openComposer = (patientId?: string, taskId?: string) => {
    const el = document.activeElement as HTMLElement
    guard(() => { trigger.current = el; setClosing(null); setComposer({ key: ++sequence.current, patientId, taskId }); if (patientId) setHistoryPatient(patientId) })
  }
  const quick = (t: Task) => {
    const p = byId.get(t.patient_id)
    if (!p) return
    guard(() => { setComposer(null); setClosing({ id: t.id, patientId: p.id, patientName: p.display_name, patientCode: p.patient_code, avatarUrl: p.avatar_url, demoPatient: isDemoPatient(p), taskType: t.task_type }) })
  }
  const identity = (id: string) => { const p = byId.get(id); return p ? <PatientIdentity name={p.display_name} code={p.patient_code} src={p.avatar_url} demoPatient={isDemoPatient(p)} /> : <span>患者信息不可用</span> }
  return <div className="ml-page ml-follow-page">
    {contextHolder}
    <PageHeading title="随访中心"><Button type="primary" disabled={posting || !directory.data} onClick={() => openComposer()}>新建随访</Button></PageHeading>
    {directory.error && <LoadError error={`患者目录不可用：${directory.error}`} retry={directory.retry} />}
    {composer && <FollowupComposer key={composer.key} patients={patients} initialPatient={composer.patientId} initialTask={composer.taskId} onDirty={v => { dirty.current = v }} onPosting={setPosting} onPatient={setHistoryPatient} onCancel={() => guard(closeComposer)} onSaved={() => { closeComposer(); refresh() }} onRefresh={refresh} />}
    <ClinicalPanel title="待核查" className="ml-follow-queue" actions={<span className="ml-muted">{tasks.loading || tasks.error ? '—' : tasks.total}</span>}>
      {tasks.error ? <LoadError error={tasks.error} retry={tasks.retry} /> : tasks.loading ? <p className="ml-empty">加载中…</p> : <><div className="ml-table-wrap"><table className="ml-table"><colgroup><col /><col style={{ width: '29%' }} /></colgroup><thead><tr><th>患者</th><th>操作</th></tr></thead><tbody>{tasks.items.map(t => <tr key={t.id}><td>{identity(t.patient_id)}</td><td><div className="ml-row-actions"><Button aria-label="快速处理" icon={<ThunderboltOutlined aria-hidden />} disabled={posting || !byId.has(t.patient_id)} onClick={() => quick(t)}>快速处理</Button><Button aria-label="填写随访" icon={<ProfileOutlined aria-hidden />} disabled={posting || !byId.has(t.patient_id)} onClick={() => openComposer(t.patient_id, t.id)}>填写随访</Button></div></td></tr>)}</tbody></table></div>{!tasks.total && <p className="ml-empty">暂无待核查任务</p>}</>}
      {!tasks.loading && !tasks.error && (tasks.count < tasks.total || tasks.count > 5) && <div className="ml-follow-more">{tasks.count < tasks.total && <button className="ml-text-button" onClick={tasks.more}>查看更多 · 共 {tasks.total} 条</button>}{tasks.count > 5 && <button className="ml-text-button" onClick={tasks.collapse}>收起</button>}</div>}
    </ClinicalPanel>
    <ClinicalPanel title="随访记录" className="ml-follow-records" actions={<Select aria-label="筛选随访患者" value={historyPatient ?? undefined} placeholder="全部患者" allowClear disabled={posting || !directory.data} showSearch optionFilterProp="search" onChange={v => setHistoryPatient(v ?? null)} options={patients.map(p => ({ value: p.id, label: p.display_name, search: p.display_name + p.patient_code }))} />}>
      {records.error ? <LoadError error={records.error} retry={records.retry} /> : records.loading ? <p className="ml-empty">加载中…</p> : <><div className="ml-table-wrap"><table className="ml-table"><colgroup>{[15, 20, 29, 18, 18].map((w, i) => <col key={i} style={{ width: w + '%' }} />)}</colgroup><thead><tr>{['时间', '患者', '反馈', '措施', '后续'].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{records.items.map(r => <tr key={r.id}><td><time dateTime={r.followed_at}>{shortTime(r.followed_at)}</time></td><td>{identity(r.patient_id)}</td><td><RecordText text={r.feedback} /></td><td><RecordText text={r.action_taken} tone="is-teal" /></td><td><RecordText text={r.next_plan} tone="is-apricot" /></td></tr>)}</tbody></table></div>{!records.total && <p className="ml-empty">暂无随访记录</p>}</>}
      {!records.loading && !records.error && (records.count < records.total || records.count > 5) && <div className="ml-follow-more">{records.count < records.total && <button className="ml-text-button" onClick={records.more}>查看更多 · 共 {records.total} 条</button>}{records.count > 5 && <button className="ml-text-button" onClick={records.collapse}>收起</button>}</div>}
    </ClinicalPanel>
    <TaskCloseModal open={!!closing} task={closing} onClose={() => setClosing(null)} onSuccess={refresh} />
  </div>
}

