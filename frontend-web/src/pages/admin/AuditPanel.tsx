import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, DatePicker, Select } from 'antd'
import dayjs from 'dayjs'
import { apiFetch } from '../../api/client'
import {
  CATEGORY_LABEL,
  actionLabel,
  categoryOf,
  loadAuditWindow,
  summarizeAudit,
  type AuditCategory,
  type AuditEvent,
  type AuditPage,
  type AuditWindowResult,
} from './auditModel'
import { civilDate, numbersToCivil, recentInclusiveWindow, shanghaiNowIso, shanghaiParts } from '../clinician/medixClinicalModel'
import AuditCharts from './AuditCharts'

const SENSITIVE = /password|token|secret|authorization/i

function asDay(value: dayjs.Dayjs | null | undefined) {
  if (!value) return null
  return numbersToCivil(value.year(), value.month(), value.date())
}

function clock(iso: string) {
  const parts = shanghaiParts(Date.parse(iso))
  if (!parts) return '时间异常'
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

function dayKey(iso: string) {
  return shanghaiParts(Date.parse(iso))?.date ?? ''
}

export default function AuditPanel() {
  const [startDay, setStartDay] = useState(() => recentInclusiveWindow().start)
  const [endDay, setEndDay] = useState(() => recentInclusiveWindow().end)
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [result, setResult] = useState<AuditWindowResult | null>(null)
  const [filter, setFilter] = useState<AuditCategory | 'all'>('all')
  const [shown, setShown] = useState(4)
  const [active, setActive] = useState<AuditEvent | null>(null)
  const [tick, setTick] = useState(0)
  const seq = useRef(0)

  useEffect(() => {
    if (rangeError) return
    const controller = new AbortController()
    const my = ++seq.current
    setPhase('loading')
    setShown(4)
    loadAuditWindow(
      startDay,
      endDay,
      (page, signal) => apiFetch<AuditPage>(`/api/admin/audit-logs?page=${page}&page_size=100`, { signal }),
      controller.signal,
    )
      .then((next) => {
        if (seq.current !== my) return
        setResult(next)
        setPhase('ready')
        setError('')
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || seq.current !== my) return
        setPhase('error')
        setError(reason instanceof Error ? reason.message : '加载失败')
        setResult(null)
      })
    return () => controller.abort()
  }, [startDay, endDay, rangeError, tick])

  const summary = useMemo(() => {
    if (!result?.complete) return null
    return summarizeAudit(result.events, startDay, endDay, filter)
  }, [result, startDay, endDay, filter])

  const loadedSummary = useMemo(() => {
    if (!result || result.complete) return null
    return summarizeAudit(result.events, startDay, endDay, filter)
  }, [result, startDay, endDay, filter])

  const visible = summary?.visibleEvents ?? []
  const anomalies = summary?.anomalies ?? []
  const rows = visible.slice(0, shown)

  const applyRange = (nextStart: string, nextEnd: string) => {
    if (nextEnd < nextStart) {
      setRangeError('结束日期不能早于开始日期')
      return
    }
    setRangeError(null)
    setStartDay(nextStart)
    setEndDay(nextEnd)
    setFilter('all')
  }

  const reasonText = result?.reason === 'unstable'
    ? '数据更新中，请刷新'
    : result?.reason === 'incomplete'
      ? '区间数据未完整读取，请缩小日期范围'
      : '区间数据未完整读取'

  return (
    <section className="ml-admin-view ml-audit">
      <header className="ml-admin-head">
        <h1>审计日志</h1>
        <div className="ml-admin-tools">
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
          >近 7 日</Button>
        </div>
      </header>
      {rangeError ? <p className="ml-field-error" role="alert">{rangeError}</p> : null}
      <div className="ml-admin-sheet">
        {phase === 'loading' ? <div className="ml-skeleton" aria-busy="true" aria-label="加载中" /> : null}
        {phase === 'error' ? (
          <p className="ml-inline-error">
            <span className="ml-field-error">加载失败</span>
            <span>{error}</span>
            <button type="button" className="ml-text-btn" onClick={() => setTick((value) => value + 1)}>重试</button>
          </p>
        ) : null}
        {phase === 'ready' && result?.complete && summary && summary.total === 0 && anomalies.length === 0 && filter === 'all' ? <p className="ml-empty">暂无记录</p> : null}
        {phase === 'ready' && result?.complete && summary && (summary.total > 0 || filter !== 'all') ? (
          <>
            <p className="ml-hint">读取截至 {result.readAt}</p>
            {summary.total > 0 ? <AuditCharts summary={summary} /> : <p className="ml-empty">该类型暂无记录</p>}
          </>
        ) : null}
        {phase === 'ready' && result && !result.complete ? (
          <p className="ml-inline-error">
            <span className="ml-field-error">{reasonText}</span>
            <button type="button" className="ml-text-btn" onClick={() => setTick((value) => value + 1)}>重试</button>
          </p>
        ) : null}
      </div>

      {phase === 'ready' && result?.complete && summary && (summary.total > 0 || anomalies.length > 0 || filter !== 'all') ? (
        <EventStream
          events={rows}
          total={visible.length}
          anomalies={anomalies}
          shown={shown}
          filter={filter}
          onFilter={setFilter}
          onMore={() => setShown((count) => count + 20)}
          onOpen={setActive}
        />
      ) : null}
      {phase === 'ready' && result && !result.complete ? (
        <section className="ml-admin-sheet">
          <h2>已加载记录</h2>
          <p className="ml-hint">下面只是已读到的记录，不是完整区间。{loadedSummary ? `已加载 ${loadedSummary.total} 条。` : ''}</p>
          <EventList events={(loadedSummary?.visibleEvents ?? []).slice(0, shown)} onOpen={setActive} />
        </section>
      ) : null}

      <EventDetail event={active} onClose={() => setActive(null)} />
    </section>
  )
}

