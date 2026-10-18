import { useEffect, useState } from 'react'
import { Button, Card, message, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import PageHeader from '../../components/PageHeader'

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

/** 聚合覆盖率进度环（132px SVG） */
function OverviewRing({ rate, M, N }: { rate: number | null; M: number; N: number }) {
  const size = 128
  const stroke = 12
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = rate === null ? 0 : Math.min(rate, 100) / 100
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EFECFE" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="#573BF4" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - ratio)}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 24, fontWeight: 600, color: '#573BF4' }}>
          {rate === null ? '—' : `${rate}%`}
        </span>
        <span style={{ fontSize: 12, color: '#6B6E7F' }}>{M} / {N}</span>
      </div>
    </div>
  )
}

/** 小型进度条（患者行内） */
function MiniBar({ rate }: { rate: number | null }) {
  const v = rate === null ? 0 : Math.min(rate, 100)
  const color = rate === null ? '#C9CDD8' : v >= 80 ? '#14938E' : v >= 60 ? '#573BF4' : '#C7681F'
  return (
    <div style={{ width: 96, height: 6, background: '#F0F2F7', borderRadius: 3, overflow: 'hidden' }} aria-hidden>
      <div style={{ width: `${v}%`, height: '100%', background: color, borderRadius: 3 }} />
    </div>
  )
}

