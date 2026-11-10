import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, DatePicker, Modal, Select } from 'antd'
import { RightOutlined, AuditOutlined, FileTextOutlined, MedicineBoxOutlined, ProfileOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import * as echarts from 'echarts'
import { PageHeading } from '../../components/medix/Medix'
import { ClinicalPanel, InfoHint, LoadError } from '../../components/medix/ClinicalUI'
import { addDays, shanghaiDay, shanghaiParts } from '../../components/medix/clinical'
import { useClinicalQuery } from '../../components/medix/useClinicalQuery'
import { actionLabel, auditDay, auditKinds, eventKind, readAuditRange, redactDetail, type AuditEvent } from './auditData'

function AuditChart({ labels, values, colors, horizontal = false }: { labels: string[]; values: number[]; colors: string[]; horizontal?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!root.current) return
    const el = root.current, chart = echarts.init(el), style = getComputedStyle(el)
    const fontSize = Number.parseFloat(style.fontSize), fontFamily = style.fontFamily
    const axisLabel = { fontSize, fontFamily, color: '#697180', hideOverlap: true }
    const numberSpace = Math.max(38, String(Math.max(0, ...values)).length * fontSize * .7 + 14)
    chart.setOption({
      animation: false, textStyle: { fontFamily: style.fontFamily, fontSize, color: '#697180' },
      grid: horizontal ? { left: 90, right: numberSpace, top: 12, bottom: 25 } : { left: numberSpace, right: 14, top: 26, bottom: 32 },
      tooltip: { trigger: 'axis', renderMode: 'richText', confine: true },
      xAxis: horizontal ? { type: 'value', min: 0, minInterval: 1, axisLabel, splitLine: { show: false }, axisLine: { show: true, lineStyle: { color: '#D9DDE5' } } } : { type: 'category', data: labels, axisLabel, axisTick: { show: false }, axisLine: { lineStyle: { color: '#D9DDE5' } } },
      yAxis: horizontal ? { type: 'category', data: labels, inverse: true, axisLabel, axisTick: { show: false }, axisLine: { show: false } } : { type: 'value', min: 0, minInterval: 1, axisLabel, splitLine: { lineStyle: { color: '#EEF0F3' } } },
      series: [{ type: 'bar', barMaxWidth: horizontal ? 16 : 50, showBackground: horizontal, backgroundStyle: { color: '#F3F4F6', borderRadius: 3 }, label: { show: true, position: horizontal ? 'right' : 'top', color: '#424650', fontSize, fontFamily }, itemStyle: { borderRadius: horizontal ? [3, 3, 3, 3] : [4, 4, 0, 0] }, data: values.map((value, i) => ({ value, itemStyle: { color: colors[i] } })) }],
    })
    const resize = () => {
      chart.resize()
      if (horizontal) chart.setOption({ xAxis: { splitNumber: el.clientWidth < 400 ? 2 : 4 } })
      else chart.setOption({ series: [{ label: { show: (el.clientWidth - numberSpace - 14) / Math.max(1, values.length) >= 32 } }] })
    }
    const observer = new ResizeObserver(resize); observer.observe(el); resize()
    let disposed = false
    void document.fonts.ready.then(() => { if (!disposed) chart.resize() })
    return () => { disposed = true; observer.disconnect(); chart.dispose() }
  }, [labels, values, colors, horizontal])
  return <div ref={root} className="ml-audit-chart" role="img" aria-label={horizontal ? '操作类型数量图；完整数值见下方数据表' : '每日操作次数图；完整数值见下方数据表'} />
}
export default function AuditPanel() {
  const [range, setRange] = useState<[string, string]>(() => { const today = shanghaiDay(); return [addDays(today, -7), addDays(today, -1)] })
  const [kind, setKind] = useState('all'), [visible, setVisible] = useState(4), [detail, setDetail] = useState<AuditEvent | null>(null)
  const loader = useCallback((signal: AbortSignal) => readAuditRange(range[0], range[1], signal), [range])
  const query = useClinicalQuery(range.join(':'), loader)
  const events = useMemo(() => (query.data?.events ?? []).filter(e => kind === 'all' || eventKind(e.action) === kind), [query.data, kind])
  const days = useMemo(() => { const result: string[] = []; for (let d = range[0]; d <= range[1]; d = addDays(d, 1)) result.push(d); return result }, [range])
  const counts = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const event of events) { const day = auditDay(event); byDay.set(day, (byDay.get(day) ?? 0) + 1) }
    return days.map(day => byDay.get(day) ?? 0)
  }, [days, events])
  const categories = useMemo(() => auditKinds.map(k => ({ ...k, count: events.filter(e => eventKind(e.action) === k.key).length })).filter(k => k.count > 0), [events])
  const shown = events.slice(0, visible), groupNames = [...new Set(shown.map(auditDay))]
  const selectedLabel = auditKinds.find(k => k.key === kind)?.label
  const chartLabels = useMemo(() => days.map(d => d.slice(5).replace('-', '/')), [days])
  const chartColors = useMemo(() => days.map((_, i) => i === days.length - 1 ? '#3185ED' : '#A9CFFF'), [days])
  const typeLabels = useMemo(() => categories.map(c => c.label), [categories]), typeCounts = useMemo(() => categories.map(c => c.count), [categories]), typeColors = useMemo(() => categories.map(c => c.color), [categories])
  const changeRange = (dates: [Dayjs | null, Dayjs | null] | null) => { if (dates?.[0] && dates[1]) { setRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]); setVisible(4) } }
  return <div className="ml-page ml-admin ml-audit-page">
    <PageHeading title="审计日志"><DatePicker.RangePicker allowClear={false} aria-label="审计日期范围" value={[dayjs(range[0]), dayjs(range[1])]} onChange={changeRange} /><Button aria-label="刷新审计" icon={<ReloadOutlined aria-hidden />} onClick={query.retry} /></PageHeading>
    {query.error ? <LoadError error={query.error} retry={query.retry} /> : query.loading ? <section className="ml-surface"><p className="ml-empty">正在读取区间记录…</p></section> : !query.data?.complete ? <section className="ml-surface"><LoadError error={query.data?.reason ?? '区间统计不可用'} retry={query.retry} /></section> : <section className="ml-surface ml-audit-charts">
      <div className="ml-audit-chart-column"><div className="ml-audit-chart-heading"><h2>操作趋势</h2><span>合计 {events.length} 次{selectedLabel ? ` · ${selectedLabel}` : ''}</span><InfoHint label="审计读取口径">读取截至 {query.data.asOf ? shanghaiParts(query.data.asOf).day + ' ' + shanghaiParts(query.data.asOf).time : '—'}（上海时间）。分页读取期间可能有新事件，按当前已验证区间展示。</InfoHint></div><AuditChart labels={chartLabels} values={counts} colors={chartColors} /></div>
      <div className="ml-audit-chart-column"><div className="ml-audit-chart-heading"><h2>操作类型</h2></div>{categories.length ? <AuditChart labels={typeLabels} values={typeCounts} colors={typeColors} horizontal /> : <p className="ml-empty">暂无记录</p>}</div>
      <details className="ml-audit-data"><summary>查看图表数据</summary><div className="ml-table-wrap"><table className="ml-table"><thead><tr><th>日期</th><th>次数</th></tr></thead><tbody>{days.map((d, i) => <tr key={d}><td>{d}</td><td>{counts[i]}</td></tr>)}</tbody></table><table className="ml-table"><thead><tr><th>类型</th><th>次数</th></tr></thead><tbody>{categories.map(c => <tr key={c.key}><td>{c.label}</td><td>{c.count}</td></tr>)}</tbody></table></div></details>
    </section>}
    {!query.loading && <ClinicalPanel title={query.data?.complete ? '事件记录' : '已加载记录'} className="ml-audit-records" actions={<Select aria-label="审计事件类型" value={kind} onChange={v => { setKind(v); setVisible(4) }} options={[{ value: 'all', label: '全部类型' }, ...auditKinds.map(k => ({ value: k.key, label: k.label }))]} />}>
      {groupNames.map(group => <div key={group}><h3 className="ml-audit-date">{group === '时间异常' ? group : `${Number(group.slice(5, 7))}月${Number(group.slice(8))}日`}</h3>{shown.filter(e => auditDay(e) === group).map(e => { const k = eventKind(e.action), Icon = k === 'review' ? AuditOutlined : k === 'publish' ? FileTextOutlined : k === 'model' ? MedicineBoxOutlined : ProfileOutlined; return <button key={e.id} className="ml-audit-event" onClick={() => setDetail(e)}><time>{Number.isFinite(Date.parse(e.created_at)) ? shanghaiParts(e.created_at).time : '—'}</time><span className={`ml-audit-icon is-${k}`}><Icon aria-hidden /></span><span>{actionLabel(e.action)}</span><RightOutlined aria-hidden /></button> })}</div>)}
      {!events.length && <p className="ml-empty">{query.data?.complete ? '暂无记录' : '暂无已加载记录'}</p>}
      {visible < events.length && <div className="ml-audit-more"><button className="ml-text-button" onClick={() => setVisible(v => v + 20)}>{query.data?.complete ? `查看全部 ${events.length} 条` : `展开已加载 ${events.length} 条`} <RightOutlined aria-hidden /></button></div>}
    </ClinicalPanel>}
    {detail && <Modal open centered width="40rem" title="事件详情" rootClassName="ml-theme ml-action-dialog ml-admin-modal" onCancel={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>关闭</Button>}><dl className="ml-audit-details">
      {[['时间', Number.isFinite(Date.parse(detail.created_at)) ? shanghaiParts(detail.created_at).day + ' ' + shanghaiParts(detail.created_at).time : `时间异常：${detail.created_at}`], ['动作', actionLabel(detail.action)], ['原始动作', detail.action], ['资源类型', detail.resource_type], ['资源ID', detail.resource_id], ['操作者ID', detail.actor_id ?? '—']].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      <div><dt>详细内容</dt><dd>{detail.detail ? <><p className="ml-admin-hint">{JSON.stringify(redactDetail(detail.detail)).includes('已隐藏') ? '敏感字段已隐藏' : ''}{/[?？]{2,}|�/.test(String(detail.detail.reason ?? '')) ? ' 原始内容异常' : ''}</p><details open><summary>原始字段</summary><pre>{JSON.stringify(redactDetail(detail.detail), null, 2)}</pre></details></> : '—'}</dd></div>
    </dl></Modal>}
  </div>
}