function EventStream({
  events,
  total,
  anomalies,
  shown,
  filter,
  onFilter,
  onMore,
  onOpen,
}: {
  events: AuditEvent[]
  total: number
  anomalies: AuditEvent[]
  shown: number
  filter: AuditCategory | 'all'
  onFilter: (value: AuditCategory | 'all') => void
  onMore: () => void
  onOpen: (event: AuditEvent) => void
}) {
  const groups = new Map<string, AuditEvent[]>()
  for (const event of events) {
    const day = dayKey(event.created_at) || '时间异常'
    const list = groups.get(day) ?? []
    list.push(event)
    groups.set(day, list)
  }
  return (
    <section className="ml-admin-sheet">
      <header className="ml-admin-head">
        <h2>事件记录</h2>
        <Select
          aria-label="操作类型"
          value={filter}
          style={{ minWidth: '9rem' }}
          options={[
            { value: 'all', label: '全部类型' },
            ...(['account', 'review', 'publish', 'model', 'other'] as AuditCategory[]).map((category) => ({
              value: category,
              label: CATEGORY_LABEL[category],
            })),
          ]}
          onChange={(value) => onFilter(value)}
        />
      </header>
      {[...groups.entries()].map(([day, items]) => (
        <div key={day}>
          <h3 className="ml-audit-day">{day}</h3>
          <EventList events={items} onOpen={onOpen} />
        </div>
      ))}
      {anomalies.length > 0 ? <p className="ml-hint">另有 {anomalies.length} 条时间异常，未计入图表。</p> : null}
      {shown < total ? (
        <button type="button" className="ml-fold" onClick={onMore}>查看全部 {total} 条</button>
      ) : null}
    </section>
  )
}

function EventList({ events, onOpen }: { events: AuditEvent[]; onOpen: (event: AuditEvent) => void }) {
  return (
    <ul className="ml-audit-list">
      {events.map((event) => (
        <li key={event.id}>
          <button type="button" className="ml-audit-row" onClick={() => onOpen(event)}>
            <span className="ml-audit-time">{clock(event.created_at)}</span>
            <span className={`ml-audit-mark is-${categoryOf(event.action)}`} aria-hidden="true" />
            <span className="ml-audit-action">{actionLabel(event.action)}</span>
            <span className="ml-audit-go" aria-hidden="true">›</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function EventDetail({ event, onClose }: { event: AuditEvent | null; onClose: () => void }) {
  const when = event ? shanghaiParts(Date.parse(event.created_at)) : null
  const stamp = when
    ? `${when.date} ${String(when.hour).padStart(2, '0')}:${String(when.minute).padStart(2, '0')}:${String(when.second).padStart(2, '0')}`
    : '时间异常'
  return (
    <div className={`ml-audit-detail${event ? ' is-open' : ''}`} hidden={!event}>
      {event ? (
        <div className="ml-admin-sheet" role="dialog" aria-modal="false" aria-label="审计详情">
          <header className="ml-admin-head">
            <h2>事件详情</h2>
            <button type="button" className="ml-text-btn" onClick={onClose}>关闭</button>
          </header>
          <dl className="ml-detail-list">
            <div><dt>时间</dt><dd>{stamp}</dd></div>
            <div><dt>动作</dt><dd>{actionLabel(event.action)}</dd></div>
            <div><dt>原始动作</dt><dd>{event.action}</dd></div>
            <div><dt>资源类型</dt><dd>{event.resource_type}</dd></div>
            <div><dt>资源 ID</dt><dd>{event.resource_id}</dd></div>
            <div><dt>操作者</dt><dd>{event.actor_id || '—'}</dd></div>
            <div><dt>详情</dt><dd><DetailBody value={event.detail} /></dd></div>
          </dl>
          <p className="ml-sr">当前读取时刻 {shanghaiNowIso()}</p>
        </div>
      ) : null}
    </div>
  )
}

function DetailBody({ value }: { value: unknown }) {
  if (value == null) return <>—</>
  if (typeof value !== 'object') return <>{String(value)}</>
  if (Array.isArray(value)) return <pre>{JSON.stringify(value, null, 2)}</pre>
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return <>—</>
  return (
    <dl className="ml-detail-list">
      {entries.map(([key, item]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{SENSITIVE.test(key) ? '已遮掩' : <Plain value={item} />}</dd>
        </div>
      ))}
    </dl>
  )
}

function Plain({ value }: { value: unknown }) {
  if (value == null) return <>—</>
  if (typeof value === 'string') {
    if (value.includes('\uFFFD') || value.includes('�')) {
      return (<><span>原始内容异常</span><pre>{value}</pre></>)
    }
    return <>{value}</>
  }
  if (typeof value === 'number' || typeof value === 'boolean') return <>{String(value)}</>
  return <pre>{JSON.stringify(value, null, 2)}</pre>
}