// M01 工作台（J036）：聚合概览 + 紧急任务 + 患者覆盖率排行 + 近期随访
export default function WorkbenchPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [recentFollowups, setRecentFollowups] = useState<Followup[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [selected, setSelected] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [today] = useState(() => new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }))

  useEffect(() => {
    const load = async () => {
      try {
        // 统计窗口：过去 7 个完整日，按浏览器本地日期（不能用 toISOString：
        // 东八区 00:00–08:00 会落到前一天，与统计页的区间错位）
        const fmt = (d: Date) => {
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          return `${y}-${m}-${day}`
        }
        const end = new Date()
        const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7)
        const win = `from=${fmt(start)}&to=${fmt(end)}`

        const [t, p, ov, fu] = await Promise.all([
          apiFetch<{ items: Task[] }>('/api/tasks?status=OPEN&page_size=50'),
          apiFetch<{ items: Patient[] }>('/api/patients?page_size=100'),
          apiFetch<Overview>(`/api/stats/overview?${win}`).catch(() => null),
          // 一次拿负责患者的随访（此前是每个患者各发一次请求）
          apiFetch<{ items: Followup[] }>('/api/followups?page_size=5').catch(() => ({ items: [] as Followup[] })),
        ])
        setTasks(t.items)
        setPatients(p.items)
        setOverview(ov)
        setRecentFollowups(fu.items.slice(0, 5))
      } catch (e) { message.error((e as Error).message) } finally { setLoading(false) }
    }
    load()
  }, [])

  const patientName = (pid: string) => patients.find(p => p.id === pid)?.display_name || pid.slice(0, 8)
  const patientCode = (pid: string) => patients.find(p => p.id === pid)?.patient_code || ''
  const count = (n: number) => (loading ? '—' : n)

  return (
    <div>
      <PageHeader title="工作台" meta={today} />

      {/* 概览：覆盖率环 + 三格数字（4 格固定布局，无数据也占位，避免列数跳变） */}
      <section className="overview overview-4" aria-label="工作台概览">
        <div className="overview-cell">
          <span className="overview-label">近 7 日登记覆盖率</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <OverviewRing rate={overview?.coverage_rate ?? null} M={overview?.total_M ?? 0} N={overview?.total_N ?? 0} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#6B6E7F' }}>
                负责患者 <b style={{ color: '#24243E' }}>{count(overview?.patient_count ?? patients.length)}</b> 人
              </span>
              <span style={{ fontSize: 13, color: '#6B6E7F' }}>
                有计划 <b style={{ color: '#24243E' }}>{count(overview?.planned_count ?? 0)}</b> 人
              </span>
              <span style={{ fontSize: 12, color: '#6B6E7F' }}>
                {overview && overview.total_N === 0 ? '该区间无固定时点' : '基于登记记录'}
              </span>
            </div>
          </div>
        </div>
        <div className="overview-cell">
          <span className="overview-label">负责患者</span>
          <span className="overview-value">{count(overview?.patient_count ?? patients.length)}</span>
        </div>
        <div className="overview-cell">
          <span className="overview-label">待核查任务</span>
          <span className="overview-value">{count(tasks.length)}</span>
        </div>
        <div className="overview-cell">
          <span className="overview-label">近期随访</span>
          <span className="overview-value">{count(recentFollowups.length)}</span>
        </div>
      </section>

      {/* 主区：任务 + 患者覆盖率排行 */}
      <div className={`workbench-main${selected ? ' has-detail' : ''}`}>
        <Card title="待核查任务" loading={loading} styles={{ body: { padding: loading ? undefined : '4px 0' } }}>
          {tasks.length === 0 ? (
            <p className="card-empty">暂无待核查任务（连续 3 个时点无登记才会生成）</p>
          ) : (
            <ul className="task-list">
              {tasks.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`task-row${selected?.id === t.id ? ' is-selected' : ''}`}
                    aria-current={selected?.id === t.id ? 'true' : undefined}
                    onClick={() => setSelected(t)}
                  >
                    <span className="task-main">
                      <span className="task-head">
                        <span className="task-name">
                          {patientName(t.patient_id)}
                          <span className="task-code">{patientCode(t.patient_id)}</span>
                        </span>
                        {t.status === 'OPEN'
                          ? <Tag className="tag-brand">待核查</Tag>
                          : <Tag color="cyan">处理中</Tag>}
                      </span>
                      <span className="task-basis">依据：连续多次固定时点未发现登记</span>
                      <span className="task-time">生成于 {new Date(t.created_at).toLocaleString('zh-CN')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected && (
          <Card title="任务详情">
            <dl className="detail-list">
              <div>
                <dt>患者</dt>
                <dd>{patientName(selected.patient_id)}</dd>
              </div>
              <div>
                <dt>依据</dt>
                <dd>连续 3 个已到期固定时点无有效登记</dd>
              </div>
            </dl>
            <p className="basis-block">
              提示：该患者时点未发现登记，<span className="nowrap">不推定漏用药。</span>
            </p>
            <Button type="primary" block onClick={() => navigate('/followups')}>
              记录随访
            </Button>
            <Button type="link" block onClick={() => navigate(`/patients/${selected.patient_id}`)}>
              查看患者详情
            </Button>
          </Card>
        )}
      </div>

      {/* 患者覆盖率排行（紧急在前） */}
      {overview && overview.rows.length > 0 && (
        <Card title="患者登记情况（缺失多在前）" styles={{ body: { padding: 0 } }} extra={
          <span style={{ fontSize: 12, color: '#6B6E7F' }}>近 7 日 · 点击姓名查看详情</span>
        }>
          <Table
            rowKey="patient_id"
            pagination={false}
            dataSource={overview.rows}
            locale={{ emptyText: '暂无数据' }}
            onRow={(r) => ({ onClick: () => navigate(`/patients/${r.patient_id}`), style: { cursor: 'pointer' } })}
            columns={[
              {
                title: '患者', dataIndex: 'display_name', width: 200,
                render: (_: string, r: CoverageRow) => (
                  <span className="task-name">{r.display_name}<span className="task-code">{r.patient_code}</span></span>
                ),
              },
              {
                title: '应记录 N', dataIndex: 'N', width: 100, align: 'right' as const,
              },
              {
                title: '已登记 M', dataIndex: 'M', width: 100, align: 'right' as const,
              },
              {
                title: '缺失', dataIndex: 'missing_count', width: 90, align: 'right' as const,
                render: (v: number) => v > 0 ? <span style={{ color: '#B02A2A', fontWeight: 500 }}>{v}</span> : <span style={{ color: '#14938E' }}>0</span>,
              },
              {
                title: '覆盖率', dataIndex: 'coverage_rate', width: 220,
                render: (v: number | null) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <MiniBar rate={v} />
                    <span style={{ fontSize: 13, color: '#24243E', fontWeight: 500 }}>{v === null ? '暂无计划' : `${v}%`}</span>
                  </span>
                ),
                align: 'right' as const,
              },
            ]}
          />
        </Card>
      )}

      {/* 近期随访 */}
      <Card title="近期随访" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={recentFollowups}
          locale={{ emptyText: '暂无随访记录' }}
          columns={[
            {
              title: '随访时间',
              dataIndex: 'followed_at',
              width: 200,
              render: (v: string) => <span className="tabular">{new Date(v).toLocaleString('zh-CN')}</span>,
            },
            { title: '患者', dataIndex: 'patient_id', width: 180, render: (v: string) => patientName(v) },
            { title: '反馈', dataIndex: 'feedback', render: (v: string | null) => v || '—' },
          ]}
        />
      </Card>
    </div>
  )
}
