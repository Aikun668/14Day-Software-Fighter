import { useEffect, useState, type KeyboardEvent } from 'react'
import { Button, Collapse, message, Progress } from 'antd'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import PageHeader from '../../components/PageHeader'
import EmptyState from '../../components/EmptyState'
import MedicationBackfillModal from '../../components/MedicationBackfillModal'
import TaskCloseModal from '../../components/TaskCloseModal'
import { summarizeDay, type DaySummary, type MatrixResponse } from '../../components/todayCoverage'

interface Task {
  id: string; patient_id: string; task_type: string; status: string;
  assigned_to: string | null; created_at: string; closed_at: string | null
}
interface Patient { id: string; patient_code: string; display_name: string }
interface Followup { id: string; patient_id: string; followed_at: string; feedback: string | null }
interface CoverageRow {
  patient_id: string; patient_code: string; display_name: string
  N: number; M: number; coverage_rate: number | null; missing_count: number
}
interface Overview {
  from_: string; to: string; timezone: string
  patient_count: number; planned_count: number
  total_N: number; total_M: number; coverage_rate: number | null
  rows: CoverageRow[]
}

// 按浏览器本地日期（不能用 toISOString：东八区 00:00–08:00 会落到前一天，与统计页的区间错位）
const formatLocalDay = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

function todayStatusText(summary: DaySummary | null): string {
  if (!summary || summary.N === 0) return '今日暂无已到期时点'
  if (summary.missing > 0) return `还有 ${summary.missing} 个已到期时点未登记`
  return '今日已到期时点已全部登记'
}

