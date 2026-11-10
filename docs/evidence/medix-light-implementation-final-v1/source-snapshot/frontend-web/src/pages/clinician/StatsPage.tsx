import { useClinicalQuery } from '../../components/medix/useClinicalQuery'
import { useCallback, useState } from 'react'
import { Button, DatePicker } from 'antd'
import { DownOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import CoverageTrendChart from '../../components/CoverageTrendChart'
import { PageHeading, PatientIdentity } from '../../components/medix/Medix'
import { ClinicalPanel, InfoHint, LoadError, PatientPicker } from '../../components/medix/ClinicalUI'
import { addDays, fetchAll, isDemoPatient, rateText, shanghaiDay, shanghaiParts, shortTime, type MedixPatient } from '../../components/medix/clinical'
import { readFollowups, readReport, readTeam, type CoverageRow, type Matrix } from '../../components/medix/stats'

const coverageNote = '基于登记记录，不等于实际服药依从性。'
function CoverageBar({ rate }: { rate: number | null }) {
  return <span className="ml-coverage-bar"><span className="ml-bar-track" aria-hidden="true"><i style={{ width: `${rate ?? 0}%` }} /></span><span>{rateText(rate)}</span></span>
}
function TeamMatrix({ matrix, openReport }: { matrix: Matrix; openReport: (row: CoverageRow) => void }) {
  return <ClinicalPanel title="登记明细"><div className="ml-table-wrap"><table className="ml-table ml-team-matrix"><thead><tr><th>患者</th>{matrix.days.map(d => <th key={d}>{d.slice(5)}</th>)}</tr></thead><tbody>{matrix.rows.map(row => <tr key={row.patient_id}><td><button className="ml-text-button" onClick={() => openReport(row)}>{row.display_name}</button></td>{matrix.days.map(day => { const c = row.cells.find(c => c.day === day)!; const kind = c.N === 0 ? 'none' : c.M === c.N ? 'all' : c.M === 0 ? 'missing' : 'partial'; return <td key={day}><span className={`ml-matrix-value ml-cell-${kind}`} title={`${day} 已登记 ${c.M} / 应记录 ${c.N}`}>{c.N === 0 ? '—' : `${c.M}/${c.N}`}</span></td> })}</tr>)}</tbody></table></div></ClinicalPanel>
}
function TeamOverview({ from, to, patients, openReport }: { from: string; to: string; patients: MedixPatient[]; openReport: (row: CoverageRow) => void }) {
  const query = useClinicalQuery(`${from}-${to}`, useCallback(signal => readTeam(from, to, signal), [from, to]))
  const [shown, setShown] = useState(5), [details, setDetails] = useState(false)
  if (query.loading) return <div className="ml-empty">加载中…</div>
  if (query.error) return <LoadError error={query.error} retry={query.retry} />
  const data = query.data!
  if (data.mismatch) return <LoadError error={data.mismatch} retry={query.retry} />
  const overview = data.overview.data, matrix = data.matrix.data
  const rows = [...(overview?.rows ?? [])].sort((a, b) => Number(a.N === 0) - Number(b.N === 0) || b.missing_count - a.missing_count || a.patient_code.localeCompare(b.patient_code))
  return <div className="ml-stats-stack">
    {data.overview.error ? <LoadError error={`团队统计：${data.overview.error}`} retry={query.retry} /> : overview && <div className="ml-summary-strip ml-team-summary" aria-label="团队登记覆盖摘要"><span>登记覆盖 <strong>{rateText(overview.coverage_rate)}</strong></span><span>已登记 {overview.total_M} / 应记录 {overview.total_N}</span><InfoHint>{coverageNote}</InfoHint></div>}
    <div className="ml-team-charts"><ClinicalPanel title="每日登记覆盖">{matrix ? <CoverageTrendChart trend={matrix.points} /> : <LoadError error={data.matrix.error || '趋势加载失败'} retry={query.retry} />}</ClinicalPanel>
      <ClinicalPanel title="登记构成" actions={overview && <InfoHint label="登记构成数据">已登记 {overview.total_M}（{rateText(overview.coverage_rate)}），未发现登记 {overview.total_N - overview.total_M}（{overview.coverage_rate === null ? "—" : `${Math.round((100 - overview.coverage_rate) * 10) / 10}%`}）。</InfoHint>}>{overview ? <div className="ml-donut-layout"><div className={`ml-donut${overview.total_N === 0 ? ' ml-donut-empty' : ''}`} style={{ background: overview.total_N > 0 ? `conic-gradient(var(--ml-teal) 0 ${overview.coverage_rate}%, var(--ml-apricot) ${overview.coverage_rate}% 100%)` : undefined }} role="img" aria-label={`登记覆盖 ${rateText(overview.coverage_rate)}，已登记 ${overview.total_M}，未发现登记 ${overview.total_N - overview.total_M}`}><span>{rateText(overview.coverage_rate)}</span></div><div className="ml-donut-legend"><span><i className="ml-key-teal" />已登记 <b>{overview.total_M}</b></span><span><i className="ml-key-apricot" />未发现登记 <b>{overview.total_N - overview.total_M}</b></span>{overview.total_N === 0 && <span>无到期时点</span>}</div></div> : <LoadError error={data.overview.error || '统计加载失败'} retry={query.retry} />}</ClinicalPanel></div>
    <ClinicalPanel title="患者登记概览" actions={<button type="button" className="ml-text-button" onClick={() => setDetails(v => !v)}>{details ? '收起明细' : '登记明细'} <RightOutlined aria-hidden /></button>}>
      {!overview ? <LoadError error={data.overview.error || '患者统计加载失败'} retry={query.retry} /> : rows.length === 0 ? <p className="ml-empty">暂无患者</p> : <><div className="ml-table-wrap"><table className="ml-table ml-stats-roster"><colgroup><col style={{ width: '25%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /><col style={{ width: '35%' }} /><col style={{ width: '12%' }} /></colgroup><thead><tr><th>患者</th><th>已登记</th><th>应记录</th><th>登记覆盖率</th><th>操作</th></tr></thead><tbody>{rows.slice(0, shown).map(row => { const patient = patients.find(p => p.id === row.patient_id); return <tr key={row.patient_id}><td><PatientIdentity name={row.display_name} code={row.patient_code} src={patient?.avatar_url} demoPatient={isDemoPatient(patient)} onClick={() => openReport(row)} /></td><td>{row.M}</td><td>{row.N}</td><td><CoverageBar rate={row.coverage_rate} /></td><td><button type="button" className="ml-text-button" aria-label={`查看${row.display_name}的报告`} onClick={() => openReport(row)}>查看</button></td></tr> })}</tbody></table></div>{shown < rows.length && <div className="ml-stats-more"><button type="button" className="ml-text-button" onClick={() => setShown(n => n + 5)}>展开更多（还剩 {rows.length - shown}）<DownOutlined aria-hidden /></button></div>}</>}
    </ClinicalPanel>
    {details && (matrix ? <TeamMatrix matrix={matrix.matrix} openReport={openReport} /> : <LoadError error={data.matrix.error || '明细加载失败'} retry={query.retry} />)}
  </div>
}
function LongText({ text, tone }: { text: string | null; tone?: string }) {
  if (!text) return <>—</>
  return text.length <= 24 ? <span className={tone ? `ml-followup-${tone}` : ''}>{text}</span> : <details className="ml-long-text"><summary>{text.slice(0, 24)}… 展开</summary><p>{text}</p></details>
}
function MissingDistribution({ missing }: { missing: { slot_id: string; scheduled_at: string }[] }) {
  const counts = new Map<string, number>()
  for (const slot of missing) { const day = shanghaiParts(slot.scheduled_at).day; counts.set(day, (counts.get(day) ?? 0) + 1) }
  const max = Math.max(...counts.values())
  return <ul className="ml-missing-distribution" aria-label="未登记时点按日数量">{[...counts].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => <li key={day}><span>{day.slice(5).replace('-', '/')}</span><span className="ml-bar-track" aria-hidden="true"><i style={{ width: `${count / max * 100}%` }} /></span><span>{count} 个</span></li>)}</ul>
}
function PatientReport({ id, from, to, patients, onSelect }: { id?: string; from: string; to: string; patients: MedixPatient[]; onSelect: (id: string) => void }) {
  const navigate = useNavigate()
  const query = useClinicalQuery(`${id}-${from}-${to}`, useCallback(signal => readReport(id!, from, to, signal), [id, from, to]), !!id)
  const followups = useClinicalQuery(`${id}-${from}-${to}`, useCallback(signal => readFollowups(id!, from, to, signal), [id, from, to]), !!id)
  const [allMissing, setAllMissing] = useState(false)
  const stats = query.data?.mismatch ? undefined : query.data?.stats.data
  const trend = query.data?.mismatch ? undefined : query.data?.trend.data
  const missing = [...(stats?.missing_slots ?? [])].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  const sources = Object.entries(stats?.source_breakdown ?? {}).sort(([a], [b]) => (a === 'PATIENT_REPORT' ? -1 : b === 'PATIENT_REPORT' ? 1 : a.localeCompare(b)))
  const sourceTotal = sources.reduce((sum, [, n]) => sum + n, 0)
  const duplicates = [...(stats?.duplicate_slots ?? [])].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  return <div className="ml-stats-stack ml-report">
    <div className="ml-summary-strip ml-report-summary" aria-label="患者报告摘要"><PatientPicker patients={patients} value={id} onChange={onSelect} />{stats && <><span>登记覆盖 <strong>{rateText(stats.coverage_rate)}</strong></span><span>已登记 {stats.M} / 应记录 {stats.N}</span><span>未发现登记 <strong>{missing.length}</strong></span></>}</div>
    {!id ? <p className="ml-empty">请选择患者</p> : <>
      {query.loading && <p className="ml-empty">报告加载中…</p>}
      {(query.error || query.data?.mismatch || query.data?.stats.error) && <LoadError error={query.error || query.data?.mismatch || query.data?.stats.error || '报告加载失败'} retry={query.retry} />}
      <ClinicalPanel title="每日登记覆盖" actions={<InfoHint>{coverageNote}</InfoHint>} className="ml-report-trend">{trend ? <CoverageTrendChart trend={trend.points} /> : query.loading ? <p className="ml-empty">加载中…</p> : <LoadError error={query.data?.mismatch || query.data?.trend.error || '趋势不可用'} retry={query.retry} />}</ClinicalPanel>
      {stats && <div className="ml-report-middle"><ClinicalPanel title="未发现登记时点">
        {missing.length === 0 ? <p className="ml-empty">暂无未登记时点</p> : <>{missing.length > 5 && <MissingDistribution missing={missing} />}{(missing.length <= 5 || allMissing) && <ul className="ml-missing-list">{missing.map(slot => <li key={slot.slot_id}><span className="ml-missing-mark" aria-hidden="true" /><time>{shortTime(slot.scheduled_at)}</time></li>)}</ul>}{missing.length > 5 && <button type="button" className="ml-text-button" onClick={() => setAllMissing(v => !v)}>{allMissing ? '收起' : `查看全部 ${missing.length} 个`}</button>}</>}
      </ClinicalPanel><ClinicalPanel title="登记来源" actions={<InfoHint label="来源口径">按有效登记事件计数，非去重；患者自述未由设备验证。</InfoHint>}>
        {sourceTotal === 0 ? <p className="ml-empty">暂无来源记录</p> : <ul className="ml-source-list">{sources.map(([source, count]) => <li key={source}><span>{source === 'PATIENT_REPORT' ? '患者自述' : source === 'CLINICIAN_OBSERVED' ? '医护观察' : source}</span><span className="ml-bar-track" aria-hidden="true"><i className={source === 'PATIENT_REPORT' ? '' : source === 'CLINICIAN_OBSERVED' ? 'ml-source-blue' : 'ml-source-neutral'} style={{ width: `${count / sourceTotal * 100}%` }} /></span><span>{count}</span></li>)}</ul>}
      </ClinicalPanel></div>}
      <ClinicalPanel title="随访摘要" actions={<button type="button" className="ml-text-button" onClick={() => navigate(`/followups?patientId=${id}`)}>查看全部 <RightOutlined aria-hidden /></button>}>
        {followups.loading ? <p className="ml-empty">加载中…</p> : followups.error ? <LoadError error={followups.error} retry={followups.retry} /> : !followups.data?.length ? <p className="ml-empty">统计周期内暂无随访记录</p> : <div className="ml-table-wrap"><table className="ml-table ml-followup-table"><thead><tr><th>时间</th><th>反馈</th><th>措施</th><th>后续</th></tr></thead><tbody>{followups.data.slice(0, 3).map(f => <tr key={f.id}><td>{shortTime(f.followed_at)}</td><td><LongText text={f.feedback} /></td><td><LongText text={f.action_taken} tone="action" /></td><td><LongText text={f.next_plan} tone="next" /></td></tr>)}</tbody></table></div>}
      </ClinicalPanel>
      {duplicates.length > 0 && <ClinicalPanel title="重复登记"><div className="ml-table-wrap"><table className="ml-table ml-duplicate-table"><thead><tr><th>应记录时间</th><th>有效登记条数</th></tr></thead><tbody>{duplicates.map(d => <tr key={d.slot_id}><td>{shortTime(d.scheduled_at)}</td><td>{d.active_event_count}</td></tr>)}</tbody></table></div></ClinicalPanel>}
    </>}
  </div>
}
export default function StatsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'report'>('overview')
  const [range, setRange] = useState(() => ({ from: addDays(shanghaiDay(), -7), to: shanghaiDay() }))
  const [rangeError, setRangeError] = useState('')
  const [selected, setSelected] = useState<string>()
  const [fallback, setFallback] = useState<MedixPatient>()
  const patients = useClinicalQuery('stats-patients', useCallback(signal => fetchAll<MedixPatient>('/api/patients', signal), []))
  const directory = fallback && !(patients.data ?? []).some(p => p.id === fallback.id) ? [...(patients.data ?? []), fallback] : (patients.data ?? [])
  const openReport = (row: CoverageRow) => { setFallback({ id: row.patient_id, patient_code: row.patient_code, display_name: row.display_name }); setSelected(row.patient_id); setActiveTab('report') }
  return <div className="ml-clinical-page ml-stats-page">
    <PageHeading title="统计与核查"><DatePicker.RangePicker aria-label="统计日期范围" value={[dayjs(range.from), dayjs(addDays(range.to, -1))]} allowClear={false} format="YYYY-MM-DD" onChange={dates => {
      if (!dates?.[0] || !dates[1]) return
      const count = dates[1].startOf('day').diff(dates[0].startOf('day'), 'day') + 1
      if (count < 1 || count > 92) { setRangeError('请选择 1–92 日的区间'); return }
      setRangeError(''); setRange({ from: dates[0].format('YYYY-MM-DD'), to: dates[1].add(1, 'day').format('YYYY-MM-DD') })
    }} /><Button onClick={() => { setRangeError(''); setRange({ from: addDays(shanghaiDay(), -7), to: shanghaiDay() }) }}>近 7 日</Button></PageHeading>
    {rangeError && <LoadError error={rangeError} />}
    <div className="ml-stats-tabs" role="tablist" aria-label="统计视图">{([{ key: 'overview', label: '团队概览' }, { key: 'report', label: '患者报告' }] as const).map(tab => <button type="button" role="tab" id={`tab-${tab.key}`} aria-controls="stats-content" aria-selected={activeTab === tab.key} key={tab.key} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}</div>
    {patients.error && <LoadError error={`患者目录：${patients.error}`} retry={patients.retry} />}
    <div role="tabpanel" id="stats-content" aria-labelledby={`tab-${activeTab}`}>{activeTab === 'overview' ? <TeamOverview key={`${range.from}-${range.to}`} from={range.from} to={range.to} patients={directory} openReport={openReport} /> : <PatientReport key={`${selected}-${range.from}-${range.to}`} id={selected} from={range.from} to={range.to} patients={directory} onSelect={setSelected} />}</div>
  </div>
}
