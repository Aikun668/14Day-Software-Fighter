import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Select } from 'antd'
import { ApiError, apiFetch } from '../../api/client'
import { PatientAvatar } from '../../components/medix'
import Surface from '../../components/medix/Surface'
import { TrendChart } from '../../components/medix/RegistrationCharts'
import {
  formatCoverage,
  formatShanghaiClock,
  formatShanghaiDayKey,
  inShanghaiWindow,
  type DailyCoverage,
} from './medixClinicalModel'
import { pointsAgree, sourceName, sourceRows, sourceTone } from './patientReportModel'

interface Stats {
  N: number
  M: number
  coverage_rate: number | null
  missing_slots: { slot_id: string; scheduled_at: string; plan_id?: string }[]
  duplicate_slots: { slot_id: string; scheduled_at: string; active_event_count: number }[]
  source_breakdown: Record<string, number>
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
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string; denied?: boolean }
  | { status: 'stale'; message: string }
  | { status: 'success'; data: T }

interface PatientOption {
  id: string
  label: string
  patient_code: string
  display_name: string
}

function errorText(reason: unknown) {
  return reason instanceof Error && reason.message ? reason.message : '请求失败'
}

function isDenied(reason: unknown) {
  return reason instanceof ApiError && (reason.status === 403 || reason.status === 404)
}

