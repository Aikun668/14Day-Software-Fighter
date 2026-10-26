import { useEffect, useState } from 'react'
import { Button, DatePicker, message, Select, Statistic, Table, Tabs, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
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

/** 小型进度条（患者覆盖率行内，仅统计页排行表使用；统一品牌紫） */
function MiniBar({ rate }: { rate: number | null }) {
  const v = rate === null ? 0 : Math.min(rate, 100)
  return (
    <div style={{ width: 96, height: 6, background: '#F0F2F7', borderRadius: 3, overflow: 'hidden' }} aria-hidden>
      <div style={{ width: `${v}%`, height: '100%', background: 'var(--brand)', borderRadius: 3 }} />
    </div>
  )
}

interface Patient { id: string; patient_code: string; display_name: string }
interface DuplicateSlot { slot_id: string; scheduled_at: string; active_event_count: number }
interface Stats {
  from_: string; to: string; timezone: string; N: number; M: number; coverage_rate: number | null;
  missing_slots: { slot_id: string; scheduled_at: string }[];
  duplicate_slots: DuplicateSlot[];
  source_breakdown: Record<string, number>;
  source_breakdown_basis: string;
  source_note: string;
  disclaimer: string;
}
interface Followup {
  id: string; followed_at: string; task_id: string | null
  feedback: string | null; action_taken: string | null; next_plan: string | null
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
        <span className="num stats-ring-value">
          {rate === null ? '—' : `${rate}%`}
        </span>
        <span className="num stats-ring-sub">{M} / {N}</span>
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
  const [activeTab, setActiveTab] = useState<'overview' | 'report'>('overview')
  const [patients, setPatients] = useState<Patient[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  // 默认区间：相对今日的近 7 天（左闭右开，与「重置为近 7 日」一致）
  const [from, setFrom] = useState(() => dayjs().subtract(7, 'day').format('YYYY-MM-DD'))
  const [to, setTo] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [stats, setStats] = useState<Stats | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [periodFollowups, setPeriodFollowups] = useState<Followup[]>([])

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
      .then((r) => { if (!cancelled) setOverview(r) })
      .catch(() => { if (!cancelled) setOverview(null) })
    return () => { cancelled = true }
  }, [from, to])

  // patientId 由「团队概览」点行时直接传入，避免 setSelected 异步导致查到旧患者
  const fetchStats = async (patientId?: string) => {
    const target = patientId ?? selected
    if (!target) return
    setLoading(true)
    try {
      const [r, t, f] = await Promise.all([
        apiFetch<Stats>(`/api/patients/${target}/stats?from=${from}&to=${to}`),
        // 逐日趋势由服务端一次查询返回（此前是前端按天并发发 N 个请求）
        apiFetch<TrendResp>(`/api/patients/${target}/stats/trend?from=${from}&to=${to}`)
          .then((x) => x.points)
          .catch(() => [] as TrendPoint[]),
        // REP-01：随访摘要复用既有接口，前端按统计周期（Asia/Shanghai，左闭右开）过滤
        apiFetch<{ items: Followup[] }>(`/api/patients/${target}/followups?page_size=100`)
          .then((x) => x.items)
          .catch(() => [] as Followup[]),
      ])
      const startMs = Date.parse(`${from}T00:00:00+08:00`)
      const endMs = Date.parse(`${to}T00:00:00+08:00`)
      setStats(r)
      setTrend(t)
      setPeriodFollowups(f.filter((x) => {
        const at = Date.parse(x.followed_at)
        return at >= startMs && at < endMs
      }))
    } catch (e) { message.error((e as Error).message) } finally { setLoading(false) }
  }

  const selectedPatient = patients.find((p) => p.id === selected)
  const overviewRows = overview?.rows ?? []
  const duplicateSlots = stats?.duplicate_slots ?? []
  const taskFollowupCount = periodFollowups.filter((f) => f.task_id).length

  return (
    <div>
      <PageHeader title="统计与核查" />

      {/* 工具行：左筛选，右操作 */}
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          {activeTab === 'report' && (
            <>
              <label htmlFor="stats-patient" className="field-label">患者</label>
              <Select
                id="stats-patient"
                style={{ width: 240 }}
                value={selected ?? undefined}
                placeholder="选择患者"
                options={patients.map(p => ({ value: p.id, label: `${p.display_name} (${p.patient_code})` }))}
                onChange={setSelected}
                showSearch optionFilterProp="label"
              />
            </>
          )}
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
          {activeTab === 'report' && (
            <Button
              type="primary"
              onClick={() => { void fetchStats() }}
              disabled={!selected}
              loading={loading}
            >
              查询
            </Button>
          )}
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'overview' | 'report')}
        items={[
          {
            key: 'overview',
            label: '团队概览',
            children: (
              <>
                <section className="page-section">
                  {/* 团队概览的视觉主角：团队覆盖率 */}
                  <div className="stats-hero">
                    <div>
                      <div className="stats-hero-value">
                        {overview?.coverage_rate == null ? '—' : `${overview.coverage_rate}%`}
                      </div>
                      <div className="stats-hero-caption">
                        团队覆盖率 · {overview ? `${overview.from_} 至 ${overview.to}` : '加载中…'}
                      </div>
                    </div>
                    <div className="stats-hero-facts">
                      <div className="stats-hero-fact">
                        <b>{overview?.total_M ?? 0} / {overview?.total_N ?? 0}</b>
                        <span>有效登记 / 应记录</span>
                      </div>
                      <div className="stats-hero-fact">
                        <b>{overview?.planned_count ?? 0}</b>
                        <span>有固定计划患者</span>
                      </div>
                      <div className="stats-hero-fact">
                        <b>{overview?.patient_count ?? 0}</b>
                        <span>负责患者</span>
                      </div>
                    </div>
                  </div>

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

                {overviewRows.length > 0 && (
                  <section className="page-section">
                    <div className="section-head">
                      <h2 className="section-title">患者登记情况（缺失多在前）</h2>
                      <span className="section-extra">点击行进入患者报告</span>
                    </div>
                    <Table
                      rowKey="patient_id"
                      pagination={false}
                      dataSource={[...overviewRows].sort((a, b) => b.missing_count - a.missing_count)}
                      locale={{ emptyText: '暂无数据' }}
                      onRow={(r) => ({
                        onClick: () => {
                          setSelected(r.patient_id)
                          setActiveTab('report')
                          void fetchStats(r.patient_id)
                        },
                        style: { cursor: 'pointer' },
                      })}
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
                            <span className="coverage-cell">
                              <MiniBar rate={v} />
                              <span className="coverage-value">{v === null ? '暂无计划' : `${v}%`}</span>
                            </span>
                          ),
                          align: 'right' as const,
                        },
                      ]}
                    />
                  </section>
                )}
              </>
            ),
          },
          {
            key: 'report',
            label: '患者报告',
            children: (
              <>
                {!stats && (
                  <section className="page-section" style={{ borderBottom: 'none' }}>
                    <EmptyState
                      title="先选择一位患者"
                      hint="选择患者与统计区间后点击「查询」。"
                    />
                  </section>
                )}

                {stats && (
                  <>
                    <section className="page-section">
                      <div className="section-head">
                        <h2 className="section-title">基础管理报告</h2>
                        <span className="section-extra">
                          患者：{selectedPatient?.display_name ?? '—'}（{selectedPatient?.patient_code ?? '—'}）｜
                          周期：{stats.from_} 至 {stats.to} ｜ 时区：{stats.timezone}
                        </span>
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
                        </div>
                        <Table
                          rowKey="source"
                          dataSource={Object.entries(stats.source_breakdown).map(([k, v]) => ({ source: k, count: v }))}
                          pagination={false}
                          columns={[
                            {
                              title: '来源', dataIndex: 'source',
                              render: (v: string) => v === 'PATIENT_REPORT' ? (
                                <span>
                                  患者自述
                                  <Tag variant="filled" style={{ marginLeft: 8, color: 'var(--warn)' }}>未由设备验证</Tag>
                                </span>
                              ) : v === 'CLINICIAN_OBSERVED' ? '医护观察' : v,
                            },
                            { title: '事件数', dataIndex: 'count' },
                          ]}
                        />
                        <p className="muted" style={{ margin: '12px 0 0' }}>
                          数据来源：固定计划时点与用药登记记录；{stats.source_note}；来源按有效登记事件计数（非去重）。
                        </p>
                      </div>
                    </div>

                    <section className="page-section">
                      <div className="section-head">
                        <h2 className="section-title">随访摘要</h2>
                        <span className="section-extra">
                          共 {periodFollowups.length} 次
                          {taskFollowupCount > 0 ? ` · 关联任务 ${taskFollowupCount} 条` : ''}
                        </span>
                      </div>
                      {periodFollowups.length === 0 ? (
                        <p className="muted" style={{ margin: 0 }}>统计周期内暂无随访记录</p>
                      ) : (
                        <ul className="record-list">
                          {periodFollowups.slice(0, 3).map((f) => (
                            <li key={f.id} className="record-row">
                              <span className="record-main">
                                <span className="strong tabular">{new Date(f.followed_at).toLocaleString('zh-CN')}</span>
                                <span className="record-meta">
                                  {f.feedback ? `反馈：${f.feedback}` : '无反馈记录'}
                                  {f.task_id ? ' · 已关联任务' : ''}
                                </span>
                              </span>
                              <span className="record-meta">{f.action_taken ? `措施：${f.action_taken}` : ''}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {periodFollowups.length > 3 && (
                        <p className="muted" style={{ margin: '8px 0 0' }}>仅展示最近 3 条，完整记录见「随访中心」。</p>
                      )}
                    </section>

                    {duplicateSlots.length > 0 && (
                      <section className="page-section">
                        <div className="section-head">
                          <h2 className="section-title">重复登记（{duplicateSlots.length} 个时点）</h2>
                          <span className="section-extra">同一时点只计一次</span>
                        </div>
                        <Table
                          rowKey="slot_id"
                          dataSource={duplicateSlots}
                          pagination={false}
                          columns={[
                            { title: '应记录时间', dataIndex: 'scheduled_at', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
                            { title: '有效登记条数', dataIndex: 'active_event_count', width: 140, align: 'right' as const },
                          ]}
                        />
                      </section>
                    )}

                    <section className="page-section" style={{ borderBottom: 'none' }}>
                      <div className="section-head">
                        <h2 className="section-title">缺失时点（{stats.missing_slots.length} 个）</h2>
                        <span className="section-extra">仅表示「未发现登记」，不等于漏药</span>
                      </div>
                      {stats.missing_slots.length === 0 ? (
                        <p className="muted" style={{ margin: 0 }}>该区间内无缺失时点</p>
                      ) : (
                        <ul className="missing-times">
                          {stats.missing_slots.map((m) => (
                            <li key={m.slot_id} className="missing-time">
                              {new Date(m.scheduled_at).toLocaleString('zh-CN', {
                                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
                              })}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </>
                )}
              </>
            ),
          },
        ]}
      />
    </div>
  )
}
