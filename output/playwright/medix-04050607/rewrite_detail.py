from pathlib import Path
p=Path('frontend-web/src/pages/clinician/PatientDetailPage.tsx')
s=p.read_text(encoding='utf-8-sig')
s=s.replace("import { useEffect, useMemo, useState } from 'react'", "import { useCallback, useMemo, useRef, useState } from 'react'")
s=s.replace("import { useNavigate, useParams }", "import { Link, useNavigate, useParams }")
s=s.replace("import dayjs from 'dayjs'", "import dayjs, { type Dayjs } from 'dayjs'\nimport { CheckOutlined, ClockCircleOutlined, EditOutlined, EllipsisOutlined, FileTextOutlined, MinusOutlined } from '@ant-design/icons'\nimport { PatientAvatar } from '../../components/medix/Medix'\nimport { ClinicalPanel, InfoHint, LoadError, useClinicalQuery } from '../../components/medix/ClinicalUI'\nimport { addDays, derivePlanPhase, fetchAll, midnight, shanghaiDay, shortTime, validTimes } from '../../components/medix/clinical'")
a=s.index('import {\n  AttentionPanel,'); b=s.index("} from '../../components/clinic'",a)+len("} from '../../components/clinic'")
s=s[:a]+s[b:]
s=s.replace('  note: string | null\n  assigned_clinician_id:', '  note: string | null\n  avatar_url?: string | null\n  assigned_clinician_id:')
s=s.replace('  id: string\n  version:', '  id: string\n  device_model_id: string\n  version:')
s=s.replace('daily_times: { local_time: string; label: string | null }[]', 'daily_times: { local_time: string; label: string | null; is_enabled?: boolean }[]')
a=s.index('const WEEK_EN');b=s.index("const WEEK_ZH",a);s=s[:a]+s[b:]
a=s.index('function rangeOf');b=s.index('\nfunction shanghaiParts',a)
s=s[:a]+'''function rangeOf() {
  const today = shanghaiDay()
  return { from: addDays(today, -6), to: addDays(today, 1) }
}
'''+s[b:]
a=s.index('// 患者详情');b=s.index('  const activePlans',a)
s=s[:a]+'''// Remount the detail context on patient navigation, including all pending modal state.
export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  return id ? <PatientDetailContext key={id} id={id} /> : <Empty description="患者不可访问" />
}
function PatientDetailContext({ id }: { id: string }) {
  const navigate = useNavigate()
  const [range] = useState(rangeOf)
  const [asOf, setAsOf] = useState(() => Date.now())
  const [backfillOpen, setBackfillOpen] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(false)
  const [eventPage, setEventPage] = useState(1)
  const patientQuery = useClinicalQuery(id, useCallback(signal => apiFetch<PatientDetail>(`/api/patients/${id}`, { signal }), [id]))
  const plansQuery = useClinicalQuery(id, useCallback(signal => fetchAll<Plan>(`/api/patients/${id}/medication-plans?include_history=true`, signal), [id]))
  const eventsQuery = useClinicalQuery(`${id}-${eventPage}`, useCallback(signal => apiFetch<{ items: Event[]; total: number }>(`/api/patients/${id}/medication-events?page=${eventPage}&page_size=50`, { signal }), [id, eventPage]))
  const statsQuery = useClinicalQuery(id, useCallback(signal => apiFetch<CoverageStats>(`/api/patients/${id}/stats?from=${range.from}&to=${range.to}`, { signal }), [id, range]))
  const slotsQuery = useClinicalQuery(id, useCallback(signal => apiFetch<{ items: DailySlot[] }>(`/api/patients/${id}/daily-slots?from=${range.from}&to=${range.to}`, { signal }), [id, range]))
  const tasksQuery = useClinicalQuery(id, useCallback(signal => fetchAll<ClinicTask>(`/api/tasks?patient_id=${id}`, signal), [id]))
  const patient = patientQuery.data ?? null
  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data])
  const events = eventsQuery.data?.items ?? []
  const eventTotal = eventsQuery.data?.total ?? 0
  const coverageStats = statsQuery.data ?? null
  const slots = useMemo(() => slotsQuery.data?.items ?? [], [slotsQuery.data])
  const tasks = tasksQuery.data ?? null
  const rangeStart = range.from
  const loading = patientQuery.loading
  const reload = () => { patientQuery.retry(); plansQuery.retry(); eventsQuery.retry(); statsQuery.retry(); slotsQuery.retry(); tasksQuery.retry(); setAsOf(Date.now()) }
  const savingLock = useRef(false)
''' +s[b:]
s=s.replace('.filter((plan) => plan.ends_at === null)', ".filter((plan) => derivePlanPhase(plan, asOf) === 'active')")
s=s.replace('const map = new Map<string, DailySlot>()', 'const map = new Map<string, DailySlot[]>()')
s=s.replace('      map.set(`${parts.day}|${parts.time}`, slot)', '      const key = `${parts.day}|${parts.time}`\n      map.set(key, [...(map.get(key) ?? []), slot])')
s=s.replace('for (const time of regularPlan?.daily_times ?? [])', 'for (const time of (regularPlan?.daily_times ?? []).filter(t => t.is_enabled !== false))')
s=s.replace('  const [revOpen, setRevOpen]', '  const [choosePlanOpen, setChoosePlanOpen] = useState(false)\n  const [passwordResult, setPasswordResult] = useState<string | null>(null)\n  const [revOpen, setRevOpen]')
s=s.replace('    setBusy(true)', '    if (savingLock.current) return\n    savingLock.current = true; setBusy(true)')
s=s.replace('finally { setBusy(false) }', 'finally { savingLock.current = false; setBusy(false) }')
s=s.replace("      message.success(r.temporary_password\n        ? `账号已创建，临时密码（一次性展示，请立即转告）：${r.temporary_password}`\n        : '账号绑定成功')", "      if (r.temporary_password) setPasswordResult(r.temporary_password)\n      else message.success('账号绑定成功')")
s=s.replace('      setBindDevOpen(true)', '      bindDevForm.resetFields()\n      setBindDevOpen(true)')
s=s.replace('effective_from: string', 'effective_from: Dayjs').replace('starts_at: string; drug_label?', 'starts_at: Dayjs; drug_label?')
s=s.replace('`${v.effective_from}T00:00:00+08:00`', "midnight(v.effective_from.format('YYYY-MM-DD'))").replace('`${v.starts_at}T00:00:00+08:00`', "midnight(v.starts_at.format('YYYY-MM-DD'))")
s=s.replace("    if (!revOpen) return\n", "    if (!revOpen) return\n    if (revOpen.plan_type === 'REGULAR' && !validTimes((v.times_text || '').split('\\n').map(t => t.trim()).filter(Boolean))) { message.error('请填写合法且不重复的 HH:mm 时点'); return }\n")
s=s.replace('  const openRevision = () => {\n    if (!headlinePlan) return', '  const openRevision = (plan: Plan) => {\n    revForm.resetFields()')
s=s.replace("starts_at: dayjs().format('YYYY-MM-DD'),\n      drug_label: headlinePlan.drug_label,\n      times_text: headlinePlan.daily_times", "starts_at: dayjs(shanghaiDay()),\n      drug_label: plan.drug_label,\n      times_text: plan.daily_times")
s=s.replace('    setRevOpen(headlinePlan)', '    setRevOpen(plan)\n    setChoosePlanOpen(false)')
s=s.replace("return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>", 'return <div className="ml-empty"><Spin /></div>')
s=s.replace('return <Empty description="患者不存在或无权访问" style={{ marginTop: 64 }} />', 'return <LoadError error={patientQuery.error || "患者不存在或无权访问"} retry={patientQuery.retry} />')
s=s.replace('  const now = dayjs()\n','')
a=s.index('  const duplicateCount');b=s.index('  return (\n    <div className="cc-page">',a)
s=s[:a]+'''  const follow = () => navigate(`/followups?patientId=${id}`)
  const primary = unbound
    ? { key: 'bind', label: '绑定账号', onClick: () => { bindAcctForm.resetFields(); setBindAcctOpen(true) } }
    : (missingCount ?? 0) > 0
      ? { key: 'backfill', label: '补登用药', onClick: () => setBackfillOpen(true) }
      : (openTaskCount ?? 0) > 0 ? { key: 'follow', label: '去随访', onClick: follow } : null
  const moreItems = [
    { key: 'edit', label: '编辑档案', onClick: openEdit },
    { key: 'device', label: '绑定装置', onClick: () => { void openBindDev() } },
    { key: 'plans', label: '用药计划', onClick: () => navigate(`/plans?patientId=${id}`) },
    plans.length ? { key: 'revise', label: '修订时点', onClick: () => plans.length === 1 ? openRevision(plans[0]) : setChoosePlanOpen(true) } : null,
    { key: 'records', label: '查看登记', onClick: () => setRecordsOpen(true) },
    primary?.key !== 'bind' ? { key: 'account', label: '绑定账号', onClick: () => { bindAcctForm.resetFields(); setBindAcctOpen(true) } } : null,
  ].filter(item => item !== null)
''' + s[b:]
a=s.index('    <div className="cc-page">');b=s.index('      <MedicationBackfillModal',a)
s=s[:a]+'''    <div className="ml-clinical-page ml-detail-page">
      <div className="ml-breadcrumb"><Link to="/patients">患者管理</Link><span>/</span><span>患者详情</span></div>
      <header className="ml-detail-identity"><PatientAvatar code={patient.patient_code} src={patient.avatar_url} large demoPatient={isDemoData} /><h1>{patient.display_name}</h1><span>{cleanDemoMarker(patient.diagnosis_label || '')}</span>{isDemoData && <span className="ml-demo-label">演示数据</span>}<div className="ml-detail-actions">{primary && <Button type="primary" onClick={primary.onClick}>{primary.label}</Button>}<Dropdown menu={{ items: moreItems }} trigger={['click']}><Button aria-label="更多患者操作" icon={<EllipsisOutlined />} /></Dropdown></div></header>
      <div className="ml-summary-strip" aria-label="患者近七日摘要">
        <span>近 7 日登记覆盖 <strong>{formatRate(coverageStats)}</strong></span>
        <span>已登记 {coverageStats?.M ?? '—'} / 应记录 {coverageStats?.N ?? '—'}{coverageStats?.N === 0 && <span className="ml-summary-note">无到期时点</span>}</span>
        <span>待随访 <b className="ml-count-apricot">{openTaskCount ?? '—'}</b></span>
      </div>
      {statsQuery.error && <LoadError error={`登记统计不可用：${statsQuery.error}`} retry={statsQuery.retry} />}
      {plansQuery.error && <LoadError error={`计划加载失败：${plansQuery.error}`} retry={plansQuery.retry} />}
      <div className="ml-detail-grid">
        <ClinicalPanel title="登记记录" actions={<div className="ml-inline-tools"><span>{dayjs(rangeStart).format('M月D日')}—{dayjs(rangeStart).add(6, 'day').format('M月D日')}</span><InfoHint>只统计已到期固定计划时点；登记覆盖不等于实际服药依从性。</InfoHint></div>}>
          {slotsQuery.loading ? <p className="ml-empty">加载中…</p> : slotsQuery.error ? <LoadError error={slotsQuery.error} retry={slotsQuery.retry} /> : times.length === 0 ? <p className="ml-empty">近 7 日无计划时点</p> : <div className="ml-table-wrap"><table className="ml-detail-matrix"><thead><tr><th aria-label="每日时点" />{days.map(d => <th key={d.format('YYYY-MM-DD')}><span>{d.format('MM/DD')}</span><span>周{WEEK_ZH[d.day()]}</span></th>)}</tr></thead><tbody>{times.map(time => <tr key={time}><th scope="row">{time}</th>{days.map(d => {
            const cell = slotByCell.get(`${d.format('YYYY-MM-DD')}|${time}`) ?? []
            const due = cell.filter(s => Date.parse(s.scheduled_at) <= asOf), M = due.filter(s => s.has_active_record).length
            const kind = !cell.length ? 'none' : !due.length ? 'future' : M === due.length ? 'all' : M === 0 ? 'missing' : 'partial'
            const label = `${d.format('M月D日')} ${time}：${cell.length} 个计划时点，已到期 ${due.length}，已登记 ${M}，未到期 ${cell.length - due.length}`
            return <td key={d.format('YYYY-MM-DD')}><button type="button" className={`ml-slot-square ml-cell-${kind}`} aria-label={label} title={label}>{kind === 'all' ? <CheckOutlined /> : kind === 'missing' ? <MinusOutlined /> : kind === 'partial' ? `${M}/${due.length}` : kind === 'future' ? <ClockCircleOutlined /> : null}</button></td>
          })}</tr>)}</tbody></table></div>}
          <div className="ml-legend ml-detail-legend"><span><i className="ml-cell-all" />已登记</span><span><i className="ml-cell-missing" />未发现登记</span>{slots.some(s => Date.parse(s.scheduled_at) > asOf) && <span><ClockCircleOutlined />未到时点</span>}</div>
        </ClinicalPanel>
        <ClinicalPanel title="待办"><div className="ml-detail-todos"><button type="button" onClick={() => setBackfillOpen(true)}><EditOutlined /><span>补登用药</span></button><button type="button" onClick={follow}><FileTextOutlined /><span>记录随访</span>{openTaskCount !== null && openTaskCount > 0 && <b className="ml-count-apricot">{openTaskCount}</b>}</button></div>{tasksQuery.error && <LoadError error={`待办不可用：${tasksQuery.error}`} retry={tasksQuery.retry} />}</ClinicalPanel>
      </div>
''' + s[b:]
a=s.index('        {eventTotal > events.length');b=s.index('        {events.length === 0 ?',a)
s=s[:a]+'''        {eventsQuery.error && <LoadError error={eventsQuery.error} retry={eventsQuery.retry} />}
        {eventsQuery.loading && <p className="ml-empty">加载中…</p>}
        <div className="ml-record-pager"><Button disabled={eventPage === 1} onClick={() => setEventPage(n => n - 1)}>上一页</Button><span>共 {eventTotal} 条</span><Button disabled={eventPage * 50 >= eventTotal} onClick={() => setEventPage(n => n + 1)}>下一页</Button></div>
''' + s[b:]
s=s.replace('        {events.length === 0 ? (', '        {!eventsQuery.error && !eventsQuery.loading && (events.length === 0 ? (')
s=s.replace('        )}\n      </Drawer>', '        ))}\n      </Drawer>')
s=s.replace("new Date(event.occurred_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })", 'shortTime(event.occurred_at)')
s=s.replace("event.source === 'PATIENT_REPORT' ? '患者自述' : '医护观察'", "event.source === 'PATIENT_REPORT' ? '患者自述' : event.source === 'CLINICIAN_OBSERVED' ? '医护观察' : event.source")
s=s.replace('size={420}', 'size={480}\n        rootClassName="ml-theme ml-clinical-dialog"')
s=s.replace('<Modal title=', '<Modal rootClassName="ml-theme ml-clinical-dialog" title=')
s=s.replace("style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}", 'className="ml-dialog-note"')
s=s.replace("style={{ color: 'var(--muted)', fontSize: 13 }}", 'className="ml-dialog-note"')
s=s.replace('      <Modal rootClassName="ml-theme ml-clinical-dialog" title="编辑患者信息"', '''      <Modal rootClassName="ml-theme ml-clinical-dialog" title="账号已创建" open={passwordResult !== null} onCancel={() => setPasswordResult(null)} footer={<Button type="primary" onClick={() => setPasswordResult(null)}>已保存</Button>}><p>临时密码仅本次展示，请保存后转告患者。</p><Input.Password readOnly value={passwordResult ?? ''} aria-label="临时密码" /></Modal>
      <Modal rootClassName="ml-theme ml-clinical-dialog" title="选择要修订的计划" open={choosePlanOpen} onCancel={() => setChoosePlanOpen(false)} footer={null}><ul className="ml-plan-history">{plans.map(plan => <li key={plan.id}><Button type="text" onClick={() => openRevision(plan)}>{cleanDemoMarker(plan.drug_label)} · {shortTime(plan.starts_at)} · v{plan.version}</Button></li>)}</ul></Modal>
      <Modal rootClassName="ml-theme ml-clinical-dialog" title="编辑患者信息"''')
s=s.replace('  const headlinePlan = regularPlan ?? activePlans[0] ?? null\n','')
s=s.replace('className="cc-record-list"', 'className="ml-record-list"').replace('className="cc-record-main"', 'className="ml-record-main"').replace('className="cc-empty-line"', 'className="ml-empty"').replace('className="cc-revoked"', 'className="ml-phase ml-phase-ended"')
p.write_text(s,encoding='utf-8')