// M01 工作台（J036）：一屏交班 —— 状态带（今日环 + 7日数字）+ 待核查队列 / 需关注患者双栏 + 折叠随访
export default function WorkbenchPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [recentFollowups, setRecentFollowups] = useState<Followup[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [todaySummary, setTodaySummary] = useState<DaySummary | null>(null)
  const [todayAsOf, setTodayAsOf] = useState('')
  const [today] = useState(() => new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }))
  // 补登弹窗：记录当前操作的患者；refreshKey 用于补登成功后重拉数据
  const [backfill, setBackfill] = useState<{ id: string; name: string } | null>(null)
  const [closing, setClosing] = useState<{ id: string; patientId: string; patientName: string } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        // 统计窗口：过去 7 个完整日
        const end = new Date()
        const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7)
        const win = `from=${formatLocalDay(start)}&to=${formatLocalDay(end)}`
        // 今日：[今天 00:00, 明天 00:00)，后端矩阵的 N 只含已到期时点
        const todayKey = formatLocalDay(end)
        const tomorrow = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
        const todayWin = `from=${todayKey}&to=${formatLocalDay(tomorrow)}`

        const [t, p, ov, fu, mx] = await Promise.all([
          apiFetch<{ items: Task[] }>('/api/tasks?status=OPEN&page_size=20'),
          apiFetch<{ items: Patient[] }>('/api/patients?page_size=100'),
          apiFetch<Overview>(`/api/stats/overview?${win}`).catch(() => null),
          apiFetch<{ items: Followup[] }>('/api/followups?page_size=5').catch(() => ({ items: [] as Followup[] })),
          apiFetch<MatrixResponse>(`/api/stats/matrix?${todayWin}`).catch(() => null),
        ])
        setTasks(t.items)
        setPatients(p.items)
        setOverview(ov)
        setRecentFollowups(fu.items.slice(0, 5))
        setTodaySummary(mx ? summarizeDay(mx, todayKey) : null)
        setTodayAsOf(end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
      } catch (e) { message.error((e as Error).message) } finally { setLoading(false) }
    }
    load()
  }, [refreshKey])

  const patientName = (pid: string) => patients.find(p => p.id === pid)?.display_name || pid.slice(0, 8)
  const patientCode = (pid: string) => patients.find(p => p.id === pid)?.patient_code || ''
  const dash = (v: number | null | undefined) => (loading || v == null ? '—' : String(v))

  // 需要关注：近 7 日有缺失时点的患者，缺失多在前，最多 3 个
  const watch = (overview?.rows ?? [])
    .filter((r) => r.missing_count > 0)
    .sort((a, b) => b.missing_count - a.missing_count)
    .slice(0, 3)

  const todayRate = todaySummary?.rate ?? null

  const goPatient = (pid: string) => () => navigate(`/patients/${pid}`)
  const onRowKey = (fn: () => void) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fn()
    }
  }

  return (
    <div>
      <PageHeader title="工作台" subtitle="今日状态、待核查任务与需要关注的患者" meta={today} />

      {/* 今日状态行：今日环 + 7 日数字 + 统计入口（通栏无框） */}
      <section className="status-strip" aria-label="今日与近 7 日状态">
        <div className="status-today">
          <Progress
            type="circle"
            size={68}
            percent={todayRate ?? 0}
            strokeColor={todayRate === null ? '#C9CDD8' : '#573BF4'}
            format={() => <span className="num">{todayRate === null ? '—' : `${todayRate}%`}</span>}
          />
          <div className="status-today-text">
            <span className="status-line1">{todayStatusText(todaySummary)}</span>
            <span className="status-line2 num">
              已登记 {dash(todaySummary?.M ?? 0)} / 已到期 {dash(todaySummary?.N ?? 0)} · 截至 {todayAsOf || '—'}
            </span>
          </div>
        </div>
        <span className="status-sep" aria-hidden />
        <div className="status-kpi">
          <span className="status-kpi-num">{overview ? (overview.coverage_rate === null ? '—' : `${overview.coverage_rate}%`) : '—'}</span>
          <span className="status-kpi-label">近 7 日覆盖率</span>
        </div>
        <div className="status-kpi">
          <span className="status-kpi-num">{dash(overview?.patient_count ?? patients.length)}</span>
          <span className="status-kpi-label">负责患者</span>
        </div>
        <div className="status-kpi">
          <span className="status-kpi-num">{dash(tasks.length)}</span>
          <span className="status-kpi-label">待核查</span>
        </div>
        <Button type="link" style={{ marginLeft: 'auto' }} onClick={() => navigate('/stats')}>查看统计</Button>
      </section>

      {/* 待核查任务：单列通栏，行尾内联动作 */}
      <section className="page-section" aria-label="待核查任务">
        <div className="section-head">
          <h2 className="section-title">待核查（{tasks.length}）</h2>
        </div>
        {loading ? (
          <p className="muted" style={{ margin: 0 }}>加载中…</p>
        ) : tasks.length === 0 ? (
          <EmptyState
            title="暂无待核查任务"
            hint="负责患者今日时点均已处理时，这里会是空的。"
          />
        ) : (
          <ul className="section-list">
            {tasks.map((t) => (
              <li key={t.id}>
                <div
                  className="queue-row"
                  role="button"
                  tabIndex={0}
                  aria-label={`查看 ${patientName(t.patient_id)} 详情`}
                  onClick={goPatient(t.patient_id)}
                  onKeyDown={onRowKey(goPatient(t.patient_id))}
                >
                  <span className="row-dot tone-warn" aria-hidden />
                  <span className="row-name">
                    {patientName(t.patient_id)}
                    <span className="task-code">{patientCode(t.patient_id)}</span>
                  </span>
                  <span className="row-time">{fmt(t.created_at)}</span>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      setBackfill({ id: t.patient_id, name: patientName(t.patient_id) })
                    }}
                  >
                    补登用药
                  </Button>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      setClosing({ id: t.id, patientId: t.patient_id, patientName: patientName(t.patient_id) })
                    }}
                  >
                    处理任务
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 需要关注的患者：单列通栏 */}
      <section className="page-section" aria-label="需要关注的患者">
        <div className="section-head">
          <h2 className="section-title">需要关注（{watch.length}）</h2>
          <Button type="link" style={{ padding: 0 }} onClick={() => navigate('/stats')}>完整排行在统计页</Button>
        </div>
        {watch.length === 0 ? (
          <EmptyState
            title="暂无需要关注的患者"
            hint="负责患者近 7 日无缺失时点。"
          />
        ) : (
          <ul className="section-list">
            {watch.map((r) => (
              <li key={r.patient_id}>
                <div
                  className="watch-row"
                  role="button"
                  tabIndex={0}
                  aria-label={`查看 ${r.display_name} 详情`}
                  onClick={goPatient(r.patient_id)}
                  onKeyDown={onRowKey(goPatient(r.patient_id))}
                >
                  <span className="row-name">
                    {r.display_name}
                    <span className="task-code">{r.patient_code}</span>
                  </span>
                  <span className="row-rate num">{r.coverage_rate === null ? '—' : `${r.coverage_rate}%`}</span>
                  <span className="row-miss">缺 {r.missing_count} 个时点</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 近期随访：默认折叠，一行一条 */}
      {recentFollowups.length > 0 && (
        <section className="page-section" aria-label="近期随访" style={{ borderBottom: 'none' }}>
          <Collapse
            ghost
            items={[{
              key: 'fu',
              label: <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>近期随访（{recentFollowups.length}）</span>,
              children: (
                <ul className="section-list">
                  {recentFollowups.map((f) => (
                    <li key={f.id}>
                      <div
                        className="fu-row"
                        role="button"
                        tabIndex={0}
                        aria-label={`查看 ${patientName(f.patient_id)} 详情`}
                        onClick={goPatient(f.patient_id)}
                        onKeyDown={onRowKey(goPatient(f.patient_id))}
                      >
                        <span className="row-dot tone-ok" aria-hidden />
                        <span className="row-name">{patientName(f.patient_id)}</span>
                        <span className="row-time">{fmt(f.followed_at)}</span>
                        <span className="fu-text">{f.feedback || '未记录反馈'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ),
            }]}
          />
        </section>
      )}

      <MedicationBackfillModal
        open={!!backfill}
        patientId={backfill?.id ?? null}
        patientName={backfill?.name ?? ''}
        onClose={() => setBackfill(null)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />

      <TaskCloseModal
        open={!!closing}
        task={closing}
        onClose={() => setClosing(null)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}
