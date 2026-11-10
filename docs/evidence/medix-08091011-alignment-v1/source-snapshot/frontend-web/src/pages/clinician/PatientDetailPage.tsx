import { useClinicalQuery } from '../../components/medix/useClinicalQuery'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, DatePicker, Drawer, Dropdown, Empty, Form, Input, Modal, Select, Spin, message } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { CheckOutlined, ClockCircleOutlined, EditOutlined, EllipsisOutlined, FileTextOutlined, MinusOutlined } from '@ant-design/icons'
import { PatientAvatar } from '../../components/medix/Medix'
import { ClinicalPanel, InfoHint, LoadError } from '../../components/medix/ClinicalUI'
import { addDays, derivePlanPhase, fetchAll, midnight, shanghaiDay, shortTime, validTimes } from '../../components/medix/clinical'
import { apiFetch } from '../../api/client'
import MedicationBackfillModal from '../../components/MedicationBackfillModal'
import { isDemoPatient } from '../../components/medix/clinical'


interface PatientDetail {
  id: string
  patient_code: string
  display_name: string
  diagnosis_label: string | null
  note: string | null
  avatar_url?: string | null
  assigned_clinician_id: string | null
  account_user_id: string | null
}

interface Plan {
  id: string
  device_model_id: string
  version: number
  drug_label: string
  plan_type: string
  starts_at: string
  ends_at: string | null
  daily_times: { local_time: string; label: string | null; is_enabled?: boolean }[]
}

interface Event {
  id: string
  slot_id: string | null
  source: string
  occurred_at: string
  status: string
  note: string | null
}

interface CoverageStats {
  N: number
  M: number
  coverage_rate: number | null
  duplicate_slots?: { slot_id: string }[]
}

interface DailySlot {
  id: string
  scheduled_at: string
  has_active_record: boolean
}

interface ClinicTask {
  id: string
  status: string
}

const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六']

function cleanDemoMarker(value: string) {
  return value.replace(/\s*[(（]DEMO[)）]/gi, '').trim()
}

function rangeOf() {
  const today = shanghaiDay()
  return { from: addDays(today, -6), to: addDays(today, 1) }
}

function shanghaiParts(iso: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  }
}

function formatRate(stats: CoverageStats | null) {
  if (!stats || stats.N <= 0 || stats.coverage_rate == null) return '—'
  return `${stats.coverage_rate}%`
}

