import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Dropdown } from 'antd'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import MedicationBackfillModal from '../../components/MedicationBackfillModal'
import TaskCloseModal from '../../components/TaskCloseModal'
import {
  SCALE_STATUS_LABEL,
  readDaySummary,
  readTeamScale,
  type DaySummary,
  type ScaleCell,
  type ScaleStatus,
} from '../../components/todayCoverage'
import {
  MedixPageHeading,
  PatientAvatar,
  PatientIdentity,
  RowAction,
  Surface,
} from '../../components/medix'
import { IconCaret, IconCheck, IconCheckSquare, IconDash, IconDetail, IconPartial, IconPencil } from '../../components/medix/icons'

interface Task {
  id: string
  patient_id: string
  task_type: string
  status: string
  assigned_to: string | null
  created_at: string
  closed_at: string | null
}

interface Patient {
  id: string
  patient_code: string
  display_name: string
}

interface CoverageRow {
  patient_id: string
  patient_code: string
  display_name: string
  N: number
  M: number
  coverage_rate: number | null
  missing_count: number
}

interface Overview {
  from_: string
  to: string
  timezone: string
  patient_count: number
  planned_count: number
  total_N: number
  total_M: number
  coverage_rate: number | null
  rows: CoverageRow[]
}

const VISIBLE_TASKS = 6
const TASK_PAGE_SIZE = 20

const formatLocalDay = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六']

function formatHeadingDate(d: Date) {
  return `${d.getMonth() + 1}月${d.getDate()}日 · 周${WEEK_ZH[d.getDay()]}`
}

function errorText(reason: unknown) {
  return reason instanceof Error && reason.message ? reason.message : '请求失败'
}

function isOverview(value: unknown): value is Overview {
  if (!value || typeof value !== 'object' || !Array.isArray((value as Overview).rows)) return false
  return (value as Overview).rows.every((row) =>
    !!row
    && typeof row.patient_id === 'string'
    && typeof row.N === 'number'
    && typeof row.missing_count === 'number',
  )
}

function coverageText(row: CoverageRow) {
  if (!(row.N > 0)) return '—'
  if (row.coverage_rate == null || Number.isNaN(row.coverage_rate)) return '不可用'
  return `${row.coverage_rate}%`
}

