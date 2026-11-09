import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DatePicker, Select } from 'antd'
import dayjs from 'dayjs'
import { ApiError, apiFetch } from '../../api/client'
import CoverageHeatmap, { type MatrixResponse } from '../../components/CoverageHeatmap'
import { MedixPageHeading, PatientAvatar, PatientIdentity } from '../../components/medix'
import { CoverageDonut, TrendChart } from '../../components/medix/RegistrationCharts'
import Surface from '../../components/medix/Surface'
import { collectPages } from './medixPaging'
import {
  aggregateDailyCoverage,
  civilDate,
  formatCoverage,
  formatShanghaiClock,
  formatShanghaiDayKey,
  inShanghaiWindow,
  looksLikeDemo,
  makeStatsWindow,
  numbersToCivil,
  recentInclusiveWindow,
  totalsMatch,
  withDisambiguation,
  type DailyCoverage,
} from './medixClinicalModel'
import '../../styles/medix-clinical.css'

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

interface Patient {
  id: string
  patient_code: string
  display_name: string
}

interface PatientRef {
  id: string
  name: string
  code: string
}

interface DuplicateSlot {
  slot_id: string
  scheduled_at: string
  active_event_count: number
}

interface Stats {
  from_: string
  to: string
  timezone: string
  N: number
  M: number
  coverage_rate: number | null
  missing_slots: { slot_id: string; scheduled_at: string }[]
  duplicate_slots: DuplicateSlot[]
  source_breakdown: Record<string, number>
  source_note: string
}

interface TrendPoint {
  day: string
  N: number
  M: number
  coverage_rate: number | null
}

interface Followup {
  id: string
  followed_at: string
  feedback: string | null
  action_taken: string | null
  next_plan: string | null
}

type Block<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string; denied?: boolean }
  | { status: 'stale'; message: string }
  | { status: 'success'; data: T }

const ROSTER_STEP = 5

function errorText(reason: unknown) {
  return reason instanceof Error && reason.message ? reason.message : '请求失败'
}

function isDenied(reason: unknown) {
  return reason instanceof ApiError && (reason.status === 403 || reason.status === 404)
}

function asDay(value: dayjs.Dayjs | null | undefined) {
  if (!value) return null
  return numbersToCivil(value.year(), value.month(), value.date())
}

function BlockNote({ block, onRetry }: { block: Block<unknown>; onRetry?: () => void }) {
  if (block.status === 'loading') return <div className="ml-skeleton" aria-busy="true" aria-label="加载中" />
  if (block.status === 'stale') {
    return (
      <p className="ml-inline-error">
        <span>{block.message}</span>
        {onRetry ? <button type="button" className="ml-text-btn" onClick={onRetry}>刷新</button> : null}
      </p>
    )
  }
  if (block.status === 'error') {
    return (
      <p className="ml-inline-error">
        <span className="ml-field-error">{block.denied ? '不可访问' : '加载失败'}</span>
        {!block.denied && onRetry ? <button type="button" className="ml-text-btn" onClick={onRetry}>重试</button> : null}
      </p>
    )
  }
  return null
}

function RateCell({ row }: { row: CoverageRow }) {
  if (!(row.N > 0) || row.coverage_rate == null) {
    return <span className="ml-coverage"><span className="ml-coverage-track" /><span>—</span></span>
  }
  if (row.M > row.N || row.M < 0) return <span>数据异常</span>
  const width = Math.max(0, Math.min(row.coverage_rate, 100))
  return (
    <span className="ml-coverage">
      <span className="ml-coverage-track" aria-hidden="true">
        <span className="ml-coverage-fill" style={{ width: `${width}%` }} />
      </span>
      <span>{formatCoverage(row.coverage_rate)}</span>
    </span>
  )
}

function sourceName(source: string) {
  if (source === 'PATIENT_REPORT') return '患者自述'
  if (source === 'CLINICIAN_OBSERVED') return '医护观察'
  return source
}

