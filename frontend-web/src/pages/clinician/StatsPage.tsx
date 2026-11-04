import { useEffect, useRef, useState } from 'react'
import { Button, DatePicker, message, Select, Tabs, Tag } from 'antd'
import dayjs from 'dayjs'
import { apiFetch } from '../../api/client'
import CoverageHeatmap, { type MatrixResponse } from '../../components/CoverageHeatmap'
import CoverageTrendChart from '../../components/CoverageTrendChart'
import { Card, HeroBar } from '../../components/clinic'

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

function formatRate(rate: number | null) {
  return rate === null ? '—' : `${rate}%`
}

/** 登记表里的覆盖率：细条 + 数字，用来上下比较，不是摘要卡。 */
function CoverageCell({ rate }: { rate: number | null }) {
  const v = rate === null ? 0 : Math.min(rate, 100)
  return (
    <span className="cc-coverage">
      <span className="cc-coverage-track" aria-hidden="true">
        <span className="cc-coverage-fill" style={{ width: `${v}%` }} />
      </span>
      <span className="cc-coverage-value">{rate === null ? '暂无计划' : `${rate}%`}</span>
    </span>
  )
}

/** 缺失时点按日分布。柱子用软蓝，数字用墨色，不把缺失涂成惩罚色。 */
function MissingBars({ missing }: { missing: { scheduled_at: string }[] }) {
  if (missing.length === 0) {
    return <p className="cc-empty-line">该区间内无缺失时点</p>
  }
  const byDay = new Map<string, number>()
  for (const m of missing) {
    const day = new Date(m.scheduled_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    byDay.set(day, (byDay.get(day) || 0) + 1)
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  const max = Math.max(...days.map(([, n]) => n))

  return (
    <div className="cc-miss-chart" aria-label="缺失时点按日分布">
      <div className="cc-miss-bars">
        {days.map(([day, n]) => (
          <div key={day} className="cc-miss-col">
            <span className="cc-miss-count">{n}</span>
            <span className="cc-miss-plot">
              <span className="cc-miss-bar" style={{ height: `${Math.max((n / max) * 100, 12)}%` }} />
            </span>
            <span className="cc-miss-day">{day}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function sourceLabel(source: string) {
  if (source === 'PATIENT_REPORT') {
    return (
      <span>
        患者自述
        <Tag variant="filled" style={{ marginLeft: 8, color: 'var(--warn)', background: 'var(--warn-soft)', border: 0 }}>未由设备验证</Tag>
      </span>
    )
  }
  if (source === 'CLINICIAN_OBSERVED') return '医护观察'
  return source
}

const slotTime = (iso: string) => new Date(iso).toLocaleString('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
})

/** 与随访中心 VISIBLE_STEP 相同：登记情况默认先露缺失最多的这么多行。 */
const ROSTER_STEP = 5

// M04 统计与核查（J032）
// 干活页：看团队覆盖矩阵和登记情况，或打开一位患者的报告。不是摘要仪表盘。
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
  const [rosterCount, setRosterCount] = useState(ROSTER_STEP)
  const reportSeq = useRef(0)

  const fetchPatients = async () => {
    try {
      const r = await apiFetch<{ items: Patient[] }>('/api/patients?page_size=100')
      setPatients(r.items)
    } catch (e) { message.error((e as Error).message) }
  }

  useEffect(() => { fetchPatients() }, [])

  // 换日期后登记表回到默认 5 行，避免上一区间展开的行数套到新数据上
  useEffect(() => { setRosterCount(ROSTER_STEP) }, [from, to])

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
    const seq = ++reportSeq.current
    setLoading(true)
    setStats(null)
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
      if (seq !== reportSeq.current) return
      const startMs = Date.parse(`${from}T00:00:00+08:00`)
      const endMs = Date.parse(`${to}T00:00:00+08:00`)
      setStats(r)
      setTrend(t)
      setPeriodFollowups(f.filter((x) => {
        const at = Date.parse(x.followed_at)
        return at >= startMs && at < endMs
      }))
    } catch (e) {
      if (seq === reportSeq.current) message.error((e as Error).message)
    } finally {
      if (seq === reportSeq.current) setLoading(false)
    }
  }

  // 已打开报告时，改日期就按同一患者重查，避免表格已换区间、报告还停在旧区间
  useEffect(() => {
    if (activeTab !== 'report' || !selected) return
    void fetchStats(selected)
    // fetchStats 读取当次渲染的 from/to/selected；只在区间变化时重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to])

  const openReport = (patientId: string) => {
    setSelected(patientId)
    setActiveTab('report')
    void fetchStats(patientId)
  }

  const resetRange = () => {
    setFrom(dayjs().subtract(7, 'day').format('YYYY-MM-DD'))
    setTo(dayjs().format('YYYY-MM-DD'))
  }

  const selectedPatient = patients.find((p) => p.id === selected)
  const overviewRows = [...(overview?.rows ?? [])].sort((a, b) => b.missing_count - a.missing_count)
  const rosterShown = overviewRows.slice(0, rosterCount)
  const rosterRemain = overviewRows.length - rosterShown.length
  const rosterOpened = rosterCount > ROSTER_STEP && overviewRows.length > ROSTER_STEP
  const duplicateSlots = stats?.duplicate_slots ?? []

  return (
    <div className="cc-page cc-stats-page">
      <HeroBar
        eyebrow={`${from} 至 ${to}`}
        title="统计与核查"
        sub="选好日期后，在团队概览里看矩阵和登记表，或打开一位患者的报告。"
      />

      <div className="cc-stats-tools">
        <label className="cc-stats-label" htmlFor="stats-from">开始</label>
        <DatePicker
          id="stats-from"
          value={dayjs(from)}
          onChange={(d) => d && setFrom(d.format('YYYY-MM-DD'))}
          placeholder="开始日期"
          allowClear={false}
        />
        <label className="cc-stats-label" htmlFor="stats-to">结束</label>
        <DatePicker
          id="stats-to"
          value={dayjs(to)}
          onChange={(d) => d && setTo(d.format('YYYY-MM-DD'))}
          placeholder="结束日期"
          allowClear={false}
        />
        <Button onClick={resetRange}>重置为近 7 日</Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          const next = key as 'overview' | 'report'
          setActiveTab(next)
          if (next === 'report' && selected) void fetchStats(selected)
        }}
        items={[
          {
            key: 'overview',
            label: '团队概览',
            children: (
              <div className="cc-stack">
                <p className="cc-stats-meta" aria-label="团队覆盖摘要">
                  <span><b>{formatRate(overview?.coverage_rate ?? null)}</b>团队覆盖</span>
                  <span>已登记 {overview?.total_M ?? 0} / 应记录 {overview?.total_N ?? 0}</span>
                  <span>有固定计划 {overview?.planned_count ?? 0}</span>
                  <span>负责患者 {overview?.patient_count ?? 0}</span>
                </p>

                <Card title="覆盖矩阵" hint="负责患者 × 日期 · 仅已到期时点">
                  {matrix ? (
                    <CoverageHeatmap
                      days={matrix.days}
                      rows={matrix.rows}
                      onPatient={openReport}
                    />
                  ) : (
                    <p className="cc-empty-line">加载中…</p>
                  )}
                </Card>

                <Card title="登记情况" hint="缺失多的在前 · 点一行看报告">
                  {overviewRows.length === 0 ? (
                    <p className="cc-empty-line">{overview ? '该区间没有可列出的患者。' : '加载中…'}</p>
                  ) : (
                    <div className="cc-roster-wrap">
                      <table className="cc-roster">
                        <thead>
                          <tr>
                            <th scope="col">患者</th>
                            <th scope="col" className="num">应记录 N</th>
                            <th scope="col" className="num">已登记 M</th>
                            <th scope="col" className="num">缺失</th>
                            <th scope="col" className="num">覆盖率</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rosterShown.map((row) => (
                            <tr
                              key={row.patient_id}
                              className="clickable"
                              tabIndex={0}
                              onClick={() => openReport(row.patient_id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  openReport(row.patient_id)
                                }
                              }}
                            >
                              <th scope="row">
                                <span className="cc-roster-name">
                                  {row.display_name}
                                  <span>{row.patient_code}</span>
                                </span>
                              </th>
                              <td className="num">{row.N}</td>
                              <td className="num">{row.M}</td>
                              <td className="num">{row.missing_count}</td>
                              <td className="num"><CoverageCell rate={row.coverage_rate} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {(rosterRemain > 0 || rosterOpened) && (
                    <div className="cc-batch-actions">
                      {rosterRemain > 0 && (
                        <button
                          type="button"
                          className="cc-expand-toggle"
                          onClick={() => setRosterCount((n) => Math.min(overviewRows.length, n + ROSTER_STEP))}
                        >
                          展开更多（还剩 {rosterRemain}）
                        </button>
                      )}
                      {rosterOpened && (
                        <button
                          type="button"
                          className="cc-expand-toggle cc-batch-collapse"
                          onClick={() => setRosterCount(ROSTER_STEP)}
                        >
                          收起
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            ),
          },
          {
            key: 'report',
            label: '患者报告',
            children: (
              <div className="cc-stack">
                <div className="cc-stats-tools cc-stats-pick">
                  <label className="cc-stats-label" htmlFor="stats-patient">患者</label>
                  <Select
                    id="stats-patient"
                    style={{ minWidth: 240 }}
                    value={selected ?? undefined}
                    placeholder="选择患者"
                    aria-label="选择患者"
                    options={patients.map(p => ({ value: p.id, label: `${p.display_name} (${p.patient_code})` }))}
                    onChange={(id) => openReport(id)}
                    showSearch
                    optionFilterProp="label"
                  />
                </div>

                {!selected && !loading && (
                  <Card title="患者报告">
                    <p className="cc-plan-empty">选择一位患者，查看这段时间的覆盖、缺失时点与来源。</p>
                  </Card>
                )}

                {selected && loading && (
                  <Card title="患者报告">
                    <p className="cc-empty-line">加载中…</p>
                  </Card>
                )}

                {selected && !loading && !stats && (
                  <Card title="患者报告">
                    <p className="cc-empty-line">这份报告还没有出来。再选一次患者，或改一下日期。</p>
                  </Card>
                )}

                {stats && selectedPatient && (
                  <>
                    <div className="cc-stats-lead">
                      <p className="cc-stats-meta" aria-label="患者覆盖摘要">
                        <span><b>{formatRate(stats.coverage_rate)}</b>覆盖率</span>
                        <span>已登记 {stats.M} / 应记录 {stats.N}</span>
                        <span>缺失 {stats.missing_slots.length}</span>
                        <span>{selectedPatient.display_name} · {selectedPatient.patient_code}</span>
                      </p>
                      <p className="cc-stats-note">{stats.disclaimer}</p>
                    </div>

                    <Card title="逐日覆盖率" hint={`${stats.from_} 至 ${stats.to} · ${stats.timezone}`}>
                      <CoverageTrendChart trend={trend} />
                    </Card>

                    <Card title="缺失时点" hint={`${stats.missing_slots.length} 个 · 未发现登记，不等于漏药`}>
                      <MissingBars missing={stats.missing_slots} />
                      {stats.missing_slots.length > 0 && (
                        <ul className="missing-times">
                          {stats.missing_slots.map((m) => (
                            <li key={m.slot_id} className="missing-time">{slotTime(m.scheduled_at)}</li>
                          ))}
                        </ul>
                      )}
                    </Card>

                    <Card title="来源分布" hint="按有效登记事件计数，非去重">
                      <div className="cc-roster-wrap">
                        <table className="cc-roster">
                          <thead>
                            <tr>
                              <th scope="col">来源</th>
                              <th scope="col" className="num">事件数</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.keys(stats.source_breakdown).length === 0 ? (
                              <tr>
                                <td colSpan={2}><span className="cc-empty-line">该区间没有来源记录</span></td>
                              </tr>
                            ) : Object.entries(stats.source_breakdown).map(([source, count]) => (
                              <tr key={source}>
                                <th scope="row">{sourceLabel(source)}</th>
                                <td className="num">{count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="cc-empty-line" style={{ marginTop: 12 }}>
                        来源：计划时点 + 用药登记；按有效登记事件计数（非去重）。
                      </p>
                    </Card>

                    <Card title="随访摘要" hint={periodFollowups.length > 3 ? '最近 3 条' : undefined}>
                      {periodFollowups.length === 0 ? (
                        <p className="cc-empty-line">统计周期内暂无随访记录</p>
                      ) : (
                        <ul className="cc-record-list">
                          {periodFollowups.slice(0, 3).map((f) => (
                            <li key={f.id}>
                              <div className="cc-record-main">
                                <strong>{new Date(f.followed_at).toLocaleString('zh-CN')}</strong>
                                <span>
                                  {f.feedback ? `反馈：${f.feedback}` : '无反馈记录'}
                                  {f.task_id ? ' · 已关联任务' : ''}
                                </span>
                              </div>
                              <span className="cc-record-side">{f.action_taken ? `措施：${f.action_taken}` : ''}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {periodFollowups.length > 3 && (
                        <p className="cc-empty-line" style={{ marginTop: 8 }}>仅展示最近 3 条，完整记录见「随访中心」。</p>
                      )}
                    </Card>

                    {duplicateSlots.length > 0 && (
                      <Card title="重复登记" hint={`${duplicateSlots.length} 个时点`}>
                        <div className="cc-roster-wrap">
                          <table className="cc-roster">
                            <thead>
                              <tr>
                                <th scope="col">应记录时间</th>
                                <th scope="col" className="num">有效登记条数</th>
                              </tr>
                            </thead>
                            <tbody>
                              {duplicateSlots.map((slot) => (
                                <tr key={slot.slot_id}>
                                  <th scope="row">{new Date(slot.scheduled_at).toLocaleString('zh-CN')}</th>
                                  <td className="num">{slot.active_event_count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    )}
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