// Remount the detail context on patient navigation, including all pending modal state.
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
  const activePlans = plans
    .filter((plan) => derivePlanPhase(plan, asOf) === 'active')
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  const regularPlan = activePlans.find((plan) => plan.plan_type === 'REGULAR') ?? null

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => dayjs(rangeStart).add(index, 'day')),
    [rangeStart],
  )

  const slotByCell = useMemo(() => {
    const map = new Map<string, DailySlot[]>()
    for (const slot of slots) {
      const parts = shanghaiParts(slot.scheduled_at)
      const key = `${parts.day}|${parts.time}`
      map.set(key, [...(map.get(key) ?? []), slot])
    }
    return map
  }, [slots])

  const times = useMemo(() => {
    const values = new Set<string>()
    for (const time of (regularPlan?.daily_times ?? []).filter(t => t.is_enabled !== false)) values.add(String(time.local_time).slice(0, 5))
    for (const slot of slots) values.add(shanghaiParts(slot.scheduled_at).time)
    return [...values].sort()
  }, [regularPlan, slots])

  const [editOpen, setEditOpen] = useState(false)
  const [bindAcctOpen, setBindAcctOpen] = useState(false)
  const [bindDevOpen, setBindDevOpen] = useState(false)
  const [choosePlanOpen, setChoosePlanOpen] = useState(false)
  const [passwordResult, setPasswordResult] = useState<string | null>(null)
  const [revOpen, setRevOpen] = useState<Plan | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<Event | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [editForm] = Form.useForm()
  const [bindAcctForm] = Form.useForm()
  const [bindDevForm] = Form.useForm()
  const [revForm] = Form.useForm()
  const [deviceOptions, setDeviceOptions] = useState<{ value: string; label: string }[]>([])

  const openEdit = () => {
    editForm.setFieldsValue({
      display_name: patient?.display_name,
      diagnosis_label: patient?.diagnosis_label,
      note: patient?.note,
    })
    setEditOpen(true)
  }

  const submitEdit = async (v: { display_name: string; diagnosis_label?: string; note?: string }) => {
    if (savingLock.current) return
    savingLock.current = true; setBusy(true)
    try {
      await apiFetch(`/api/patients/${id}`, { method: 'PATCH', body: JSON.stringify(v) })
      message.success('患者信息已更新')
      setEditOpen(false)
      await reload()
    } catch (e) { message.error((e as Error).message) } finally { savingLock.current = false; setBusy(false) }
  }

  const submitBindAcct = async (v: { account: string; initial_password?: string }) => {
    if (savingLock.current) return
    savingLock.current = true; setBusy(true)
    try {
      const r = await apiFetch<{ temporary_password: string | null }>(`/api/patients/${id}/account`, {
        method: 'POST', body: JSON.stringify(v),
      })
      if (r.temporary_password) setPasswordResult(r.temporary_password)
      else message.success('账号绑定成功')
      setBindAcctOpen(false)
      bindAcctForm.resetFields()
      // Keep the one-time credential visible even if the next read fails.
      if (!r.temporary_password) reload()
    } catch (e) { message.error((e as Error).message) } finally { savingLock.current = false; setBusy(false) }
  }

  const openBindDev = async () => {
    try {
      const ms = await apiFetch<{ items: { id: string; model_name: string }[] }>('/api/device-models?page_size=100')
      setDeviceOptions(ms.items.map((m) => ({ value: m.id, label: m.model_name })))
      bindDevForm.resetFields()
      setBindDevOpen(true)
    } catch (e) { message.error((e as Error).message) }
  }

  const submitBindDev = async (v: { device_model_id: string; effective_from: Dayjs }) => {
    if (savingLock.current) return
    savingLock.current = true; setBusy(true)
    try {
      await apiFetch(`/api/patients/${id}/devices`, {
        method: 'POST',
        body: JSON.stringify({ device_model_id: v.device_model_id, effective_from: midnight(v.effective_from.format('YYYY-MM-DD')) }),
      })
      message.success('装置已绑定（旧装置生效期自动关闭）')
      setBindDevOpen(false)
      bindDevForm.resetFields()
      await reload()
    } catch (e) { message.error((e as Error).message) } finally { savingLock.current = false; setBusy(false) }
  }

  const submitRevision = async (v: { starts_at: Dayjs; drug_label?: string; times_text?: string }) => {
    if (!revOpen) return
    if (revOpen.plan_type === 'REGULAR' && !validTimes((v.times_text || '').split('\n').map(t => t.trim()).filter(Boolean))) { message.error('请填写合法且不重复的 HH:mm 时点'); return }
    if (savingLock.current) return
    savingLock.current = true; setBusy(true)
    try {
      const daily = (v.times_text || '')
        .split('\n').map((s) => s.trim()).filter(Boolean)
        .map((t) => ({ local_time: t }))
      await apiFetch(`/api/medication-plans/${revOpen.id}/revisions`, {
        method: 'POST',
        body: JSON.stringify({
          starts_at: midnight(v.starts_at.format('YYYY-MM-DD')),
          drug_label: v.drug_label || undefined,
          daily_times: revOpen.plan_type === 'REGULAR' ? daily : undefined,
        }),
      })
      message.success('用药时点已更新，历史统计不改写')
      setRevOpen(null)
      revForm.resetFields()
      await reload()
    } catch (e) { message.error((e as Error).message) } finally { savingLock.current = false; setBusy(false) }
  }

  const submitRevoke = async () => {
    if (!revokeTarget) return
    if (!revokeReason.trim()) { message.warning('请填写撤销原因'); return }
    if (savingLock.current) return
    savingLock.current = true; setBusy(true)
    try {
      await apiFetch(`/api/medication-events/${revokeTarget.id}/revoke`, {
        method: 'POST', body: JSON.stringify({ reason: revokeReason.trim() }),
      })
      message.success('已撤销：该记录不再计入统计，原记录保留留痕')
      setRevokeTarget(null)
      setRevokeReason('')
      await reload()
    } catch (e) { message.error((e as Error).message) } finally { savingLock.current = false; setBusy(false) }
  }

  const openRevision = (plan: Plan) => {
    revForm.resetFields()
    revForm.setFieldsValue({
      starts_at: dayjs(shanghaiDay()),
      drug_label: plan.drug_label,
      times_text: plan.daily_times?.map((t) => String(t.local_time).slice(0, 5)).join('\n') || '',
    })
    setRevOpen(plan)
    setChoosePlanOpen(false)
  }

  if (loading) {
    return <div className="ml-empty"><Spin /></div>
  }
  if (!patient) {
    return <LoadError error={patientQuery.error || "患者不存在或无权访问"} retry={patientQuery.retry} />
  }

  const isDemoData = [patient.diagnosis_label, patient.note, ...plans.map((plan) => plan.drug_label)]
    .some((value) => value?.includes('DEMO'))
  const unbound = !patient.account_user_id
  const missingCount = coverageStats ? Math.max(coverageStats.N - coverageStats.M, 0) : null
  const openTaskCount = tasks?.filter((task) => task.status === 'OPEN' || task.status === 'IN_PROGRESS').length ?? null
  const follow = () => navigate(`/followups?patientId=${id}`)
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
  return (
    <div className="ml-clinical-page ml-detail-page">
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
        <ClinicalPanel title="待办"><div className="ml-detail-todos"><button type="button" onClick={() => setBackfillOpen(true)}><EditOutlined aria-hidden /><span>补登用药</span></button><button type="button" onClick={follow}><FileTextOutlined aria-hidden /><span>记录随访</span>{openTaskCount !== null && openTaskCount > 0 && <b className="ml-count-apricot">{openTaskCount}</b>}</button></div>{tasksQuery.error && <LoadError error={`待办不可用：${tasksQuery.error}`} retry={tasksQuery.retry} />}</ClinicalPanel>
      </div>
      <MedicationBackfillModal
        open={backfillOpen}
        patientId={patient.id}
        patientName={patient.display_name}
        patientCode={patient.patient_code}
        avatarUrl={patient.avatar_url}
        demoPatient={isDemoPatient(patient)}
        onClose={() => setBackfillOpen(false)}
        onSuccess={() => { void reload() }}
      />

      <Drawer
        title="用药登记"
        open={recordsOpen}
        onClose={() => setRecordsOpen(false)}
        size={480}
        rootClassName="ml-theme ml-clinical-dialog"
      >
        {eventsQuery.error && <LoadError error={eventsQuery.error} retry={eventsQuery.retry} />}
        {eventsQuery.loading && <p className="ml-empty">加载中…</p>}
        <div className="ml-record-pager"><Button disabled={eventPage === 1} onClick={() => setEventPage(n => n - 1)}>上一页</Button><span>共 {eventTotal} 条</span><Button disabled={eventPage * 50 >= eventTotal} onClick={() => setEventPage(n => n + 1)}>下一页</Button></div>
        {!eventsQuery.error && !eventsQuery.loading && (events.length === 0 ? (
          <p className="ml-empty">暂无用药登记。</p>
        ) : (
          <ul className="ml-record-list">
            {events.map((event) => (
              <li key={event.id}>
                <div className="ml-record-main">
                  <strong>{shortTime(event.occurred_at)}</strong>
                  <span>
                    {event.source === 'PATIENT_REPORT' ? '患者自述' : event.source === 'CLINICIAN_OBSERVED' ? '医护观察' : event.source}
                    {event.note ? ` · ${event.note}` : ''}
                  </span>
                </div>
                {event.status === 'REVOKED'
                  ? <span className="ml-phase ml-phase-ended">已撤销</span>
                  : <Button size="small" onClick={() => { setRevokeTarget(event); setRevokeReason('') }}>撤销</Button>}
              </li>
            ))}
          </ul>
        ))}
      </Drawer>

      <Modal rootClassName="ml-theme ml-clinical-dialog" title="账号已创建" open={passwordResult !== null} onCancel={() => { setPasswordResult(null); reload() }} footer={<Button type="primary" onClick={() => { setPasswordResult(null); reload() }}>已保存</Button>}><p>临时密码仅本次展示，请保存后转告患者。</p><Input.Password readOnly value={passwordResult ?? ''} aria-label="临时密码" /></Modal>
      <Modal rootClassName="ml-theme ml-clinical-dialog" title="选择要修订的计划" open={choosePlanOpen} onCancel={() => setChoosePlanOpen(false)} footer={null}><ul className="ml-plan-history">{plans.map(plan => <li key={plan.id}><Button type="text" onClick={() => openRevision(plan)}>{cleanDemoMarker(plan.drug_label)} · {shortTime(plan.starts_at)} · v{plan.version}</Button></li>)}</ul></Modal>
      <Modal rootClassName="ml-theme ml-clinical-dialog" title="编辑患者信息" open={editOpen} onCancel={() => setEditOpen(false)} onOk={() => editForm.submit()} confirmLoading={busy} destroyOnHidden>
        <Form onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).closest('.ant-picker')) event.preventDefault() }} requiredMark={false} form={editForm} layout="vertical" onFinish={submitEdit}>
          <Form.Item name="display_name" label="姓名/别名" rules={[{ required: true, message: '请输入姓名或别名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="diagnosis_label" label="诊断标签">
            <Input placeholder="已知档案标签，非系统诊断" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal rootClassName="ml-theme ml-clinical-dialog" title="绑定登录账号" open={bindAcctOpen} onCancel={() => setBindAcctOpen(false)} onOk={() => bindAcctForm.submit()} confirmLoading={busy} destroyOnHidden>
        <p className="ml-dialog-note">
          账号已存在时将直接绑定（须为未绑定的患者账号）；新账号会生成一次性临时密码。
        </p>
        <Form onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).closest('.ant-picker')) event.preventDefault() }} requiredMark={false} form={bindAcctForm} layout="vertical" onFinish={submitBindAcct}>
          <Form.Item name="account" label="账号" rules={[{ required: true, min: 2, message: '请输入账号' }]}>
            <Input placeholder="如 patient_wang" />
          </Form.Item>
          <Form.Item name="initial_password" label="初始密码（留空则自动生成临时密码）">
            <Input.Password placeholder="留空自动生成" autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal rootClassName="ml-theme ml-clinical-dialog" title="绑定装置" open={bindDevOpen} onCancel={() => setBindDevOpen(false)} onOk={() => bindDevForm.submit()} confirmLoading={busy} destroyOnHidden>
        <p className="ml-dialog-note">
          绑定新装置后，原装置生效期自动关闭；历史训练记录不改写。
        </p>
        <Form onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).closest('.ant-picker')) event.preventDefault() }} requiredMark={false} form={bindDevForm} layout="vertical" onFinish={submitBindDev}>
          <Form.Item name="device_model_id" label="装置型号" rules={[{ required: true, message: '请选择型号' }]}>
            <Select options={deviceOptions} placeholder="选择型号" />
          </Form.Item>
          <Form.Item name="effective_from" label="生效日期" rules={[{ required: true, message: '请选择生效日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal rootClassName="ml-theme ml-clinical-dialog" title="修订用药时点" open={revOpen !== null} onCancel={() => setRevOpen(null)} onOk={() => revForm.submit()} confirmLoading={busy} destroyOnHidden>
        <p className="ml-dialog-note">
          修订会生成新的生效记录：旧记录停在新开始日，历史统计不改写。
        </p>
        <Form onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).closest('.ant-picker')) event.preventDefault() }} requiredMark={false} form={revForm} layout="vertical" onFinish={submitRevision}>
          <Form.Item name="starts_at" label="生效日期" rules={[{ required: true, message: '请选择生效日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="drug_label" label="药物名称（可选，留空沿用）">
            <Input />
          </Form.Item>
          {revOpen?.plan_type === 'REGULAR' && (
            <Form.Item name="times_text" label="每日时点（每行一个，如 08:00）" rules={[{ required: true, message: '请至少填写一个时点' }]}>
              <Input.TextArea rows={3} placeholder={'08:00\n20:00'} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal rootClassName="ml-theme ml-clinical-dialog" title="撤销此用药登记？" open={revokeTarget !== null} onCancel={() => { setRevokeTarget(null); setRevokeReason('') }} onOk={submitRevoke} confirmLoading={busy} okText="确认撤销" okButtonProps={{ danger: true }} destroyOnHidden>
        <p className="ml-dialog-note">
          撤销后该记录不再计入统计，原记录与撤销留痕保留、不可删除。
        </p>
        <Input.TextArea
          value={revokeReason}
          onChange={(e) => setRevokeReason(e.target.value)}
          rows={2}
          placeholder="撤销原因（必填），如：患者反馈当时未实际使用"
        />
      </Modal>
    </div>
  )
}