function MissingPanel({ slots }: { slots: { slot_id: string; scheduled_at: string }[] }) {
  const [open, setOpen] = useState(false)
  if (slots.length === 0) return <p className="ml-empty">该区间无未发现登记时点</p>
  const byDay = new Map<string, number>()
  for (const slot of slots) {
    const day = formatShanghaiDayKey(slot.scheduled_at)
    if (!day) continue
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }
  const days = [...byDay.entries()]
  const max = Math.max(...days.map(([, count]) => count), 1)
  return (
    <div>
      <div className="ml-miss-bars" aria-hidden="true">
        {days.map(([day, count]) => (
          <div key={day} className="ml-miss-col">
            <span className="ml-miss-count">{count}</span>
            <span className="ml-miss-plot">
              <span className="ml-miss-bar" style={{ height: `${Math.max((count / max) * 100, 8)}%` }} />
            </span>
            <span className="ml-miss-day">{day.slice(5)}</span>
          </div>
        ))}
      </div>
      <button type="button" className="ml-text-btn" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? '收起时间' : '展开完整时间'}
      </button>
      {open ? (
        <ul className="ml-slot-pills">
          {slots.map((slot) => (
            <li key={slot.slot_id} className="ml-slot-pill">{formatShanghaiClock(slot.scheduled_at)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default function StatsPage() {
  const navigate = useNavigate()
  const alive = useRef(true)
  const teamSeq = useRef(0)
  const reportSeq = useRef(0)
  const initial = recentInclusiveWindow(Date.now())
  const [tab, setTab] = useState<'overview' | 'report'>('overview')
  const [startDay, setStartDay] = useState(initial.start)
  const [endDay, setEndDay] = useState(initial.end)
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [windowKey, setWindowKey] = useState(() => makeStatsWindow(initial.start, initial.end))
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientsNote, setPatientsNote] = useState<string | null>(null)
  const [overview, setOverview] = useState<Block<Overview>>({ status: 'loading' })
  const [matrix, setMatrix] = useState<Block<MatrixResponse>>({ status: 'loading' })
  const [rosterCount, setRosterCount] = useState(ROSTER_STEP)
  const [matrixOpen, setMatrixOpen] = useState(false)
  const [caliberOpen, setCaliberOpen] = useState(false)
  const [sourceNoteOpen, setSourceNoteOpen] = useState(false)
  const [selected, setSelected] = useState<PatientRef | null>(null)
  const [reportStats, setReportStats] = useState<Block<Stats>>({ status: 'loading' })
  const [reportTrend, setReportTrend] = useState<Block<DailyCoverage[]>>({ status: 'loading' })
  const [reportFollowups, setReportFollowups] = useState<Block<{ items: Followup[]; truncated: boolean }>>({ status: 'loading' })

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      teamSeq.current += 1
      reportSeq.current += 1
    }
  }, [])

  const loadPatients = async () => {
    try {
      const result = await collectPages<Patient>(
        (page, pageSize) => apiFetch<{ items: Patient[]; total: number }>(`/api/patients?page=${page}&page_size=${pageSize}`),
        { alive: () => alive.current },
      )
      if (!alive.current) return
      setPatients(result.items)
      setPatientsNote(result.complete ? null : `患者目录仅已加载 ${result.items.length} / ${result.total} 位`)
    } catch (error) {
      if (!alive.current) return
      setPatientsNote(errorText(error))
    }
  }

  const loadTeam = async (from: string, to: string) => {
    const seq = ++teamSeq.current
    setOverview({ status: 'loading' })
    setMatrix({ status: 'loading' })
    setRosterCount(ROSTER_STEP)
    const query = `from=${from}&to=${to}`
    const pull = () => Promise.allSettled([
      apiFetch<Overview>(`/api/stats/overview?${query}`),
      apiFetch<MatrixResponse>(`/api/stats/matrix?${query}`),
    ])
    let [overviewResult, matrixResult] = await pull()
    if (!alive.current || seq !== teamSeq.current) return
    const matched = overviewResult.status === 'fulfilled'
      && matrixResult.status === 'fulfilled'
      && totalsMatch(overviewResult.value, matrixResult.value)
    if (overviewResult.status === 'fulfilled' && matrixResult.status === 'fulfilled' && !matched) {
      ;[overviewResult, matrixResult] = await pull()
      if (!alive.current || seq !== teamSeq.current) return
    }
    const stillDifferent = overviewResult.status === 'fulfilled'
      && matrixResult.status === 'fulfilled'
      && !totalsMatch(overviewResult.value, matrixResult.value)
    if (stillDifferent) {
      const stale = { status: 'stale' as const, message: '数据更新中，请刷新' }
      setOverview(stale)
      setMatrix(stale)
      return
    }
    if (overviewResult.status === 'fulfilled' && Array.isArray(overviewResult.value?.rows)) {
      setOverview({ status: 'success', data: overviewResult.value })
    } else {
      const reason = overviewResult.status === 'rejected' ? overviewResult.reason : new Error('统计概览不可用')
      setOverview({ status: 'error', message: errorText(reason), denied: isDenied(reason) })
    }
    if (matrixResult.status === 'fulfilled' && Array.isArray(matrixResult.value?.days) && Array.isArray(matrixResult.value?.rows)) {
      setMatrix({ status: 'success', data: matrixResult.value })
    } else {
      const reason = matrixResult.status === 'rejected' ? matrixResult.reason : new Error('登记明细不可用')
      setMatrix({ status: 'error', message: errorText(reason), denied: isDenied(reason) })
    }
  }

  useEffect(() => {
    void loadPatients()
    void loadTeam(windowKey.from, windowKey.to)
    // 目录只取一次；区间由 applyRange 触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyRange = (nextStart: string, nextEnd: string) => {
    setStartDay(nextStart)
    setEndDay(nextEnd)
    try {
      const next = makeStatsWindow(nextStart, nextEnd)
      setRangeError(null)
      setWindowKey(next)
      void loadTeam(next.from, next.to)
      if (selected) void loadReport(selected.id, next.from, next.to)
    } catch (error) {
      const text = error instanceof Error ? error.message : '日期无效'
      setRangeError(text)
      setOverview({ status: 'error', message: text })
      setMatrix({ status: 'error', message: text })
      teamSeq.current += 1
    }
  }

  const loadReport = async (patientId: string, from: string, to: string) => {
    const seq = ++reportSeq.current
    setReportStats({ status: 'loading' })
    setReportTrend({ status: 'loading' })
    setReportFollowups({ status: 'loading' })
    const [statsResult, trendResult, followResult] = await Promise.allSettled([
      apiFetch<Stats>(`/api/patients/${patientId}/stats?from=${from}&to=${to}`),
      apiFetch<{ points: TrendPoint[] }>(`/api/patients/${patientId}/stats/trend?from=${from}&to=${to}`),
      loadWindowFollowups(patientId, from, to, () => alive.current && seq === reportSeq.current),
    ])
    if (!alive.current || seq !== reportSeq.current) return
    if (statsResult.status === 'fulfilled') setReportStats({ status: 'success', data: statsResult.value })
    else setReportStats({ status: 'error', message: errorText(statsResult.reason), denied: isDenied(statsResult.reason) })
    if (trendResult.status === 'fulfilled' && Array.isArray(trendResult.value?.points)) {
      setReportTrend({
        status: 'success',
        data: trendResult.value.points.map((point) => ({
          day: point.day,
          N: point.N,
          M: point.M,
          coverage_rate: point.N > 0 ? point.coverage_rate : null,
          anomaly: point.M > point.N || point.N < 0 || point.M < 0 ? '数据异常' : undefined,
        })),
      })
    } else {
      const reason = trendResult.status === 'rejected' ? trendResult.reason : new Error('趋势不可用')
      setReportTrend({ status: 'error', message: errorText(reason), denied: isDenied(reason) })
    }
    if (followResult.status === 'fulfilled' && followResult.value) setReportFollowups({ status: 'success', data: followResult.value })
    else setReportFollowups({ status: 'error', message: errorText(followResult.status === 'rejected' ? followResult.reason : new Error('随访不可用')) })
  }

  const openReport = (patient: PatientRef) => {
    setSelected(patient)
    setTab('report')
    if (!rangeError) void loadReport(patient.id, windowKey.from, windowKey.to)
  }

  const daily = useMemo(
    () => (matrix.status === 'success' ? aggregateDailyCoverage(matrix.data) : []),
    [matrix],
  )
  const rows = overview.status === 'success' ? overview.data.rows : []
  const shownRows = rows.slice(0, rosterCount)
  const rosterRemain = rows.length - shownRows.length
  const patientOptions = useMemo(() => {
    const labeled = withDisambiguation(patients)
    if (selected && !labeled.some((patient) => patient.id === selected.id)) {
      labeled.unshift({ id: selected.id, patient_code: selected.code, display_name: selected.name, label: selected.name })
    }
    return labeled
  }, [patients, selected])
  const demo = looksLikeDemo(rows.map((row) => `${row.display_name} ${row.patient_code}`))
  const retryTeam = () => {
    if (!rangeError) void loadTeam(windowKey.from, windowKey.to)
  }

  return (
    <div className="ml-stats">
      <MedixPageHeading
        title="统计与核查"
        date={demo ? <span className="ml-demo-pill">演示数据</span> : undefined}
        actions={
          <div className="ml-stats-tools">
            <DatePicker.RangePicker
              allowClear={false}
              value={[dayjs(civilDate(startDay)), dayjs(civilDate(endDay))]}
              onChange={(values) => {
                const nextStart = asDay(values?.[0])
                const nextEnd = asDay(values?.[1])
                if (nextStart && nextEnd) applyRange(nextStart, nextEnd)
              }}
            />
            <Button onClick={() => {
              const recent = recentInclusiveWindow(Date.now())
              applyRange(recent.start, recent.end)
            }}
            >
              近 7 日
            </Button>
          </div>
        }
      />
      {rangeError ? <p className="ml-field-error" role="alert">{rangeError}</p> : null}
      {patientsNote ? <p className="ml-hint">{patientsNote}</p> : null}

      <div className="ml-tabs" role="tablist">
        <button type="button" className="ml-tab" role="tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}>团队概览</button>
        <button type="button" className="ml-tab" role="tab" aria-selected={tab === 'report'} onClick={() => setTab('report')}>患者报告</button>
      </div>

      <div className="ml-stack" hidden={tab !== 'overview'}>
        <Surface>
            {overview.status === 'success' ? (
              <div className="ml-summary">
                <span className="ml-summary-rate">
                  登记覆盖率
                  <strong>{overview.data.total_N > 0 ? formatCoverage(overview.data.coverage_rate) : '—'}</strong>
                </span>
                <span className="ml-summary-counts">已登记 {overview.data.total_M} / 应记录 {overview.data.total_N}</span>
                <button
                  type="button"
                  className="ml-info-btn"
                  aria-expanded={caliberOpen}
                  aria-controls="ml-caliber"
                  onClick={() => setCaliberOpen((open) => !open)}
                >
                  i
                </button>
              </div>
            ) : <BlockNote block={overview} onRetry={retryTeam} />}
            {caliberOpen ? <p id="ml-caliber" className="ml-caliber">基于登记记录，不等于实际服药依从性</p> : null}
          </Surface>

        <div className="ml-chart-grid">
          <Surface title="逐日登记覆盖率">
            {matrix.status === 'success' ? <TrendChart points={daily} visible={tab === 'overview'} /> : <BlockNote block={matrix} onRetry={retryTeam} />}
          </Surface>
          <Surface title="登记分布">
            {overview.status === 'success' ? (
              <CoverageDonut
                registered={overview.data.total_M}
                expected={overview.data.total_N}
                rate={overview.data.coverage_rate}
                anomaly={overview.data.total_M > overview.data.total_N || overview.data.total_N < 0}
                visible={tab === 'overview'}
              />
            ) : <BlockNote block={overview} onRetry={retryTeam} />}
          </Surface>
        </div>

        <Surface
          title="患者登记概览"
          actions={
            <button type="button" className="ml-text-btn" aria-expanded={matrixOpen} onClick={() => setMatrixOpen((open) => !open)}>
              {matrixOpen ? '收起登记明细' : '登记明细'}
            </button>
          }
        >
          {overview.status === 'success' && rows.length === 0 ? <p className="ml-empty">暂无患者</p> : null}
          {overview.status === 'success' && rows.length > 0 ? (
            <div className="ml-table-wrap">
              <table className="ml-table">
                <thead>
                  <tr>
                    <th scope="col">患者</th>
                    <th scope="col">已登记</th>
                    <th scope="col">应记录</th>
                    <th scope="col">登记覆盖率</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {shownRows.map((row) => (
                    <tr key={row.patient_id}>
                      <th scope="row">
                        <PatientIdentity
                          name={row.display_name}
                          avatar={<PatientAvatar name={row.display_name} patientId={row.patient_id} />}
                        />
                      </th>
                      <td>{row.M}</td>
                      <td>{row.N}</td>
                      <td><RateCell row={row} /></td>
                      <td>
                        <button
                          type="button"
                          className="ml-text-btn"
                          onClick={() => openReport({ id: row.patient_id, name: row.display_name, code: row.patient_code })}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {overview.status !== 'success' ? <BlockNote block={overview} onRetry={retryTeam} /> : null}
          {overview.status === 'success' && (rosterRemain > 0 || rosterCount > ROSTER_STEP) ? (
            <div className="ml-fold-row">
              {rosterRemain > 0 ? (
                <button type="button" className="ml-fold" onClick={() => setRosterCount((count) => Math.min(rows.length, count + ROSTER_STEP))}>
                  展开更多（还剩 {rosterRemain}）
                </button>
              ) : null}
              {rosterCount > ROSTER_STEP ? (
                <button type="button" className="ml-fold" onClick={() => setRosterCount(ROSTER_STEP)}>收起</button>
              ) : null}
            </div>
          ) : null}
          {matrixOpen ? (
            <div style={{ marginTop: '1.25rem' }}>
              {matrix.status === 'success' ? (
                <CoverageHeatmap appearance="medix" days={matrix.data.days} rows={matrix.data.rows} onPatient={(id) => {
                  const row = matrix.data.rows.find((item) => item.patient_id === id)
                  if (!row) return
                  openReport({ id: row.patient_id, name: row.display_name, code: row.patient_code })
                }}
                />
              ) : <BlockNote block={matrix} onRetry={retryTeam} />}
            </div>
          ) : null}
        </Surface>
      </div>

      <div className="ml-stack" hidden={tab !== 'report'}>
        <Surface
          title="患者报告"
          actions={
            <SelectPatient
              options={patientOptions}
              value={selected?.id}
              onChange={(id) => {
                const found = patientOptions.find((patient) => patient.id === id)
                if (!found) return
                openReport({ id: found.id, name: found.display_name, code: found.patient_code })
              }}
            />
          }
        >
          {!selected ? <p className="ml-empty">选择一位患者，查看这段时间的登记覆盖。</p> : null}
          {selected && reportStats.status === 'success' ? (
            <div className="ml-summary">
              <span className="ml-summary-rate">
                登记覆盖率
                <strong>{reportStats.data.N > 0 ? formatCoverage(reportStats.data.coverage_rate) : '—'}</strong>
              </span>
              <span className="ml-summary-counts">
                {selected.name} · 已登记 {reportStats.data.M} / 应记录 {reportStats.data.N}
              </span>
            </div>
          ) : null}
          {selected && reportStats.status !== 'success' ? <BlockNote block={reportStats} onRetry={() => void loadReport(selected.id, windowKey.from, windowKey.to)} /> : null}
        </Surface>

        {selected ? (
          <>
            <Surface title="逐日覆盖率">
              {reportTrend.status === 'success'
                ? <TrendChart points={reportTrend.data} visible={tab === 'report'} />
                : <BlockNote block={reportTrend} onRetry={() => void loadReport(selected.id, windowKey.from, windowKey.to)} />}
            </Surface>
            <div className="ml-report-grid">
              <Surface title="未发现登记时点">
                {reportStats.status === 'success'
                  ? <MissingPanel slots={reportStats.data.missing_slots} />
                  : <BlockNote block={reportStats} onRetry={() => void loadReport(selected.id, windowKey.from, windowKey.to)} />}
              </Surface>
              <Surface
                title="登记来源"
                actions={
                  <button type="button" className="ml-text-btn" aria-expanded={sourceNoteOpen} onClick={() => setSourceNoteOpen((open) => !open)}>
                    口径
                  </button>
                }
              >
                {sourceNoteOpen ? <p className="ml-caliber">按有效登记事件计数；患者自述未由设备验证</p> : null}
                {reportStats.status === 'success' ? (
                  <div className="ml-table-wrap">
                    <table className="ml-table">
                      <thead>
                        <tr>
                          <th scope="col">来源</th>
                          <th scope="col">事件数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(reportStats.data.source_breakdown).length === 0 ? (
                          <tr><td colSpan={2}>该区间没有来源记录</td></tr>
                        ) : Object.entries(reportStats.data.source_breakdown).map(([source, count]) => (
                          <tr key={source}>
                            <th scope="row">{sourceName(source)}</th>
                            <td>{count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <BlockNote block={reportStats} onRetry={() => void loadReport(selected.id, windowKey.from, windowKey.to)} />}
              </Surface>
            </div>
            <Surface
              title="随访摘要"
              actions={selected ? (
                <button type="button" className="ml-text-btn" onClick={() => navigate(`/followups?patientId=${selected.id}`)}>
                  查看全部
                </button>
              ) : null}
            >
              {reportFollowups.status === 'success' ? (
                reportFollowups.data.truncated && reportFollowups.data.items.length === 0
                  ? <p className="ml-hint">仅已加载记录</p>
                  : reportFollowups.data.items.length === 0
                    ? <p className="ml-empty">暂无随访记录</p>
                    : (
                      <>
                        <ul className="ml-plan-list">
                          {reportFollowups.data.items.slice(0, 3).map((item) => (
                            <li key={item.id} className="ml-plan-item">
                              <div className="ml-plan-line">
                                <span>{formatShanghaiClock(item.followed_at)}</span>
                              </div>
                              <div className="ml-plan-meta">
                                <span>{item.feedback?.trim() || '—'}</span>
                                <span>{item.action_taken?.trim() || '—'}</span>
                                <span>{item.next_plan?.trim() || '—'}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                        {reportFollowups.data.truncated ? <p className="ml-hint">仅已加载记录</p> : null}
                      </>
                    )
              ) : <BlockNote block={reportFollowups} onRetry={() => void loadReport(selected.id, windowKey.from, windowKey.to)} />}
            </Surface>
            {reportStats.status === 'success' && reportStats.data.duplicate_slots.length > 0 ? (
              <Surface title="重复登记">
                <div className="ml-table-wrap">
                  <table className="ml-table">
                    <thead>
                      <tr>
                        <th scope="col">应记录时间</th>
                        <th scope="col">有效登记条数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportStats.data.duplicate_slots.map((slot) => (
                        <tr key={slot.slot_id}>
                          <th scope="row">{formatShanghaiClock(slot.scheduled_at)}</th>
                          <td>{slot.active_event_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Surface>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

function SelectPatient({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string; patient_code: string }>
  value?: string
  onChange: (id: string) => void
}) {
  return (
    <Select
      aria-label="选择患者"
      style={{ minWidth: '15rem' }}
      placeholder="选择患者"
      value={value}
      showSearch
      options={options.map((patient) => ({ value: patient.id, label: patient.label, code: patient.patient_code }))}
      filterOption={(input, option) => {
        const query = input.trim().toLowerCase()
        return String(option?.label ?? '').toLowerCase().includes(query)
          || String(option?.code ?? '').toLowerCase().includes(query)
      }}
      onChange={onChange}
    />
  )
}

async function loadWindowFollowups(
  patientId: string,
  from: string,
  exclusiveTo: string,
  alive: () => boolean,
): Promise<{ items: Followup[]; truncated: boolean }> {
  const kept: Followup[] = []
  let page = 1
  let total = 0
  let passedStart = false
  while (page <= 20) {
    const result = await apiFetch<{ items: Followup[]; total: number }>(
      `/api/patients/${patientId}/followups?page=${page}&page_size=100`,
    )
    if (!alive()) return { items: kept, truncated: false }
    if (!result || !Array.isArray(result.items) || typeof result.total !== 'number') {
      throw new Error('随访列表不可用')
    }
    total = result.total
    for (const item of result.items) {
      if (inShanghaiWindow(item.followed_at, from, exclusiveTo)) kept.push(item)
      const at = Date.parse(item.followed_at)
      if (Number.isFinite(at) && at < Date.parse(`${from}T00:00:00+08:00`)) passedStart = true
    }
    const loaded = page * result.items.length === 0 ? total : Math.min(page * 100, total)
    if (kept.length >= 4 || passedStart || loaded >= total || result.items.length === 0) {
      return { items: kept, truncated: false }
    }
    page += 1
  }
  return { items: kept, truncated: true }
}
