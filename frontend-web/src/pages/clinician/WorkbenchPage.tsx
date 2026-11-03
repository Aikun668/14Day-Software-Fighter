import { useEffect, useMemo, useState } from 'react'
import { Button, Dropdown, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import EmptyState from '../../components/EmptyState'
import MedicationBackfillModal from '../../components/MedicationBackfillModal'
import TaskCloseModal from '../../components/TaskCloseModal'
import { summarizeDay, type DaySummary, type MatrixResponse } from '../../components/todayCoverage'
import {
  AttentionPanel,
  Card,
  HeroBar,
  QueueRow,
  StatBand,
  TeamScale,
  TwoColumn,
  type AttentionItem,
  type ScaleDay,
} from '../../components/clinic'

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

const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六']

function todayStatusText(summary: DaySummary | null): string {
  if (!summary || summary.N === 0) return '今日暂无已到期时点'
  if (summary.missing > 0) return `还有 ${summary.missing} 个已到期时点未登记`
  return '今日已到期时点已全部登记'
}

// M01 工作台（J036）：Clinic Comfort 两层。Hero + 四摘要 + 刻度/队列 | 需关注/随访。
export default function WorkbenchPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [recentFollowups, setRecentFollowups] = useState<Followup[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [todaySummary, setTodaySummary] = useState<DaySummary | null>(null)
  const [todayAsOf, setTodayAsOf] = useState('')
  const [weekMatrix, setWeekMatrix] = useState<MatrixResponse | null>(null)
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
        // 近 7 日团队矩阵：用于工作台的单行团队刻度
        const weekWin = `from=${formatLocalDay(new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6))}&to=${formatLocalDay(tomorrow)}`

        const [t, p, ov, fu, mx, wk] = await Promise.all([
          apiFetch<{ items: Task[] }>('/api/tasks?status=OPEN&page_size=20'),
          apiFetch<{ items: Patient[] }>('/api/patients?page_size=100'),
          apiFetch<Overview>(`/api/stats/overview?${win}`).catch(() => null),
          apiFetch<{ items: Followup[] }>('/api/followups?page_size=5').catch(() => ({ items: [] as Followup[] })),
          apiFetch<MatrixResponse>(`/api/stats/matrix?${todayWin}`).catch(() => null),
          apiFetch<MatrixResponse>(`/api/stats/matrix?${weekWin}`).catch(() => null),
        ])
        setTasks(t.items)
        setPatients(p.items)
        setOverview(ov)
        setRecentFollowups(fu.items.slice(0, 5))
        setTodaySummary(mx ? summarizeDay(mx, todayKey) : null)
        setWeekMatrix(wk)
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

  // 近 7 日团队刻度：把矩阵各天的 N/M 累加成一行的格子
  const teamScale = useMemo(() => {
    if (!weekMatrix) return { days: [] as ScaleDay[], cells: [] as { registered: number; due: number }[] }
    const days = weekMatrix.days.map((d) => {
      const dt = new Date(`${d}T00:00:00`)
      return {
        key: d,
        date: String(dt.getDate()),
        weekday: WEEK_ZH[dt.getDay()],
      }
    })
    const cells = weekMatrix.days.map((d) => {
      let registered = 0
      let due = 0
      for (const row of weekMatrix.rows) {
        const cell = row.cells.find((c) => c.day === d)
        if (cell) { registered += cell.M; due += cell.N }
      }
      return { registered, due }
    })
    return { days, cells }
  }, [weekMatrix])

  // 需关注面板：未绑定 / 缺失 / 待核查 三类里挑最该处理的
  const attention: AttentionItem[] = []
  if (watch.length > 0) {
    const top = watch[0]
    attention.push({
      key: 'coverage',
      mark: '覆',
      tone: 'warn',
      title: `${top.display_name} 近 7 日覆盖偏低`,
      detail: `缺 ${top.missing_count} 个时点`,
      chip: '查看',
      chipTone: 'warn',
      onClick: goPatient(top.patient_id),
    })
  }
  if (tasks.length > 0) {
    attention.push({
      key: 'task',
      mark: '核',
      tone: 'warn',
      title: `${tasks.length} 条待核查任务`,
      detail: '任务未关闭',
      chip: '处理',
      chipTone: 'warn',
      onClick: () => document.getElementById('cc-task-queue')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
    })
  }
  if (attention.length === 0) {
    attention.push({
      key: 'clear',
      mark: '稳',
      tone: 'info',
      title: '暂无需要关注的事项',
      detail: '待核查与覆盖均正常',
      chip: '正常',
      chipTone: 'blue',
    })
  }

  const moreItems = [
    { key: 'stats', label: '统计与核查', onClick: () => navigate('/stats') },
    { key: 'patients', label: '患者管理', onClick: () => navigate('/patients') },
    { key: 'followups', label: '随访中心', onClick: () => navigate('/followups') },
  ]

  return (
    <div className="cc-page">
      <HeroBar
        eyebrow={<>{today} · <span className={todaySummary ? 'ok' : undefined}>{todaySummary ? '系统正常' : '统计未更新'}</span></>}
        title="工作台"
        sub="下面是今日登记覆盖、待核查队列与需要关注的患者。"
        actions={
          <>
            <Dropdown menu={{ items: moreItems }} trigger={['click']}>
              <Button>更多</Button>
            </Dropdown>
            <Button type="primary" onClick={() => navigate('/stats')}>查看统计</Button>
          </>
        }
      />

      <StatBand
        label="今日与近 7 日摘要"
        items={[
          {
            key: 'today',
            label: '今日登记',
            value: todaySummary?.rate == null ? '—' : `${todayRate}%`,
            warn: (todaySummary?.missing ?? 0) > 0,
            meta: todaySummary
              ? todaySummary.N > 0
                ? `已登记 ${todaySummary.M} / 已到期 ${todaySummary.N} · 截至 ${todayAsOf || '—'}`
                : todayStatusText(todaySummary)
              : '统计暂不可用',
          },
          {
            key: 'coverage',
            label: '近 7 日覆盖',
            value: overview ? (overview.coverage_rate === null ? '—' : `${overview.coverage_rate}%`) : '—',
            warn: (overview?.coverage_rate ?? 100) < 100,
            meta: '登记覆盖 ≠ 依从性',
          },
          {
            key: 'patients',
            label: '负责患者',
            value: dash(overview?.patient_count ?? patients.length),
            meta: '近 7 日有计划时点',
          },
          {
            key: 'tasks',
            label: '待核查',
            value: dash(tasks.length),
            warn: tasks.length > 0,
            meta: tasks.length ? '需处理' : '已清空',
          },
        ]}
      />

      <TwoColumn
        aside={
          <>
            <AttentionPanel items={attention} count={attention.length} />

            {recentFollowups.length > 0 && (
              <Card title="近期随访" hint={`${recentFollowups.length} 条`}>
                <ul className="cc-followup-list">
                  {recentFollowups.map((f) => (
                    <li key={f.id}>
                      <QueueRow
                        tone="ok"
                        name={patientName(f.patient_id)}
                        extra={fmt(f.followed_at)}
                        onClick={goPatient(f.patient_id)}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        }
      >
        <Card title="近 7 日团队登记" hint="覆盖 ≠ 依从性" id="cc-week-scale">
          {teamScale.days.length === 0 ? (
            <p className="cc-empty-line">近 7 日暂无可显示的登记数据。</p>
          ) : (
            <TeamScale days={teamScale.days} cells={teamScale.cells} />
          )}
        </Card>

        <Card title="待核查任务" hint={`${tasks.length} 条`} id="cc-task-queue">
          {loading ? (
            <p className="cc-empty-line">加载中…</p>
          ) : tasks.length === 0 ? (
            <EmptyState
              title="暂无待核查任务"
              hint="负责患者今日时点均已处理时，这里会是空的。"
            />
          ) : (
            <ul className="cc-task-list">
              {tasks.map((t) => (
                <li key={t.id}>
                  <QueueRow
                    name={patientName(t.patient_id)}
                    meta={patientCode(t.patient_id)}
                    extra={fmt(t.created_at)}
                    onClick={goPatient(t.patient_id)}
                    actions={[
                      {
                        key: 'backfill',
                        label: '补登用药',
                        onClick: () => setBackfill({ id: t.patient_id, name: patientName(t.patient_id) }),
                      },
                      {
                        key: 'close',
                        label: '处理任务',
                        onClick: () => setClosing({ id: t.id, patientId: t.patient_id, patientName: patientName(t.patient_id) }),
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </TwoColumn>

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