function Note({ block, onRetry }: { block: Block<unknown>; onRetry?: () => void }) {
  if (block.status === 'loading' || block.status === 'idle') return <div className="ml-skeleton" aria-busy="true" aria-label="加载中" />
  if (block.status === 'stale') {
    return <p className="ml-inline-error"><span>{block.message}</span>{onRetry ? <button type="button" className="ml-text-btn" onClick={onRetry}>刷新</button> : null}</p>
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

function rateLabel(stats: Stats) {
  if (stats.N < 0 || stats.M < 0 || stats.M > stats.N) return '数据异常'
  if (!(stats.N > 0) || stats.coverage_rate == null) return '—'
  return formatCoverage(stats.coverage_rate)
}

export default function PatientReportPanel({
  selected,
  options,
  from,
  to,
  rangeError,
  visible,
  onSelect,
}: {
  selected: { id: string; name: string; code: string } | null
  options: PatientOption[]
  from: string
  to: string
  rangeError: string | null
  visible: boolean
  onSelect: (patient: { id: string; name: string; code: string }) => void
}) {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Block<Stats>>({ status: 'idle' })
  const [trend, setTrend] = useState<Block<DailyCoverage[]>>({ status: 'idle' })
  const [followups, setFollowups] = useState<Block<{ items: Followup[]; truncated: boolean }>>({ status: 'idle' })
  const [stalePair, setStalePair] = useState(false)
  const [caliber, setCaliber] = useState<'coverage' | 'source' | null>(null)
  const seq = useRef(0)

  const load = async () => {
    if (!selected || rangeError) return
    const my = ++seq.current
    const patientId = selected.id
    setStats({ status: 'loading' })
    setTrend({ status: 'loading' })
    setFollowups({ status: 'loading' })
    setStalePair(false)
    const pull = () => Promise.allSettled([
      apiFetch<Stats>(`/api/patients/${patientId}/stats?from=${from}&to=${to}`),
      apiFetch<{ points: TrendPoint[] }>(`/api/patients/${patientId}/stats/trend?from=${from}&to=${to}`),
    ])
    let [statsResult, trendResult] = await pull()
    if (seq.current !== my) return
    const agreed = statsResult.status === 'fulfilled' && trendResult.status === 'fulfilled'
      && Array.isArray(trendResult.value?.points)
      && pointsAgree(statsResult.value, trendResult.value.points)
    if (statsResult.status === 'fulfilled' && trendResult.status === 'fulfilled' && !agreed) {
      ;[statsResult, trendResult] = await pull()
      if (seq.current !== my) return
    }
    const stillDifferent = statsResult.status === 'fulfilled' && trendResult.status === 'fulfilled'
      && Array.isArray(trendResult.value?.points)
      && !pointsAgree(statsResult.value, trendResult.value.points)
    if (stillDifferent) {
      setStalePair(true)
      setStats({ status: 'stale', message: '数据更新中，请刷新' })
      setTrend({ status: 'stale', message: '数据更新中，请刷新' })
    } else {
      if (statsResult.status === 'fulfilled') setStats({ status: 'success', data: statsResult.value })
      else setStats({ status: 'error', message: errorText(statsResult.reason), denied: isDenied(statsResult.reason) })
      if (trendResult.status === 'fulfilled' && Array.isArray(trendResult.value?.points)) {
        setTrend({
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
        setTrend({ status: 'error', message: errorText(reason), denied: isDenied(reason) })
      }
    }
    try {
      const follow = await loadWindowFollowups(patientId, from, to, () => seq.current === my)
      if (seq.current !== my) return
      setFollowups({ status: 'success', data: follow })
    } catch (error) {
      if (seq.current !== my) return
      setFollowups({ status: 'error', message: errorText(error), denied: isDenied(error) })
    }
  }

  useEffect(() => {
    if (!selected || rangeError) {
      seq.current += 1
      setStats({ status: 'idle' })
      setTrend({ status: 'idle' })
      setFollowups({ status: 'idle' })
      setStalePair(false)
      return
    }
    void load()
    return () => {
      seq.current += 1
    }
    // 患者或区间变化才重取。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, from, to, rangeError])

  const retry = () => { void load() }
  const statsData = stats.status === 'success' ? stats.data : null
  const missing = useMemo(() => {
    const slots = statsData?.missing_slots ?? []
    return [...slots].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  }, [statsData])

  return (
    <div className="ml-report">
      <section className="ml-surface ml-report-identity">
        <div className="ml-report-who">
          {selected ? <PatientAvatar name={selected.name} patientId={selected.id} /> : null}
          <Select
            aria-label="选择患者"
            className="ml-report-select"
            placeholder="请选择患者"
            value={selected?.id}
            showSearch
            options={options.map((patient) => ({ value: patient.id, label: patient.label, code: patient.patient_code }))}
            filterOption={(input, option) => {
              const query = input.trim().toLowerCase()
              return String(option?.label ?? '').toLowerCase().includes(query)
                || String(option?.code ?? '').toLowerCase().includes(query)
            }}
            onChange={(id) => {
              const found = options.find((patient) => patient.id === id)
              if (!found) return
              onSelect({ id: found.id, name: found.display_name, code: found.patient_code })
            }}
          />
        </div>
        {!selected ? <p className="ml-empty">请选择患者</p> : null}
        {selected && statsData ? (
          <div className="ml-report-metrics">
            <span><small>登记覆盖</small><strong>{rateLabel(statsData)}</strong></span>
            <span><small>已登记 / 应记录</small><strong>{statsData.M} / {statsData.N}</strong></span>
            <span><small>未发现登记</small><strong>{Array.isArray(statsData.missing_slots) ? statsData.missing_slots.length : '数据异常'}</strong></span>
          </div>
        ) : null}
        {selected && stats.status !== 'success' ? <Note block={stats} onRetry={retry} /> : null}
      </section>

      {!selected ? null : (
        <>
          <Surface
            title="每日登记覆盖"
            actions={
              <button type="button" className="ml-info-btn" aria-expanded={caliber === 'coverage'} onClick={() => setCaliber((value) => value === 'coverage' ? null : 'coverage')}>i</button>
            }
          >
            {caliber === 'coverage' ? <p className="ml-caliber">登记覆盖不等于实际服药依从性</p> : null}
            {stalePair ? <p className="ml-inline-error"><span>数据更新中，请刷新</span><button type="button" className="ml-text-btn" onClick={retry}>刷新</button></p> : null}
            {!stalePair && trend.status === 'success' ? <TrendChart points={trend.data} visible={visible} /> : null}
            {!stalePair && trend.status !== 'success' ? <Note block={trend} onRetry={retry} /> : null}
          </Surface>

          <div className="ml-report-grid ml-report-split">
            <Surface title="未发现登记时点">
              {stats.status === 'success' ? <MissingList slots={missing} /> : <Note block={stats} onRetry={retry} />}
            </Surface>
            <Surface
              title="登记来源"
              actions={
                <button type="button" className="ml-info-btn" aria-expanded={caliber === 'source'} onClick={() => setCaliber((value) => value === 'source' ? null : 'source')}>i</button>
              }
            >
              {caliber === 'source' ? <p className="ml-caliber">按有效登记事件计数，非去重；患者自述未由设备验证</p> : null}
              {stats.status === 'success' ? <SourceBars breakdown={stats.data.source_breakdown} /> : <Note block={stats} onRetry={retry} />}
            </Surface>
          </div>

          <Surface
            title="随访摘要"
            actions={
              <button type="button" className="ml-text-btn" onClick={() => navigate(`/followups?patientId=${selected.id}`)}>查看全部</button>
            }
          >
            {followups.status === 'success' ? <FollowupTable items={followups.data.items} truncated={followups.data.truncated} /> : <Note block={followups} onRetry={retry} />}
          </Surface>

          {stats.status === 'error' || stats.status === 'stale' ? (
            <Surface title="重复登记"><Note block={stats} onRetry={retry} /></Surface>
          ) : null}
          {statsData && statsData.duplicate_slots.length > 0 ? (
            <Surface title="重复登记">
              <div className="ml-table-wrap">
                <table className="ml-table">
                  <thead>
                    <tr><th scope="col">应记录时间</th><th scope="col">有效登记条数</th></tr>
                  </thead>
                  <tbody>
                    {[...statsData.duplicate_slots].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)).map((slot) => (
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
      )}
    </div>
  )
}

function MissingList({ slots }: { slots: { slot_id: string; scheduled_at: string }[] }) {
  const [open, setOpen] = useState(false)
  if (slots.length === 0) return <p className="ml-empty">暂无未登记时点</p>
  const shown = open ? slots : slots.slice(0, 5)
  const clocks = new Map<string, number>()
  for (const slot of slots) clocks.set(slot.scheduled_at, (clocks.get(slot.scheduled_at) ?? 0) + 1)
  const byDay = new Map<string, number>()
  for (const slot of slots) {
    const day = formatShanghaiDayKey(slot.scheduled_at)
    if (day) byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }
  const max = Math.max(...byDay.values(), 1)
  return (
    <div>
      {slots.length > 8 ? (
        <div className="ml-miss-bars" aria-hidden="true">
          {[...byDay.entries()].map(([day, count]) => (
            <div key={day} className="ml-miss-col">
              <span className="ml-miss-count">{count}</span>
              <span className="ml-miss-plot"><span className="ml-miss-bar" style={{ height: `${Math.max((count / max) * 100, 8)}%` }} /></span>
              <span className="ml-miss-day">{day.slice(5)}</span>
            </div>
          ))}
        </div>
      ) : null}
      <ul className="ml-miss-lines">
        {shown.map((slot) => (
          <li key={slot.slot_id}>
            <span className="ml-miss-tick" aria-hidden="true" />
            <span>{formatShanghaiClock(slot.scheduled_at)}{(clocks.get(slot.scheduled_at) ?? 0) > 1 ? ` · ${slot.slot_id.slice(0, 8)}` : ''}</span>
          </li>
        ))}
      </ul>
      {slots.length > 5 ? (
        <button type="button" className="ml-text-btn" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? '收起' : `查看全部 ${slots.length} 个`}
        </button>
      ) : null}
    </div>
  )
}

function SourceBars({ breakdown }: { breakdown: Record<string, number> | null | undefined }) {
  if (!breakdown || Object.keys(breakdown).length === 0) return <p className="ml-empty">暂无来源记录</p>
  const rows = sourceRows(breakdown)
  if (rows.length === 0 || rows.every((row) => row.count === 0)) return <p className="ml-empty">暂无来源记录</p>
  return (
    <div className="ml-source-list">
      {rows.map((row) => (
        <div key={row.source} className="ml-source-row">
          <span>{sourceName(row.source)}</span>
          <span className="ml-source-track" aria-hidden="true">
            <span className={`ml-source-fill is-${sourceTone(row.source)}${row.count === 0 ? ' is-zero' : ''}`} style={{ width: `${row.width * 100}%` }} />
          </span>
          <strong>{row.count}</strong>
        </div>
      ))}
    </div>
  )
}

function FollowupTable({ items, truncated }: { items: Followup[]; truncated: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (truncated && items.length === 0) return <p className="ml-hint">仅已加载记录</p>
  if (items.length === 0) return <p className="ml-empty">暂无随访记录</p>
  const shown = [...items].sort((a, b) => b.followed_at.localeCompare(a.followed_at)).slice(0, 3)
  return (
    <div className="ml-table-wrap">
      <table className="ml-table">
        <thead>
          <tr>
            <th scope="col">时间</th>
            <th scope="col">反馈</th>
            <th scope="col">措施</th>
            <th scope="col">后续</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((item) => (
            <tr key={item.id}>
              <th scope="row">{formatShanghaiClock(item.followed_at)}</th>
              <td><Clamp text={item.feedback} open={openId === `${item.id}-f`} onToggle={() => setOpenId((value) => value === `${item.id}-f` ? null : `${item.id}-f`)} /></td>
              <td><span className="ml-chip is-action">{item.action_taken?.trim() || '—'}</span></td>
              <td><span className="ml-chip is-next">{item.next_plan?.trim() || '—'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {truncated ? <p className="ml-hint">仅已加载记录</p> : null}
    </div>
  )
}

function Clamp({ text, open, onToggle }: { text: string | null; open: boolean; onToggle: () => void }) {
  const value = text?.trim() || '—'
  if (value === '—' || value.length < 36) return <>{value}</>
  return (
    <div>
      <p className={open ? 'ml-clamp is-open' : 'ml-clamp'}>{value}</p>
      <button type="button" className="ml-text-btn" aria-expanded={open} onClick={onToggle}>{open ? '收起' : '展开'}</button>
    </div>
  )
}

async function loadWindowFollowups(patientId: string, from: string, exclusiveTo: string, alive: () => boolean) {
  const kept: Followup[] = []
  let page = 1
  let total = 0
  let passedStart = false
  while (page <= 20) {
    const result = await apiFetch<{ items: Followup[]; total: number }>(`/api/patients/${patientId}/followups?page=${page}&page_size=100`)
    if (!alive()) return { items: kept, truncated: false }
    if (!result || !Array.isArray(result.items) || typeof result.total !== 'number') throw new Error('随访列表不可用')
    total = result.total
    for (const item of result.items) {
      if (inShanghaiWindow(item.followed_at, from, exclusiveTo)) kept.push(item)
      const at = Date.parse(item.followed_at)
      if (Number.isFinite(at) && at < Date.parse(`${from}T00:00:00+08:00`)) passedStart = true
    }
    const loaded = Math.min(page * 100, total)
    if (kept.length >= 4 || passedStart || loaded >= total || result.items.length === 0) {
      return { items: kept, truncated: false }
    }
    page += 1
  }
  return { items: kept, truncated: true }
}
