import { useEffect, useState } from 'react'
import { Button, DatePicker, message, Select, Statistic, Table, Typography } from 'antd'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import PageHeader from '../../components/PageHeader'
import EmptyState from '../../components/EmptyState'
import CoverageHeatmap, { type MatrixResponse } from '../../components/CoverageHeatmap'
import CoverageTrendChart from '../../components/CoverageTrendChart'

const { Text } = Typography

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

/** 小型进度条（患者覆盖率行内，仅统计页排行表使用） */
function MiniBar({ rate }: { rate: number | null }) {
  const v = rate === null ? 0 : Math.min(rate, 100)
  const color = rate === null ? '#C9CDD8' : v >= 80 ? '#14938E' : v >= 60 ? '#573BF4' : '#C7681F'
  return (
    <div style={{ width: 96, height: 6, background: '#F0F2F7', borderRadius: 3, overflow: 'hidden' }} aria-hidden>
      <div style={{ width: `${v}%`, height: '100%', background: color, borderRadius: 3 }} />
    </div>
  )
}

interface Patient { id: string; patient_code: string; display_name: string }
interface Stats {
  from_: string; to: string; timezone: string; N: number; M: number; coverage_rate: number | null;
  missing_slots: { slot_id: string; scheduled_at: string }[];
  source_breakdown: Record<string, number>;
  source_breakdown_basis: string;
  disclaimer: string;
}

interface TrendPoint {
  day: string
  N: number
  M: number
  coverage_rate: number | null
}
interface TrendResp {
  points: TrendPoint[]
}

/** 覆盖率进度环（纯 SVG，跟随主题色） */
function CoverageRing({ rate, M, N }: { rate: number | null; M: number; N: number }) {
  const size = 132
  const stroke = 12
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = rate === null ? 0 : Math.min(rate, 100) / 100
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EFECFE" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="#573BF4" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - ratio)}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span className="num" style={{ fontSize: 24, fontWeight: 600, color: '#573BF4' }}>
          {rate === null ? '—' : `${rate}%`}
        </span>
        <span className="num" style={{ fontSize: 13, color: '#6B6E7F' }}>{M} / {N}</span>
      </div>
    </div>
  )
}

