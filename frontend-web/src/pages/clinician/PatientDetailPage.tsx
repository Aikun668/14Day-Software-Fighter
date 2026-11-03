import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, DatePicker, Drawer, Dropdown, Empty, Form, Input, Modal, Select, Spin, message } from 'antd'
import dayjs from 'dayjs'
import { apiFetch } from '../../api/client'
import MedicationBackfillModal from '../../components/MedicationBackfillModal'

interface PatientDetail {
  id: string
  patient_code: string
  display_name: string
  diagnosis_label: string | null
  note: string | null
  assigned_clinician_id: string | null
  account_user_id: string | null
}

interface Plan {
  id: string
  version: number
  drug_label: string
  plan_type: string
  starts_at: string
  ends_at: string | null
  daily_times: { local_time: string; label: string | null }[]
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

const WEEK_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六']

function cleanDemoMarker(value: string) {
  return value.replace(/\s*[(（]DEMO[)）]/gi, '').trim()
}

function rangeOf(now = dayjs()) {
  const start = now.startOf('day').subtract(6, 'day')
  return {
    from: start.format('YYYY-MM-DD'),
    to: now.startOf('day').add(1, 'day').format('YYYY-MM-DD'),
    start,
  }
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

// 患者详情：Clinic Comfort 两层。数据仍来自现有患者、计划、统计、时点与任务接口。
export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [asOf, setAsOf] = useState(() => Date.now())
  const [patient, setPatient] = useState<PatientDetail | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [eventTotal, setEventTotal] = useState(0)
  const [coverageStats, setCoverageStats] = useState<CoverageStats | null>(null)
  const [slots, setSlots] = useState<DailySlot[]>([])
  const [tasks, setTasks] = useState<ClinicTask[] | null>(null)
  const [rangeStart, setRangeStart] = useState(() => rangeOf().from)
  const [loading, setLoading] = useState(true)
  const [backfillOpen, setBackfillOpen] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(false)

  const load = async (patientId: string) => {
    const range = rangeOf()
    const [p, pl, ev, coverage, slotRes, taskRes] = await Promise.all([
      apiFetch<PatientDetail>(`/api/patients/${patientId}`),
      apiFetch<{ items: Plan[] }>(`/api/patients/${patientId}/medication-plans?include_history=true&page_size=100`).catch(() => ({ items: [] as Plan[] })),
      apiFetch<{ items: Event[]; total: number }>(`/api/patients/${patientId}/medication-events?page_size=50`).catch(() => ({ items: [] as Event[], total: 0 })),
      apiFetch<CoverageStats>(`/api/patients/${patientId}/stats?from=${range.from}&to=${range.to}`).catch(() => null),
      apiFetch<{ items: DailySlot[] }>(`/api/patients/${patientId}/daily-slots?from=${range.from}&to=${range.to}`).catch(() => ({ items: [] as DailySlot[] })),
      apiFetch<{ items: ClinicTask[] }>(`/api/tasks?patient_id=${patientId}&page_size=50`).catch(() => null),
    ])
    setPatient(p)
    setPlans(pl.items)
    setEvents(ev.items)
    setEventTotal(ev.total ?? ev.items.length)
    setCoverageStats(coverage)
    setSlots(slotRes.items)
    setTasks(taskRes ? taskRes.items : null)
    setRangeStart(range.from)
    setAsOf(Date.now())
  }

  useEffect(() => {
    if (!id) return
    let alive = true
    setLoading(true)
    load(id)
      .catch((e) => { if (alive) message.error((e as Error).message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id])

  const reload = async () => {
    if (!id) return
    try {
      await load(id)
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const activePlans = plans
    .filter((plan) => plan.ends_at === null)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  const regularPlan = activePlans.find((plan) => plan.plan_type === 'REGULAR') ?? null
  const headlinePlan = regularPlan ?? activePlans[0] ?? null

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => dayjs(rangeStart).add(index, 'day')),
    [rangeStart],
  )

  const slotByCell = useMemo(() => {
    const map = new Map<string, DailySlot>()
    for (const slot of slots) {
      const parts = shanghaiParts(slot.scheduled_at)
      map.set(`${parts.day}|${parts.time}`, slot)
    }
    return map
  }, [slots])

  const times = useMemo(() => {
    const values = new Set<string>()
    for (const time of regularPlan?.daily_times ?? []) values.add(String(time.local_time).slice(0, 5))
    for (const slot of slots) values.add(shanghaiParts(slot.scheduled_at).time)
    return [...values].sort()
  }, [regularPlan, slots])

  const [editOpen, setEditOpen] = useState(false)
  const [bindAcctOpen, setBindAcctOpen] = useState(false)
  const [bindDevOpen, setBindDevOpen] = useState(false)
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
    setBusy(true)
    try {
      await apiFetch(`/api/patients/${id}`, { method: 'PATCH', body: JSON.stringify(v) })
      message.success('患者信息已更新')
      setEditOpen(false)
      await reload()
    } catch (e) { message.error((e as Error).message) } finally { setBusy(false) }
  }

  const submitBindAcct = async (v: { account: string; initial_password?: string }) => {
    setBusy(true)
    try {
      const r = await apiFetch<{ temporary_password: string | null }>(`/api/patients/${id}/account`, {
        method: 'POST', body: JSON.stringify(v),
      })
      message.success(r.temporary_password
        ? `账号已创建，临时密码（一次性展示，请立即转告）：${r.temporary_password}`
        : '账号绑定成功')
      setBindAcctOpen(false)
      bindAcctForm.resetFields()
      await reload()
    } catch (e) { message.error((e as Error).message) } finally { setBusy(false) }
  }

  const openBindDev = async () => {
    try {
      const ms = await apiFetch<{ items: { id: string; model_name: string }[] }>('/api/device-models?page_size=100')
      setDeviceOptions(ms.items.map((m) => ({ value: m.id, label: m.model_name })))
      setBindDevOpen(true)
    } catch (e) { message.error((e as Error).message) }
  }

  const submitBindDev = async (v: { device_model_id: string; effective_from: string }) => {
    setBusy(true)
    try {
      await apiFetch(`/api/patients/${id}/devices`, {
        method: 'POST',
        body: JSON.stringify({ device_model_id: v.device_model_id, effective_from: `${v.effective_from}T00:00:00+08:00` }),
      })
      message.success('装置已绑定（旧装置生效期自动关闭）')
      setBindDevOpen(false)
      bindDevForm.resetFields()
      await reload()
    } catch (e) { message.error((e as Error).message) } finally { setBusy(false) }
  }

  const submitRevision = async (v: { starts_at: string; drug_label?: string; times_text?: string }) => {
    if (!revOpen) return
    setBusy(true)
    try {
      const daily = (v.times_text || '')
        .split('\n').map((s) => s.trim()).filter(Boolean)
        .map((t) => ({ local_time: t }))
      await apiFetch(`/api/medication-plans/${revOpen.id}/revisions`, {
        method: 'POST',
        body: JSON.stringify({
          starts_at: `${v.starts_at}T00:00:00+08:00`,
          drug_label: v.drug_label || undefined,
          daily_times: revOpen.plan_type === 'REGULAR' ? daily : undefined,
        }),
      })
      message.success('用药时点已更新，历史统计不改写')
      setRevOpen(null)
      revForm.resetFields()
      await reload()
    } catch (e) { message.error((e as Error).message) } finally { setBusy(false) }
  }

  const submitRevoke = async () => {
    if (!revokeTarget) return
    if (!revokeReason.trim()) { message.warning('请填写撤销原因'); return }
    setBusy(true)
    try {
      await apiFetch(`/api/medication-events/${revokeTarget.id}/revoke`, {
        method: 'POST', body: JSON.stringify({ reason: revokeReason.trim() }),
      })
      message.success('已撤销：该记录不再计入统计，原记录保留留痕')
      setRevokeTarget(null)
      setRevokeReason('')
      await reload()
    } catch (e) { message.error((e as Error).message) } finally { setBusy(false) }
  }

  const openRevision = () => {
    if (!headlinePlan) return
    revForm.setFieldsValue({
      starts_at: dayjs().format('YYYY-MM-DD'),
      drug_label: headlinePlan.drug_label,
      times_text: headlinePlan.daily_times?.map((t) => String(t.local_time).slice(0, 5)).join('\n') || '',
    })
    setRevOpen(headlinePlan)
  }

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>
  }
  if (!patient) {
    return <Empty description="患者不存在或无权访问" style={{ marginTop: 64 }} />
  }

  const now = dayjs()
  const isDemoData = [patient.diagnosis_label, patient.note, ...plans.map((plan) => plan.drug_label)]
    .some((value) => value?.includes('DEMO'))
  const unbound = !patient.account_user_id
  const missingCount = coverageStats ? Math.max(coverageStats.N - coverageStats.M, 0) : null
  const openTaskCount = tasks?.filter((task) => task.status === 'OPEN' || task.status === 'IN_PROGRESS').length ?? null
  const duplicateCount = coverageStats?.duplicate_slots?.length ?? 0

  const drugLine = headlinePlan
    ? headlinePlan.plan_type === 'REGULAR' && headlinePlan.daily_times?.length
      ? `${cleanDemoMarker(headlinePlan.drug_label)} · ${headlinePlan.daily_times.map((time) => String(time.local_time).slice(0, 5)).join(' / ')}。下面是近 7 日登记覆盖与待办。`
      : `${cleanDemoMarker(headlinePlan.drug_label)} · 按需。下面是近 7 日登记覆盖与待办。`
    : '暂无进行中的用药计划。下面是近 7 日登记覆盖与待办。'

  const primary = unbound
    ? { key: 'bind', label: '绑定账号', onClick: () => setBindAcctOpen(true) }
    : (missingCount ?? 0) > 0
      ? { key: 'backfill', label: '补登用药', onClick: () => setBackfillOpen(true) }
      : (openTaskCount ?? 0) > 0
        ? { key: 'follow', label: '去随访', onClick: () => navigate('/followups') }
        : null

  type Attention = {
    key: string
    mark: string
    tone: 'warn' | 'info'
    title: string
    detail: string
    chip: string
    chipTone: 'warn' | 'blue'
    onClick?: () => void
  }
  const attention: Attention[] = []
  if (unbound) {
    attention.push({
      key: 'bind',
      mark: '绑',
      tone: 'warn',
      title: '账号未绑定',
      detail: '绑定后才能同步 App 登记',
      chip: '待处理',
      chipTone: 'warn',
      onClick: () => setBindAcctOpen(true),
    })
  }
  if ((missingCount ?? 0) > 0) {
    attention.push({
      key: 'coverage',
      mark: '覆',
      tone: 'info',
      title: '近 7 日覆盖偏低',
      detail: missingCount === 1 ? '有 1 个时点未发现登记' : '多个时点未发现登记',
      chip: '查看',
      chipTone: 'blue',
      onClick: () => document.getElementById('coverage-scale')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
    })
  }
  if (duplicateCount > 0) {
    attention.push({
      key: 'dup',
      mark: '核',
      tone: 'info',
      title: '同一时点有多条登记',
      detail: '请核对，覆盖只计一次',
      chip: '查看',
      chipTone: 'blue',
      onClick: () => setRecordsOpen(true),
    })
  }
  if ((openTaskCount ?? 0) > 0) {
    attention.push({
      key: 'task',
      mark: '访',
      tone: 'warn',
      title: '有待随访',
      detail: '任务仍未关闭',
      chip: '去处理',
      chipTone: 'warn',
      onClick: () => navigate('/followups'),
    })
  }
  const shownAttention = attention.slice(0, 2)
  if (shownAttention.length === 0) {
    shownAttention.push({
      key: 'clear',
      mark: '稳',
      tone: 'info',
      title: '暂无需关注',
      detail: '近 7 日没有待处理事项',
      chip: '正常',
      chipTone: 'blue',
    })
  }

  const moreItems = [
    primary?.key !== 'backfill' ? { key: 'backfill', label: '补登用药', onClick: () => setBackfillOpen(true) } : null,
    { key: 'edit', label: '编辑档案', onClick: openEdit },
    { key: 'device', label: '绑定装置', onClick: () => { void openBindDev() } },
    headlinePlan ? { key: 'revise', label: '修订时点', onClick: openRevision } : null,
    primary?.key !== 'follow' ? { key: 'follow', label: '去随访', onClick: () => navigate('/followups') } : null,
    { key: 'records', label: '查看登记', onClick: () => setRecordsOpen(true) },
  ].filter((item) => item !== null)

  return (
    <div className="patient-detail-page">
      <header className="cc-hero">
        <div>
          <p className="cc-eyebrow">
            {WEEK_EN[now.day()]} · {MONTH_EN[now.month()]} {now.date()} · <span className={coverageStats ? 'ok' : undefined}>{coverageStats ? '系统正常' : '统计未更新'}</span>
          </p>
          <h1 className="cc-title">
            你好，{patient.display_name}
            {isDemoData && <span className="cc-demo">演示数据</span>}
          </h1>
          <p className="cc-sub">{drugLine}</p>
        </div>
        <div className="cc-hero-actions">
          <Dropdown menu={{ items: moreItems }} trigger={['click']}>
            <Button>更多</Button>
          </Dropdown>
          {primary && (
            <Button type="primary" onClick={primary.onClick}>{primary.label}</Button>
          )}
        </div>
      </header>

      <section className="cc-stats" aria-label="近 7 日摘要">
        <article className="cc-stat">
          <p className="cc-stat-label">近 7 日覆盖</p>
          <p className="cc-stat-value">{formatRate(coverageStats)}</p>
          <p className={missingCount ? 'cc-stat-meta warn' : 'cc-stat-meta'}>
            {coverageStats
              ? coverageStats.N > 0
                ? `${coverageStats.M} / ${coverageStats.N} 时点 · 非依从性`
                : '近 7 日无到期时点'
              : '统计暂不可用'}
          </p>
        </article>
        <article className="cc-stat">
          <p className="cc-stat-label">未发现登记</p>
          <p className="cc-stat-value">{missingCount == null ? '—' : missingCount}</p>
          <p className="cc-stat-meta">近 7 日</p>
        </article>
        <article className="cc-stat">
          <p className="cc-stat-label">账号</p>
          <p className="cc-stat-value words">{unbound ? '未绑定' : '已绑定'}</p>
          <p className={unbound ? 'cc-stat-meta warn' : 'cc-stat-meta'}>{unbound ? '需处理' : '已关联'}</p>
        </article>
        <article className="cc-stat">
          <p className="cc-stat-label">待随访</p>
          <p className="cc-stat-value">{openTaskCount == null ? '—' : openTaskCount}</p>
          <p className="cc-stat-meta">{openTaskCount ? '计划内' : '暂无'}</p>
        </article>
      </section>

      <div className="cc-split">
        <section className="cc-card" id="coverage-scale" aria-labelledby="scale-title">
          <div className="cc-card-h">
            <h2 id="scale-title">近 7 日时点</h2>
            <span className="hint">覆盖 ≠ 依从性</span>
          </div>
          {times.length === 0 ? (
            <p className="cc-empty-line">近 7 日没有可显示的时点。</p>
          ) : (
            <>
              <div className="cc-scale-wrap">
                <div className="cc-scale" aria-label="近七日时点登记覆盖">
                  <div />
                  {days.map((day) => (
                    <div key={day.format('YYYY-MM-DD')} className="cc-scale-day">
                      <strong>{day.date()}</strong>
                      {WEEK_ZH[day.day()]}
                    </div>
                  ))}
                  {times.flatMap((time) => {
                    const labelCell = (
                      <div key={`${time}-label`} className="cc-scale-slot">{time}</div>
                    )
                    const cells = days.map((day) => {
                      const key = `${day.format('YYYY-MM-DD')}|${time}`
                      const slot = slotByCell.get(key)
                        const future = slot ? new Date(slot.scheduled_at).getTime() > asOf : false
                        const kind = !slot ? 'none' : future ? 'pending' : slot.has_active_record ? 'ok' : 'miss'
                      const label = !slot
                        ? `${day.format('M月D日')} ${time} 无此时点`
                        : future
                          ? `${day.format('M月D日')} ${time} 未到时点`
                          : `${day.format('M月D日')} ${time} ${kind === 'ok' ? '已登记' : '未发现登记'}`
                      return (
                        <div
                          key={key}
                          className={kind === 'none' ? 'cc-cell' : `cc-cell ${kind}`}
                          title={label}
                          aria-label={label}
                        />
                      )
                    })
                    return [labelCell, ...cells]
                  })}
                </div>
              </div>
              <ul className="cc-legend">
                <li><i className="ok" aria-hidden="true" />已登记</li>
                <li><i className="miss" aria-hidden="true" />未发现登记</li>
              </ul>
            </>
          )}
        </section>

        <section className="cc-card" aria-labelledby="attn-title">
          <div className="cc-card-h">
            <h2 id="attn-title">需关注</h2>
            <span className="hint">{shownAttention.length} 项</span>
          </div>
          <div className="cc-attn">
            {shownAttention.map((item) => {
              const body = (
                <>
                  <div className={`cc-attn-ico ${item.tone}`} aria-hidden="true">{item.mark}</div>
                  <div className="cc-attn-body">
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <span className={`cc-chip ${item.chipTone}`}>{item.chip}</span>
                </>
              )
              return item.onClick ? (
                <button key={item.key} type="button" className="cc-attn-row" onClick={item.onClick}>
                  {body}
                </button>
              ) : (
                <div key={item.key} className="cc-attn-row">{body}</div>
              )
            })}
          </div>
        </section>
      </div>

      <MedicationBackfillModal
        open={backfillOpen}
        patientId={patient.id}
        patientName={patient.display_name}
        onClose={() => setBackfillOpen(false)}
        onSuccess={() => { void reload() }}
      />

      <Drawer
        title="用药登记"
        open={recordsOpen}
        onClose={() => setRecordsOpen(false)}
        size={420}
      >
        {eventTotal > events.length && (
          <p className="cc-empty-line" style={{ marginBottom: 12 }}>仅显示最近 {events.length} 条，更早的记录仍保留。</p>
        )}
        {events.length === 0 ? (
          <p className="cc-empty-line">暂无用药登记。</p>
        ) : (
          <ul className="cc-record-list">
            {events.map((event) => (
              <li key={event.id}>
                <div className="cc-record-main">
                  <strong>{new Date(event.occurred_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</strong>
                  <span>
                    {event.source === 'PATIENT_REPORT' ? '患者自述' : '医护观察'}
                    {event.note ? ` · ${event.note}` : ''}
                  </span>
                </div>
                {event.status === 'REVOKED'
                  ? <span className="cc-revoked">已撤销</span>
                  : <Button size="small" onClick={() => { setRevokeTarget(event); setRevokeReason('') }}>撤销</Button>}
              </li>
            ))}
          </ul>
        )}
      </Drawer>

      <Modal title="编辑患者信息" open={editOpen} onCancel={() => setEditOpen(false)} onOk={() => editForm.submit()} confirmLoading={busy} destroyOnHidden>
        <Form form={editForm} layout="vertical" onFinish={submitEdit}>
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

      <Modal title="绑定登录账号" open={bindAcctOpen} onCancel={() => setBindAcctOpen(false)} onOk={() => bindAcctForm.submit()} confirmLoading={busy} destroyOnHidden>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          账号已存在时将直接绑定（须为未绑定的患者账号）；新账号会生成一次性临时密码。
        </p>
        <Form form={bindAcctForm} layout="vertical" onFinish={submitBindAcct}>
          <Form.Item name="account" label="账号" rules={[{ required: true, min: 2, message: '请输入账号' }]}>
            <Input placeholder="如 patient_wang" />
          </Form.Item>
          <Form.Item name="initial_password" label="初始密码（留空则自动生成临时密码）">
            <Input.Password placeholder="留空自动生成" autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="绑定装置" open={bindDevOpen} onCancel={() => setBindDevOpen(false)} onOk={() => bindDevForm.submit()} confirmLoading={busy} destroyOnHidden>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          绑定新装置后，原装置生效期自动关闭；历史训练记录不改写。
        </p>
        <Form form={bindDevForm} layout="vertical" onFinish={submitBindDev}>
          <Form.Item name="device_model_id" label="装置型号" rules={[{ required: true, message: '请选择型号' }]}>
            <Select options={deviceOptions} placeholder="选择型号" />
          </Form.Item>
          <Form.Item name="effective_from" label="生效日期" rules={[{ required: true, message: '请选择生效日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="修订用药时点" open={revOpen !== null} onCancel={() => setRevOpen(null)} onOk={() => revForm.submit()} confirmLoading={busy} destroyOnHidden>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          修订会生成新的生效记录：旧记录停在新开始日，历史统计不改写。
        </p>
        <Form form={revForm} layout="vertical" onFinish={submitRevision}>
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

      <Modal title="撤销此用药登记？" open={revokeTarget !== null} onCancel={() => { setRevokeTarget(null); setRevokeReason('') }} onOk={submitRevoke} confirmLoading={busy} okText="确认撤销" okButtonProps={{ danger: true }} destroyOnHidden>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
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