function scaleDate(day: string) {
  const dt = new Date(`${day}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return { date: day, weekday: '' }
  return {
    date: `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`,
    weekday: `周${WEEK_ZH[dt.getDay()]}`,
  }
}

function cellLabel(cell: ScaleCell) {
  const when = scaleDate(cell.day)
  const head = when.weekday ? `${when.date} ${when.weekday}` : cell.day
  return `${head}：已登记 ${cell.M} / 应 ${cell.N}，${SCALE_STATUS_LABEL[cell.status]}`
}

function StatusGlyph({ status }: { status: ScaleStatus }) {
  if (status === 'full') return <IconCheck />
  if (status === 'partial') return <IconPartial />
  if (status === 'miss') return <IconDash />
  return null
}

function Legend() {
  const items: ScaleStatus[] = ['full', 'partial', 'miss', 'none']
  return (
    <div className="ml-legend">
      {items.map((status) => (
        <span key={status} className="ml-legend-item">
          <i className={`ml-swatch is-${status}`} aria-hidden="true">{status === 'partial' ? <i /> : null}</i>
          {SCALE_STATUS_LABEL[status]}
        </span>
      ))}
    </div>
  )
}

export default function WorkbenchPage() {
  const navigate = useNavigate()
  const loadSeq = useRef(0)
  const [todayLabel] = useState(() => formatHeadingDate(new Date()))
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskTotal, setTaskTotal] = useState<number | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [todaySummary, setTodaySummary] = useState<DaySummary | null>(null)
  const [weekCells, setWeekCells] = useState<ScaleCell[] | null>(null)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [patientsError, setPatientsError] = useState<string | null>(null)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [todayError, setTodayError] = useState<string | null>(null)
  const [weekError, setWeekError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading')
  const [refreshing, setRefreshing] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [backfill, setBackfill] = useState<{ id: string; name: string } | null>(null)
  const [closing, setClosing] = useState<{ id: string; patientId: string; patientName: string; taskType?: string } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const seq = ++loadSeq.current
    const end = new Date()
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7)
    const tomorrow = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
    const todayKey = formatLocalDay(end)
    const weekFrom = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6)
    const win = `from=${formatLocalDay(start)}&to=${formatLocalDay(end)}`
    const todayWin = `from=${todayKey}&to=${formatLocalDay(tomorrow)}`
    const weekWin = `from=${formatLocalDay(weekFrom)}&to=${formatLocalDay(tomorrow)}`

    Promise.allSettled([
      apiFetch<{ items?: Task[]; total?: number }>('/api/tasks?status=OPEN&page_size=20'),
      apiFetch<{ items?: Patient[] }>('/api/patients?page_size=100'),
      apiFetch<Overview>(`/api/stats/overview?${win}`),
      apiFetch<unknown>(`/api/stats/matrix?${todayWin}`),
      apiFetch<unknown>(`/api/stats/matrix?${weekWin}`),
    ]).then((results) => {
      if (seq !== loadSeq.current) return
      const [taskRes, patientRes, overviewRes, todayRes, weekRes] = results

      if (taskRes.status === 'fulfilled' && Array.isArray(taskRes.value?.items)) {
        setTasks(taskRes.value.items)
        setTaskTotal(typeof taskRes.value.total === 'number' ? taskRes.value.total : null)
        setTasksError(null)
      } else {
        setTasksError(taskRes.status === 'rejected' ? errorText(taskRes.reason) : '待核查任务不可用')
      }

      if (patientRes.status === 'fulfilled' && Array.isArray(patientRes.value?.items)) {
        setPatients(patientRes.value.items)
        setPatientsError(null)
      } else {
        setPatientsError(patientRes.status === 'rejected' ? errorText(patientRes.reason) : '患者名单不可用')
      }

      if (overviewRes.status === 'fulfilled' && isOverview(overviewRes.value)) {
        setOverview(overviewRes.value)
        setOverviewError(null)
      } else {
        setOverview(null)
        setOverviewError('近 7 日统计不可用')
      }

      const todayRead = todayRes.status === 'fulfilled' ? readDaySummary(todayRes.value, todayKey) : { ok: false as const }
      if (todayRead.ok) {
        setTodaySummary(todayRead.value)
        setTodayError(null)
      } else {
        setTodaySummary(null)
        setTodayError('今日统计不可用')
      }

      const weekRead = weekRes.status === 'fulfilled' ? readTeamScale(weekRes.value) : { ok: false as const }
      if (weekRead.ok) {
        setWeekCells(weekRead.value)
        setWeekError(null)
      } else {
        setWeekCells(null)
        setWeekError('近 7 日统计不可用')
      }

      setPhase('ready')
      setRefreshing(false)
    })
  }, [refreshKey])

  const names = useMemo(() => new Map(patients.map((patient) => [patient.id, patient.display_name])), [patients])
  const patientName = (patientId: string) => names.get(patientId) || '未命名患者'

  const watch = (overview?.rows ?? [])
    .filter((row) => row.missing_count > 0)
    .sort((a, b) => b.missing_count - a.missing_count)
    .slice(0, 3)

  const refresh = () => {
    setRefreshing(true)
    setRefreshKey((key) => key + 1)
  }

  const goPatient = (patientId: string) => navigate(`/patients/${patientId}`)
  const scrollQueue = () => document.getElementById('ml-task-queue')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

  const loadedCount = taskTotal != null ? taskTotal : (tasks.length < TASK_PAGE_SIZE ? tasks.length : null)
  const titleCount = loadedCount
  const serverHasMore = taskTotal != null ? taskTotal > tasks.length : tasks.length >= TASK_PAGE_SIZE
  const hiddenCount = Math.max(0, tasks.length - VISIBLE_TASKS)
  const visibleTasks = queueOpen ? tasks : tasks.slice(0, VISIBLE_TASKS)
  const taskCountText = taskTotal != null
    ? String(taskTotal)
    : (tasks.length < TASK_PAGE_SIZE ? String(tasks.length) : '')
  const showTodayLine = !todayError && !!todaySummary && todaySummary.missing > 0
  const showTaskLine = !tasksError && tasks.length > 0
  const attentionClear = phase === 'ready'
    && !overviewError
    && !todayError
    && !tasksError
    && watch.length === 0
    && !showTodayLine
    && !showTaskLine

  const moreItems = [
    { key: 'stats', label: '统计与核查', onClick: () => navigate('/stats') },
    { key: 'patients', label: '患者管理', onClick: () => navigate('/patients') },
    { key: 'followups', label: '随访中心', onClick: () => navigate('/followups') },
  ]

  const busy = phase === 'loading' || refreshing

  return (
    <div className="ml-workbench" aria-busy={busy}>
      <MedixPageHeading
        title="工作台"
        date={todayLabel}
        actions={
          <>
            <Dropdown menu={{ items: moreItems }} trigger={['click']}>
              <Button>更多 <IconCaret /></Button>
            </Dropdown>
            <Button onClick={refresh} disabled={busy}>刷新</Button>
          </>
        }
      />

      <div className="ml-split">
        <Surface title="近 7 日团队登记" actions={weekCells && weekCells.length > 0 ? <Legend /> : null}>
          {phase === 'loading' && !weekCells ? (
            <p className="ml-empty">加载中…</p>
          ) : weekError ? (
            <p className="ml-block-error" role="alert">{weekError}</p>
          ) : !weekCells || weekCells.length === 0 ? (
            <p className="ml-empty">近 7 日暂无可显示的登记数据。</p>
          ) : (
            <div className="ml-scale-wrap">
              <div
                className="ml-scale"
                aria-label="近七日团队登记"
                style={{ gridTemplateColumns: `repeat(${weekCells.length}, minmax(4.5rem, 1fr))` }}
              >
                {weekCells.map((cell) => {
                  const when = scaleDate(cell.day)
                  return (
                    <div key={`h-${cell.day}`} className="ml-scale-day">
                      <strong>{when.date}</strong>
                      {when.weekday}
                    </div>
                  )
                })}
                {weekCells.map((cell) => (
                  <button
                    key={cell.day}
                    type="button"
                    className={`ml-day-cell is-${cell.status}`}
                    data-status={cell.status}
                    data-n={cell.N}
                    data-m={cell.M}
                    aria-label={cellLabel(cell)}
                  >
                    <StatusGlyph status={cell.status} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </Surface>

        <Surface title="需关注">
          {phase === 'loading' && !overview && !todaySummary && tasks.length === 0 ? (
            <p className="ml-empty">加载中…</p>
          ) : (
            <div>
              {overviewError ? <p className="ml-block-error" role="alert">{overviewError}</p> : null}
              {watch.map((row) => {
                const name = row.display_name || '未命名患者'
                const rate = coverageText(row)
                return (
                  <div key={row.patient_id} className="ml-attn-person">
                    <button type="button" className="ml-attn-main" onClick={() => goPatient(row.patient_id)}>
                      <PatientAvatar name={name} patientId={row.patient_id} />
                      <span className="ml-identity-name">{name}</span>
                      <span className="ml-attn-rate">{rate}</span>
                    </button>
                    <RowAction
                      label={`查看${name}详情。缺 ${row.missing_count} / 应 ${row.N}，覆盖 ${rate}`}
                      icon={<IconDetail />}
                      onClick={() => goPatient(row.patient_id)}
                    />
                  </div>
                )
              })}
              {todayError ? <p className="ml-block-error" role="alert">{todayError}</p> : null}
              {showTodayLine ? (
                <div className="ml-attn-line">
                  <span>今日待核查 {todaySummary?.missing}</span>
                  <button type="button" className="ml-text-btn" onClick={scrollQueue}>去处理</button>
                </div>
              ) : null}
              {showTaskLine ? (
                <div className="ml-attn-line">
                  <span>待核查任务 {taskCountText}</span>
                  <button type="button" className="ml-text-btn" onClick={scrollQueue}>处理</button>
                </div>
              ) : null}
              {attentionClear ? <p className="ml-empty">暂无待关注事项</p> : null}
            </div>
          )}
        </Surface>
      </div>

      <div id="ml-task-queue" className="ml-queue">
        <Surface title={<>待核查{titleCount != null ? <span className="ml-count">{titleCount}</span> : null}</>}>
          {patientsError ? <p className="ml-block-error" role="alert">{patientsError}</p> : null}
          {tasksError ? <p className="ml-block-error" role="alert">{tasksError}</p> : null}
          {phase === 'loading' && tasks.length === 0 ? (
            <p className="ml-empty">加载中…</p>
          ) : tasks.length === 0 && !tasksError ? (
            <p className="ml-empty">暂无待核查任务。</p>
          ) : tasks.length > 0 ? (
            <>
              <div className="ml-table-wrap">
                <table className="ml-table">
                  <thead>
                    <tr>
                      <th scope="col">患者</th>
                      <th scope="col">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTasks.map((task) => {
                      const name = patientName(task.patient_id)
                      return (
                        <tr
                          key={task.id}
                          className="ml-click-row"
                          data-task-id={task.id}
                          data-patient-id={task.patient_id}
                          tabIndex={0}
                          onClick={() => goPatient(task.patient_id)}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              goPatient(task.patient_id)
                            }
                          }}
                        >
                          <td>
                            <PatientIdentity
                              name={name}
                              avatar={<PatientAvatar name={name} patientId={task.patient_id} />}
                            />
                          </td>
                          <td onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                            <div className="ml-queue-actions">
                              <button
                                type="button"
                                className="ml-quiet"
                                onClick={() => setBackfill({ id: task.patient_id, name })}
                              >
                                <IconPencil />
                                补登用药
                              </button>
                              <button
                                type="button"
                                className="ml-quiet"
                                onClick={() => setClosing({ id: task.id, patientId: task.patient_id, patientName: name, taskType: task.task_type })}
                              >
                                <IconCheckSquare />
                                处理任务
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {(hiddenCount > 0 || serverHasMore) && (
                <div className="ml-fold-row">
                  {hiddenCount > 0 ? (
                    <button
                      type="button"
                      className="ml-fold"
                      aria-expanded={queueOpen}
                      onClick={() => setQueueOpen((open) => !open)}
                    >
                      {queueOpen ? '收起' : `其余 ${hiddenCount} 条`}
                    </button>
                  ) : null}
                  {serverHasMore ? (
                    <button type="button" className="ml-fold" onClick={() => navigate('/followups')}>
                      全部任务
                    </button>
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </Surface>
      </div>

      <MedicationBackfillModal
        appearance="medix"
        open={!!backfill}
        patientId={backfill?.id ?? null}
        patientName={backfill?.name ?? ''}
        onClose={() => setBackfill(null)}
        onSuccess={refresh}
      />

      <TaskCloseModal
        appearance="medix"
        open={!!closing}
        task={closing}
        onClose={() => setClosing(null)}
        onSuccess={refresh}
      />
    </div>
  )
}