/** 缺失时点按日分布柱状图（纯 SVG） */
function MissingBars({ missing }: { missing: { scheduled_at: string }[] }) {
  if (missing.length === 0) {
    return <Text type="secondary">该区间内无缺失时点</Text>
  }
  // 按日聚合并保持日期升序
  const byDay = new Map<string, number>()
  for (const m of missing) {
    const day = new Date(m.scheduled_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    byDay.set(day, (byDay.get(day) || 0) + 1)
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  const max = Math.max(...days.map(([, n]) => n))
  const W = 100 / days.length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '0 4px' }}>
        {days.map(([day, n]) => (
          <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 13, color: 'var(--missed)', fontWeight: 500 }}>{n}</span>
            <div style={{
              width: `min(${W}%, 48px)`, height: `${(n / max) * 82}%`,
              background: '#573BF4', borderRadius: '6px 6px 2px 2px', minHeight: 6, opacity: 0.85,
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 4px', borderTop: '1px solid #F0F2F7', marginTop: 6 }}>
        {days.map(([day]) => (
          <div key={day} style={{ flex: 1, textAlign: 'center', fontSize: 13, color: '#6B6E7F', padding: '6px 0' }}>{day}</div>
        ))}
      </div>
    </div>
  )
}

// M04 统计与核查（J032）
export default function StatsPage() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  // 默认区间：相对今日的近 7 天（左闭右开，与「重置为近 7 日」一致）
  const [from, setFrom] = useState(() => dayjs().subtract(7, 'day').format('YYYY-MM-DD'))
  const [to, setTo] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [stats, setStats] = useState<Stats | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null)
  const [overviewRows, setOverviewRows] = useState<CoverageRow[]>([])

  const fetchPatients = async () => {
    try {
      const r = await apiFetch<{ items: Patient[] }>('/api/patients?page_size=100')
      setPatients(r.items)
    } catch (e) { message.error((e as Error).message) }
  }

  useEffect(() => { fetchPatients() }, [])

  // 覆盖矩阵与患者登记情况均与所选患者无关，随日期区间变化刷新
  useEffect(() => {
    let cancelled = false
    apiFetch<MatrixResponse>(`/api/stats/matrix?from=${from}&to=${to}`)
      .then((r) => { if (!cancelled) setMatrix(r) })
      .catch((e) => { if (!cancelled) message.error((e as Error).message) })
    apiFetch<Overview>(`/api/stats/overview?from=${from}&to=${to}`)
      .then((r) => { if (!cancelled) setOverviewRows(r.rows) })
      .catch(() => { if (!cancelled) setOverviewRows([]) })
    return () => { cancelled = true }
  }, [from, to])

  const fetchStats = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const [r, t] = await Promise.all([
        apiFetch<Stats>(`/api/patients/${selected}/stats?from=${from}&to=${to}`),
        // 逐日趋势由服务端一次查询返回（此前是前端按天并发发 N 个请求）
        apiFetch<TrendResp>(`/api/patients/${selected}/stats/trend?from=${from}&to=${to}`)
          .then((x) => x.points)
          .catch(() => [] as TrendPoint[]),
      ])
      setStats(r)
      setTrend(t)
    } catch (e) { message.error((e as Error).message) } finally { setLoading(false) }
  }

  return (
    <div>
      <PageHeader title="统计与核查" subtitle="负责患者登记覆盖率、缺失时点与逐日趋势" />

      {/* 工具行：左筛选，右操作 */}
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          <label htmlFor="stats-patient" className="field-label">患者</label>
          <Select
            id="stats-patient"
            style={{ width: 240 }}
            placeholder="选择患者"
            options={patients.map(p => ({ value: p.id, label: `${p.display_name} (${p.patient_code})` }))}
            onChange={setSelected}
            showSearch optionFilterProp="label"
          />
          <span className="field-label">开始</span>
          <DatePicker
            value={dayjs(from)}
            onChange={(d) => d && setFrom(d.format('YYYY-MM-DD'))}
            placeholder="开始日期"
            allowClear={false}
          />
          <span className="field-label">结束</span>
          <DatePicker
            value={dayjs(to)}
            onChange={(d) => d && setTo(d.format('YYYY-MM-DD'))}
            placeholder="结束日期"
            allowClear={false}
          />
        </div>
        <div className="page-toolbar-right">
          <Button
            onClick={() => {
              // 演示区间与种子脚本的 v1 计划区间一致（过去 7 个完整日）
              const start = dayjs().subtract(7, 'day').format('YYYY-MM-DD')
              const end = dayjs().format('YYYY-MM-DD')
              setFrom(start); setTo(end)
            }}
          >
            重置为近 7 日
          </Button>
          <Button type="primary" onClick={fetchStats} disabled={!selected} loading={loading}>查询</Button>
        </div>
      </div>

      <section className="page-section">
        <div className="section-head">
          <h2 className="section-title">覆盖矩阵（负责患者 × 日期）</h2>
          <span className="section-extra">仅统计已到期时点</span>
        </div>
        {matrix ? (
          <CoverageHeatmap days={matrix.days} rows={matrix.rows} />
        ) : (
          <p className="muted" style={{ margin: 0 }}>加载中…</p>
        )}
      </section>

      {/* 患者登记情况排行（随所选区间） */}
      {overviewRows.length > 0 && (
        <section className="page-section">
          <div className="section-head">
            <h2 className="section-title">患者登记情况（缺失多在前）</h2>
            <span className="section-extra">随所选区间 · 点击行查看详情</span>
          </div>
          <Table
            rowKey="patient_id"
            pagination={false}
            dataSource={[...overviewRows].sort((a, b) => b.missing_count - a.missing_count)}
            locale={{ emptyText: '暂无数据' }}
            onRow={(r) => ({ onClick: () => navigate(`/patients/${r.patient_id}`), style: { cursor: 'pointer' } })}
            columns={[
              {
                title: '患者', dataIndex: 'display_name', width: 200,
                render: (_: string, r: CoverageRow) => (
                  <span className="task-name">{r.display_name}<span className="task-code">{r.patient_code}</span></span>
                ),
              },
              { title: '应记录 N', dataIndex: 'N', width: 100, align: 'right' as const },
              { title: '已登记 M', dataIndex: 'M', width: 100, align: 'right' as const },
              {
                title: '缺失', dataIndex: 'missing_count', width: 90, align: 'right' as const,
                render: (v: number) => v > 0 ? <span style={{ color: 'var(--bad)', fontWeight: 500 }}>{v}</span> : <span style={{ color: 'var(--ok)' }}>0</span>,
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
        </section>
      )}

      {!stats && (
        <section className="page-section" style={{ borderBottom: 'none' }}>
          <EmptyState
            title="先选择一位患者"
            hint="上方选择患者与统计区间后点击「查询」，查看该患者的覆盖率与缺失时点；覆盖矩阵与排行不依赖患者选择，已随区间展示。"
          />
        </section>
      )}

      {stats && (
        <>
          <section className="page-section">
            <div className="section-head">
              <h2 className="section-title">覆盖率汇总</h2>
              <span className="section-extra">区间：{stats.from_} 至 {stats.to}（左闭右开）｜ 时区：{stats.timezone}</span>
            </div>
            <div className="stats-summary">
              <CoverageRing rate={stats.coverage_rate} M={stats.M} N={stats.N} />
              <div className="stats-numbers">
                <Statistic title="应记录时点 N" value={stats.N} />
                <Statistic title="有效已登记时点 M" value={stats.M} />
                <Statistic
                  title="缺失时点"
                  value={stats.missing_slots.length}
                  styles={{ content: { color: stats.missing_slots.length ? 'var(--missed)' : 'var(--progress)' } }}
                />
              </div>
            </div>
            <p className="muted" style={{ margin: '16px 0 0' }}>{stats.disclaimer}</p>
          </section>

          <section className="page-section">
            <div className="section-head">
              <h2 className="section-title">逐日覆盖率趋势</h2>
            </div>
            <CoverageTrendChart trend={trend} />
          </section>

          <div className="stats-grid page-section">
            <div>
              <div className="section-head">
                <h2 className="section-title">缺失时点按日分布</h2>
              </div>
              <MissingBars missing={stats.missing_slots} />
            </div>

            <div>
              <div className="section-head">
                <h2 className="section-title">来源分布</h2>
                <span className="section-extra">按有效登记事件数统计（非去重时点数）</span>
              </div>
              <Table
                rowKey="source"
                dataSource={Object.entries(stats.source_breakdown).map(([k, v]) => ({ source: k, count: v }))}
                pagination={false}
                columns={[
                  { title: '来源', dataIndex: 'source', render: (v: string) => v === 'PATIENT_REPORT' ? '患者自述' : v === 'CLINICIAN_OBSERVED' ? '医护观察' : v },
                  { title: '事件数', dataIndex: 'count' },
                ]}
              />
            </div>
          </div>

          <section className="page-section" style={{ borderBottom: 'none' }}>
            <div className="section-head">
              <h2 className="section-title">缺失时点（{stats.missing_slots.length} 个）</h2>
            </div>
            <Table
              rowKey="slot_id"
              dataSource={stats.missing_slots}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '应记录时间', dataIndex: 'scheduled_at', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
                { title: '状态', render: () => '无有效登记' },
              ]}
            />
          </section>
        </>
      )}
    </div>
  )
}
