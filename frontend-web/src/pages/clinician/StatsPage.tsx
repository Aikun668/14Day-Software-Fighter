import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, DatePicker } from 'antd'
import dayjs from 'dayjs'
import { ApiError, apiFetch } from '../../api/client'
import CoverageHeatmap, { type MatrixResponse } from '../../components/CoverageHeatmap'
import { MedixPageHeading, PatientAvatar, PatientIdentity } from '../../components/medix'
import { CoverageDonut, TrendChart } from '../../components/medix/RegistrationCharts'
import Surface from '../../components/medix/Surface'
import PatientReportPanel from './PatientReportPanel'
import { collectPages } from './medixPaging'
import {
  aggregateDailyCoverage,
  civilDate,
  formatCoverage,
  looksLikeDemo,
  makeStatsWindow,
  numbersToCivil,
  recentInclusiveWindow,
  totalsMatch,
  withDisambiguation,
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


export default function StatsPage() {
  const alive = useRef(true)
  const teamSeq = useRef(0)
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
  const [selected, setSelected] = useState<PatientRef | null>(null)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      teamSeq.current += 1
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
    } catch (error) {
      const text = error instanceof Error ? error.message : '日期无效'
      setRangeError(text)
      setOverview({ status: 'error', message: text })
      setMatrix({ status: 'error', message: text })
      teamSeq.current += 1
    }
  }


  const openReport = (patient: PatientRef) => {
    setSelected(patient)
    setTab('report')
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
        <PatientReportPanel
          selected={selected}
          options={patientOptions}
          from={windowKey.from}
          to={windowKey.to}
          rangeError={rangeError}
          visible={tab === 'report'}
          onSelect={openReport}
        />
      </div>
    </div>
  )
}

