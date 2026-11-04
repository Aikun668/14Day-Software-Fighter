import { useEffect, useMemo, useState } from 'react'
import { Button, Dropdown, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import MedicationBackfillModal from '../../components/MedicationBackfillModal'
import TaskCloseModal from '../../components/TaskCloseModal'
import { summarizeDay, type DaySummary, type MatrixResponse } from '../../components/todayCoverage'
import {
  AttentionPanel,
  Card,
  CollapsibleList,
  HeroBar,
  QueueRow,
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

const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六']

// M01 工作台（J036）：交班操作台。瘦摘要 + 刻度/需关注 + 待核查队列。
// 待核查不收进侧栏，行里直接补登或处理。
export default function WorkbenchPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [todaySummary, setTodaySummary] = useState<DaySummary | null>(null)
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

        const [t, p, ov, mx, wk] = await Promise.all([
          apiFetch<{ items: Task[] }>('/api/tasks?status=OPEN&page_size=20'),
          apiFetch<{ items: Patient[] }>('/api/patients?page_size=100'),
          apiFetch<Overview>(`/api/stats/overview?${win}`).catch(() => null),
          apiFetch<MatrixResponse>(`/api/stats/matrix?${todayWin}`).catch(() => null),
          apiFetch<MatrixResponse>(`/api/stats/matrix?${weekWin}`).catch(() => null),
        ])
        setTasks(t.items)
        setPatients(p.items)
        setOverview(ov)
        setTodaySummary(mx ? summarizeDay(mx, todayKey) : null)
        setWeekMatrix(wk)
      } catch (e) { message.error((e as Error).message) } finally { setLoading(false) }
    }
    load()
  }, [refreshKey])

  const patientName = (pid: string) => patients.find(p => p.id === pid)?.display_name || '未命名患者'
  const patientCode = (pid: string) => patients.find(p => p.id === pid)?.patient_code || ''

  // 需要关注：近 7 日有缺失时点的患者，缺失多在前，最多 3 个
  const watch = (overview?.rows ?? [])
    .filter((r) => r.missing_count > 0)
    .sort((a, b) => b.missing_count - a.missing_count)
    .slice(0, 3)

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
  // 覆盖项给分母（缺 X / 应 Y）+ 覆盖率，30 秒交班里才分得出轻重
  const attention: AttentionItem[] = []
  if (watch.length > 0) {
    const top = watch[0]
    const due = top.N
    const rate = due > 0 && top.coverage_rate !== null ? `${top.coverage_rate}%` : '—'
    attention.push({
      key: 'coverage',
      mark: '覆',
      tone: 'warn',
      title: `${top.display_name} 近 7 日覆盖偏低`,
      detail: `缺 ${top.missing_count} / 应 ${due} · 覆盖 ${rate}`,
      chip: '查看',
      chipTone: 'warn',
      onClick: goPatient(top.patient_id),
    })
  }
  // 今日有未登记时点时给下钻入口（原来只是文字，用户要自己跳统计页找）
  if (!loading && todaySummary && todaySummary.missing > 0) {
    attention.push({
      key: 'today-missing',
      mark: '今',
      tone: 'warn',
      title: `今日还有 ${todaySummary.missing} 个时点未登记`,
      chip: '去处理',
      chipTone: 'warn',
      onClick: () => document.getElementById('cc-task-queue')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
    })
  }
  if (tasks.length > 0) {
    attention.push({
      key: 'task',
      mark: '核',
      tone: 'warn',
      title: `${tasks.length} 条待核查任务`,
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
    <div className="cc-page cc-desk-page">
      <HeroBar
        eyebrow={<>{today} · <span className={todaySummary ? 'ok' : undefined}>{todaySummary ? '系统正常' : '统计未更新'}</span></>}
        title="工作台"
        actions={
          <>
            <Dropdown menu={{ items: moreItems }} trigger={['click']}>
              <Button>更多</Button>
            </Dropdown>
            <Button onClick={() => setRefreshKey((k) => k + 1)} aria-label="刷新工作台数据">刷新</Button>
          </>
        }
      />

      <TwoColumn
        aside={<AttentionPanel items={attention} />}
      >
        <Card title="近 7 日团队登记" id="cc-week-scale">
          {teamScale.days.length === 0 ? (
            <p className="cc-empty-line">近 7 日暂无可显示的登记数据。</p>
          ) : teamScale.cells.every((c) => c.due === 0) ? (
            <p className="cc-empty-line">近 7 日没有排程时点，不是零登记。</p>
          ) : (
            <TeamScale days={teamScale.days} cells={teamScale.cells} />
          )}
        </Card>
      </TwoColumn>

        <Card title="待核查" id="cc-task-queue">
          {loading ? (
            <p className="cc-empty-line">加载中…</p>
          ) : tasks.length === 0 ? (
            <p className="cc-empty-line">暂无待核查任务。</p>
          ) : (
            <ul className="cc-task-list">
              <CollapsibleList
                collapseAt={6}
                items={tasks.map((t) => (
                  <li key={t.id}>
                    <QueueRow
                      name={patientName(t.patient_id)}
                      meta={patientCode(t.patient_id)}
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
              />
            </ul>
          )}
        </Card>

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
