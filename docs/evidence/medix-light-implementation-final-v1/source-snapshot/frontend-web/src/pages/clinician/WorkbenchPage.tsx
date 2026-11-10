import { useEffect, useMemo, useState } from 'react'
import { Button, Dropdown, Tooltip } from 'antd'
import { CheckOutlined, MinusOutlined, PieChartOutlined, DownOutlined, ReloadOutlined, MedicineBoxOutlined, CheckSquareOutlined, ProfileOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import MedicationBackfillModal from '../../components/MedicationBackfillModal'
import TaskCloseModal, { type CloseTask } from '../../components/TaskCloseModal'
import { summarizeDay, type MatrixResponse } from '../../components/todayCoverage'
import { PageHeading, PatientIdentity, RowAction } from '../../components/medix/Medix'

interface Task { id: string; patient_id: string; task_type: string; status: string }
interface Patient { id: string; patient_code: string; display_name: string; diagnosis_label?: string | null; avatar_url?: string | null }
interface CoverageRow { patient_id: string; patient_code: string; display_name: string; N: number; M: number; coverage_rate: number | null; missing_count: number }
interface Overview { rows: CoverageRow[] }
const weekdays = ['日', '一', '二', '三', '四', '五', '六']
// Statistics are business calendar dates, independent of the workstation timezone.
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const offsetDay = (key: string, offset: number) => {
  const d = new Date(`${key}T12:00:00+08:00`)
  d.setUTCDate(d.getUTCDate() + offset)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
const stateLabel = { all: '全部登记', partial: '部分登记', missing: '未发现登记', none: '无到期时点' }

export default function WorkbenchPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [patients, setPatients] = useState<Patient[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [weekMatrix, setWeekMatrix] = useState<MatrixResponse | null>(null)
  const [loadedVersion, setLoadedVersion] = useState('')
  const [taskError, setTaskError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [backfill, setBackfill] = useState<{ id: string; name: string } | null>(null)
  const [closing, setClosing] = useState<CloseTask | null>(null)
  const today = todayKey()
  const requestVersion = `${today}:${refreshKey}`
  const loading = loadedVersion !== requestVersion
  const date = `${Number(today.slice(5, 7))}月${Number(today.slice(8))}日 · 周${weekdays[new Date(`${today}T12:00:00+08:00`).getUTCDay()]}`
  useEffect(() => {
    let active = true
    const win = `from=${offsetDay(today, -7)}&to=${today}`
    const weekWin = `from=${offsetDay(today, -6)}&to=${offsetDay(today, 1)}`
    Promise.allSettled([
      apiFetch<{ items: Task[]; total: number }>('/api/tasks?status=OPEN&page_size=20'),
      apiFetch<{ items: Patient[] }>('/api/patients?page_size=100'),
      apiFetch<Overview>(`/api/stats/overview?${win}`),
      apiFetch<MatrixResponse>(`/api/stats/matrix?${weekWin}`),
    ]).then(([t, p, ov, wk]) => {
      if (!active) return
      if (t.status === 'fulfilled') { setTasks(t.value.items); setTotal(t.value.total ?? t.value.items.length); setTaskError('') }
      else setTaskError('任务加载失败，请刷新重试')
      if (p.status === 'fulfilled') setPatients(p.value.items)
      setOverview(ov.status === 'fulfilled' ? ov.value : null)
      setWeekMatrix(wk.status === 'fulfilled' ? wk.value : null)
      setLoadedVersion(`${today}:${refreshKey}`)
    })
    return () => { active = false }
  }, [refreshKey, today])
  const byId = useMemo(() => new Map(patients.map(p => [p.id, p])), [patients])
  const watch = (overview?.rows ?? []).filter(r => r.missing_count > 0).sort((a, b) => b.missing_count - a.missing_count).slice(0, 3)
  const moreItems = [
    { key: 'stats', label: '统计与核查', onClick: () => navigate('/stats') },
    { key: 'patients', label: '患者管理', onClick: () => navigate('/patients') },
    { key: 'followups', label: '随访中心', onClick: () => navigate('/followups') },
  ]
  const visibleTasks = expanded ? tasks : tasks.slice(0, 7)
  return <div className="ml-page ml-workbench-page">
    <PageHeading title="工作台" date={date}>
      <Dropdown menu={{ items: moreItems }} trigger={['click']}><Button>更多 <DownOutlined /></Button></Dropdown>
      <Button aria-label="刷新" icon={<ReloadOutlined aria-hidden="true" />} loading={loading} onClick={() => setRefreshKey(k => k + 1)}>刷新</Button>
    </PageHeading>
    <div className="ml-dashboard-top">
      <section className="ml-surface ml-scale-panel" aria-labelledby="ml-week-title">
        <div className="ml-section-head"><h2 id="ml-week-title">近 7 日团队登记</h2><div className="ml-legend" aria-label="登记状态图例">{(Object.keys(stateLabel) as Array<keyof typeof stateLabel>).map(s => <span key={s}><i className={`ml-cell-${s}`} aria-hidden="true" />{stateLabel[s]}</span>)}</div></div>
        {weekMatrix ? <div className="ml-scale">{weekMatrix.days.map(day => {
          const { N, M } = summarizeDay(weekMatrix, day)
          const kind = N === 0 ? 'none' : M === N ? 'all' : M > 0 ? 'partial' : 'missing'
          const label = `${day}，${N === 0 ? '无到期时点' : `${stateLabel[kind]}，已登记 ${M} / 应登记 ${N}`}`
          return <div className="ml-scale-day" key={day}><span className="ml-scale-date">{day.slice(5).replace('-', '/')}</span><span className="ml-scale-week">周{weekdays[new Date(`${day}T12:00:00+08:00`).getUTCDay()]}</span><Tooltip title={label}><button type="button" aria-label={label} className={`ml-scale-cell ml-cell-${kind}`}>{kind === 'all' ? <CheckOutlined /> : kind === 'partial' ? <PieChartOutlined /> : kind === 'missing' ? <MinusOutlined /> : null}</button></Tooltip></div>
        })}</div> : <p className={loading ? 'ml-empty' : 'ml-section-error'}>{loading ? '加载中…' : '登记统计暂不可用'}</p>}
      </section>
      <section className="ml-surface ml-attention" aria-labelledby="ml-attention-title"><h2 id="ml-attention-title">需关注</h2>
        <div className="ml-attention-list">{watch.map(p => <div className="ml-attention-row" key={p.patient_id}>
          <PatientIdentity name={p.display_name} code={p.patient_code} src={byId.get(p.patient_id)?.avatar_url} demoPatient={Boolean(byId.get(p.patient_id)?.diagnosis_label?.includes('DEMO'))} onClick={() => navigate(`/patients/${p.patient_id}`)} />
          <Tooltip title={`已登记 ${p.M} / 应登记 ${p.N}`}><span className="ml-attention-rate">{p.N > 0 && p.coverage_rate !== null ? `${p.coverage_rate}%` : '—'}</span></Tooltip>
          <RowAction label={`查看${p.display_name}详情`} icon={<ProfileOutlined />} onClick={() => navigate(`/patients/${p.patient_id}`)} />
        </div>)}</div>
        {!loading && !overview ? <p className="ml-section-error">关注统计暂不可用</p> : !loading && watch.length === 0 ? <p className="ml-empty">暂无待关注事项</p> : null}
      </section>
    </div>
    <section className="ml-surface ml-task-table" id="ml-task-queue" aria-labelledby="ml-task-title"><h2 id="ml-task-title">待核查<span className="ml-task-count">{total}</span></h2>
      {taskError && <p className="ml-section-error" role="alert">{taskError}</p>}
      {loading && !tasks.length ? <p className="ml-empty">加载中…</p> : !tasks.length && !taskError ? <p className="ml-empty">暂无待核查任务</p> : <div className="ml-table-wrap"><table className="ml-table"><colgroup><col /><col style={{ width: '38%' }} /></colgroup><thead><tr><th>患者</th><th>操作</th></tr></thead><tbody>{visibleTasks.map(task => {
        const p = byId.get(task.patient_id)
        const name = p?.display_name || '未命名患者'
        return <tr key={task.id}><td><PatientIdentity name={name} code={p?.patient_code} src={p?.avatar_url} demoPatient={Boolean(p?.diagnosis_label?.includes('DEMO'))} onClick={() => navigate(`/patients/${task.patient_id}`)} /></td><td className="ml-actions-cell"><div className="ml-row-actions"><Button aria-label="补登用药" icon={<MedicineBoxOutlined aria-hidden="true" />} onClick={() => setBackfill({ id: task.patient_id, name })}>补登用药</Button><Button aria-label="处理任务" icon={<CheckSquareOutlined aria-hidden="true" />} onClick={() => setClosing({ id: task.id, patientId: task.patient_id, patientName: name, taskType: task.task_type, patientCode: p?.patient_code, avatarUrl: p?.avatar_url, demoPatient: Boolean(p?.diagnosis_label?.includes('DEMO')) })}>处理任务</Button></div></td></tr>
      })}</tbody></table></div>}
      {(tasks.length > 7 || total > tasks.length) && <div className="ml-task-footer">{tasks.length > 7 && <button type="button" className="ml-text-button" onClick={() => setExpanded(!expanded)}>{expanded ? '收起' : `展开其余 ${tasks.length - 7} 条`}</button>}{total > tasks.length && <button type="button" className="ml-text-button" onClick={() => navigate('/followups')}>全部任务</button>}</div>}
    </section>
    <MedicationBackfillModal open={!!backfill} patientId={backfill?.id ?? null} patientName={backfill?.name ?? ''} patientCode={backfill ? byId.get(backfill.id)?.patient_code : undefined} avatarUrl={backfill ? byId.get(backfill.id)?.avatar_url : undefined} demoPatient={Boolean(backfill && byId.get(backfill.id)?.diagnosis_label?.includes('DEMO'))} onClose={() => setBackfill(null)} onSuccess={() => setRefreshKey(k => k + 1)} />
    <TaskCloseModal open={!!closing} task={closing} onClose={() => setClosing(null)} onSuccess={() => setRefreshKey(k => k + 1)} />
  </div>
}
