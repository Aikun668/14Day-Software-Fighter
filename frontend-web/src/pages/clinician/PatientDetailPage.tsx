import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, DatePicker, Drawer, Dropdown, Empty, Form, Input, Modal, Select, Spin, message } from 'antd'
import dayjs from 'dayjs'
import { apiFetch } from '../../api/client'
import MedicationBackfillModal from '../../components/MedicationBackfillModal'
import TemporaryCredentialResult from '../../components/medix/TemporaryCredentialResult'
import { collectPages } from './medixPaging'
import { addDays, civilDate, derivePlanPhase, shanghaiToday } from './medixClinicalModel'
import {
  AttentionPanel,
  Card,
  HeroBar,
  StatBand,
  TimeScale,
  TwoColumn,
  type AttentionItem,
  type ScaleCellKind,
  type ScaleSlot,
} from '../../components/clinic'

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

function detailWindow(now = Date.now()) {
  const today = shanghaiToday(now)
  return { from: addDays(today, -6), to: addDays(today, 1), end: today }
}

function shanghaiMidnight(value: unknown) {
  const day = dayjs.isDayjs(value)
    ? value.format('YYYY-MM-DD')
    : typeof value === 'string'
      ? value.slice(0, 10)
      : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('请选择日期')
  return `${day}T00:00:00+08:00`
}

function eventSourceLabel(source: string) {
  if (source === 'PATIENT_REPORT') return '患者自述'
  if (source === 'CLINICIAN_OBSERVED') return '医护观察'
  if (source === 'DEVICE') return '设备'
  return source || '未知来源'
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
  if (!stats || stats.N < 0 || stats.M < 0 || stats.M > stats.N || stats.N <= 0 || stats.coverage_rate == null) return '—'
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
  const [rangeStart, setRangeStart] = useState(() => detailWindow().from)
  const [rangeEnd, setRangeEnd] = useState(() => detailWindow().end)
  const [plansError, setPlansError] = useState<string | null>(null)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [coverageError, setCoverageError] = useState<string | null>(null)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [tasksIncomplete, setTasksIncomplete] = useState(false)
  const [eventPage, setEventPage] = useState(1)
  const [credential, setCredential] = useState<{ account: string; temporaryPassword: string } | null>(null)
  const loadSeq = useRef(0)
  const [loading, setLoading] = useState(true)
  const [backfillOpen, setBackfillOpen] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(false)

  const load = async (patientId: string) => {
    const seq = ++loadSeq.current
    const current = () => loadSeq.current === seq
    const range = detailWindow()
    const patientResult = await apiFetch<PatientDetail>(`/api/patients/${patientId}`)
    if (!current()) return
    const [plansResult, eventsResult, coverageResult, slotsResult, tasksResult] = await Promise.allSettled([
      collectPages<Plan>(
        (page, pageSize) => apiFetch(`/api/patients/${patientId}/medication-plans?include_history=true&page=${page}&page_size=${pageSize}`),
        { alive: current },
      ),
      apiFetch<{ items: Event[]; total: number }>(`/api/patients/${patientId}/medication-events?page=1&page_size=20`),
      apiFetch<CoverageStats>(`/api/patients/${patientId}/stats?from=${range.from}&to=${range.to}`),
      apiFetch<{ items: DailySlot[] }>(`/api/patients/${patientId}/daily-slots?from=${range.from}&to=${range.to}`),
      collectPages<ClinicTask>(
        (page, pageSize) => apiFetch(`/api/tasks?patient_id=${patientId}&page=${page}&page_size=${pageSize}`),
        { alive: current, maxPages: 20 },
      ),
    ])
    if (!current()) return
    setPatient(patientResult)
    setRangeStart(range.from)
    setRangeEnd(range.end)
    setEventPage(1)
    setAsOf(Date.now())
    if (plansResult.status === 'fulfilled' && plansResult.value.complete) {
      setPlans(plansResult.value.items)
      setPlansError(null)
    } else {
      setPlans([])
      setPlansError(plansResult.status === 'rejected' ? (plansResult.reason as Error).message : '计划未完整读取')
    }
    if (eventsResult.status === 'fulfilled' && Array.isArray(eventsResult.value?.items)) {
      setEvents(eventsResult.value.items)
      setEventTotal(eventsResult.value.total ?? eventsResult.value.items.length)
      setEventsError(null)
    } else {
      setEvents([])
      setEventTotal(0)
      setEventsError(eventsResult.status === 'rejected' ? (eventsResult.reason as Error).message : '登记记录不可用')
    }
    if (coverageResult.status === 'fulfilled') {
      setCoverageStats(coverageResult.value)
      setCoverageError(null)
    } else {
      setCoverageStats(null)
      setCoverageError(coverageResult.reason instanceof Error ? coverageResult.reason.message : '统计不可用')
    }
    if (slotsResult.status === 'fulfilled' && Array.isArray(slotsResult.value?.items)) {
      setSlots(slotsResult.value.items)
      setSlotsError(null)
    } else {
      setSlots([])
      setSlotsError(slotsResult.status === 'rejected' ? (slotsResult.reason as Error).message : '时点不可用')
    }
    if (tasksResult.status === 'fulfilled') {
      setTasks(tasksResult.value.items)
      setTasksIncomplete(!tasksResult.value.complete)
      setTasksError(tasksResult.value.complete ? null : '待随访未读全')
    } else {
      setTasks(null)
      setTasksIncomplete(false)
      setTasksError(tasksResult.reason instanceof Error ? tasksResult.reason.message : '任务不可用')
    }
  }

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setPatient(null)
    const run = load(id)
    const expected = loadSeq.current
    run
      .catch((error) => { if (loadSeq.current === expected) message.error((error as Error).message) })
      .finally(() => { if (loadSeq.current === expected) setLoading(false) })
    return () => { loadSeq.current += 1 }
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
    .filter((plan) => derivePlanPhase(plan, asOf) === 'active')
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  const regularPlan = activePlans.find((plan) => plan.plan_type === 'REGULAR') ?? null
  const headlinePlan = regularPlan ?? activePlans[0] ?? null

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(rangeStart, index)),
    [rangeStart],
  )

  const slotByCell = useMemo(() => {
    const map = new Map<string, DailySlot[]>()
    for (const slot of slots) {
      const parts = shanghaiParts(slot.scheduled_at)
      const key = `${parts.day}|${parts.time}`
      const list = map.get(key) ?? []
      list.push(slot)
      map.set(key, list)
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
      const created = await apiFetch<{ temporary_password: string | null }>(`/api/patients/${id}/account`, {
        method: 'POST', body: JSON.stringify(v),
      })
      setBindAcctOpen(false)
      bindAcctForm.resetFields()
      if (created.temporary_password) setCredential({ account: v.account, temporaryPassword: created.temporary_password })
      else message.success('账号绑定成功')
      try { await reload() } catch { message.warning('已保存，刷新失败，请重试读取') }
      return
    } catch (e) { message.error((e as Error).message) } finally { setBusy(false) }
  }

  const openBindDev = async () => {
    try {
      const ms = await collectPages<{ id: string; model_name: string }>(
        (page, pageSize) => apiFetch(`/api/device-models?page=${page}&page_size=${pageSize}`),
      )
      if (!ms.complete) {
        message.error('型号目录未完整读取')
        return
      }
      setDeviceOptions(ms.items.map((item) => ({ value: item.id, label: item.model_name })))
      setBindDevOpen(true)
    } catch (e) { message.error((e as Error).message) }
  }

  const submitBindDev = async (v: { device_model_id: string; effective_from: string }) => {
    setBusy(true)
    try {
      await apiFetch(`/api/patients/${id}/devices`, {
        method: 'POST',
        body: JSON.stringify({ device_model_id: v.device_model_id, effective_from: shanghaiMidnight(v.effective_from) }),
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
          starts_at: shanghaiMidnight(v.starts_at),
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
  const statsAnomaly = Boolean(coverageStats && (coverageStats.N < 0 || coverageStats.M < 0 || coverageStats.M > coverageStats.N))
  const missingCount = !coverageStats || statsAnomaly ? null : Math.max(coverageStats.N - coverageStats.M, 0)
  const openTaskCount = !tasks || tasksError || tasksIncomplete
    ? null
    : tasks.filter((task) => task.status === 'OPEN' || task.status === 'IN_PROGRESS').length
  const duplicateCount = coverageStats?.duplicate_slots?.length ?? 0

  const drugLine = plansError
    ? '计划信息不可用。'
    : headlinePlan
    ? headlinePlan.plan_type === 'REGULAR' && headlinePlan.daily_times?.length
      ? `${cleanDemoMarker(headlinePlan.drug_label)} · ${headlinePlan.daily_times.map((time) => String(time.local_time).slice(0, 5)).join(' / ')}。下面是近 7 日登记覆盖与待办。`
      : `${cleanDemoMarker(headlinePlan.drug_label)} · 按需。下面是近 7 日登记覆盖与待办。`
    : '暂无进行中的用药计划。下面是近 7 日登记覆盖与待办。'

  const primary = unbound
    ? { key: 'bind', label: '绑定账号', onClick: () => setBindAcctOpen(true) }
    : (missingCount ?? 0) > 0
      ? { key: 'backfill', label: '补登用药', onClick: () => setBackfillOpen(true) }
        : (openTaskCount ?? 0) > 0
          ? { key: 'follow', label: '去随访', onClick: () => navigate(`/followups?patientId=${id}`) }
        : null

  const attention: AttentionItem[] = []
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
      onClick: () => navigate(`/followups?patientId=${id}`),
    })
  }
  const shownAttention = attention.slice(0, 2)
  const dataGap = Boolean(plansError || slotsError || coverageError || tasksError || tasksIncomplete)
  if (shownAttention.length === 0 && dataGap) {
    shownAttention.push({
      key: 'gap',
      mark: '缺',
      tone: 'warn',
      title: '数据未完整',
      detail: '有一块没有读全，不能判断为正常',
      chip: '待核对',
      chipTone: 'warn',
    })
  }

  const moreItems = [
    primary?.key !== 'backfill' ? { key: 'backfill', label: '补登用药', onClick: () => setBackfillOpen(true) } : null,
    { key: 'edit', label: '编辑档案', onClick: openEdit },
    { key: 'device', label: '绑定装置', onClick: () => { void openBindDev() } },
    headlinePlan ? { key: 'revise', label: '修订时点', onClick: openRevision } : null,
    primary?.key !== 'follow' ? { key: 'follow', label: '去随访', onClick: () => navigate(`/followups?patientId=${id}`) } : null,
    { key: 'records', label: '查看登记', onClick: () => setRecordsOpen(true) },
  ].filter((item) => item !== null)

  // 刻度数据交给共享组件：行=时点，列=近 7 日
  const scaleDays = days.map((day) => {
    const date = civilDate(day)
    return {
      key: day,
      date: String(date.getDate()),
      weekday: WEEK_ZH[date.getDay()],
    }
  })
  const scaleSlots = times.map((time): ScaleSlot => ({
    key: time,
    label: time,
    cells: days.map((day) => {
      const key = `${day}|${time}`
      const group = slotByCell.get(key) ?? []
      const due = group.filter((slot) => new Date(slot.scheduled_at).getTime() <= asOf)
      const future = group.length - due.length
      const registered = due.filter((slot) => slot.has_active_record).length
      const kind: ScaleCellKind = group.length === 0
        ? 'none'
        : due.length === 0
          ? 'pending'
          : registered === due.length
            ? 'ok'
            : registered === 0
              ? 'miss'
              : 'partial'
      const label = group.length === 0
        ? `${day} ${time} 无此时点`
        : `${day} ${time} 共 ${group.length} 个时点，已到期 ${due.length}，已登记 ${registered}${future ? `，未到 ${future}` : ''}`
      return { kind, label }
    }),
  }))

  return (
    <div className="cc-page">
      <HeroBar
        eyebrow={
          <>
            {WEEK_EN[now.day()]} · {MONTH_EN[now.month()]} {now.date()} ·{' '}
            <span className={coverageStats && !statsAnomaly ? 'ok' : undefined}>{coverageStats && !statsAnomaly ? '系统正常' : '统计未更新'}</span>
          </>
        }
        title={
          <>
            你好，{patient.display_name}
            {isDemoData && <span className="cc-demo">演示数据</span>}
          </>
        }
        sub={drugLine}
        actions={
          <>
            <Dropdown menu={{ items: moreItems }} trigger={['click']}>
              <Button>更多</Button>
            </Dropdown>
            {primary && (
              <Button type="primary" onClick={primary.onClick}>{primary.label}</Button>
            )}
          </>
        }
      />

      <StatBand
        label="近 7 日摘要"
        items={[
          {
            key: 'coverage',
            label: '近 7 日覆盖',
            value: formatRate(coverageStats),
            warn: Boolean(missingCount),
            meta: !coverageStats
              ? '统计暂不可用'
              : statsAnomaly
                ? '数据异常'
                : coverageStats.N > 0
                  ? `${coverageStats.M} / ${coverageStats.N} 时点 · 非依从性`
                  : '近 7 日无到期时点',
          },
          {
            key: 'missing',
            label: '未发现登记',
            value: missingCount == null ? '—' : missingCount,
            meta: '近 7 日',
          },
          {
            key: 'account',
            label: '账号',
            value: unbound ? '未绑定' : '已绑定',
            words: true,
            warn: unbound,
            meta: unbound ? '需处理' : '已关联',
          },
          {
            key: 'followup',
            label: '待随访',
            value: openTaskCount == null ? '—' : openTaskCount,
            meta: tasksError ? '暂不可用' : openTaskCount ? '计划内' : '暂无',
          },
        ]}
      />

      <TwoColumn
        aside={
          <AttentionPanel items={shownAttention} count={shownAttention.length} />
        }
      >
        <Card title="近 7 日时点" hint={`${rangeStart} — ${rangeEnd} · 覆盖 ≠ 依从性`} id="coverage-scale">
          {slotsError ? (
            <p className="cc-empty-line">时点加载失败</p>
          ) : times.length === 0 ? (
            <p className="cc-empty-line">近 7 日没有可显示的时点。</p>
          ) : (
            <TimeScale days={scaleDays} slots={scaleSlots} ariaLabel="近七日时点登记覆盖" />
          )}
        </Card>
      </TwoColumn>

      <MedicationBackfillModal
        appearance="medix"
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
        {eventsError ? <p className="cc-empty-line">加载失败</p> : null}
        {!eventsError && events.length === 0 ? (
          <p className="cc-empty-line">暂无用药登记。</p>
        ) : null}
        {events.length > 0 ? (
          <ul className="cc-record-list">
            {events.map((event) => (
              <li key={event.id}>
                <div className="cc-record-main">
                  <strong>{new Date(event.occurred_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</strong>
                  <span>
                    {eventSourceLabel(event.source)}
                    {event.note ? ` · ${event.note}` : ''}
                  </span>
                </div>
                {event.status === 'REVOKED'
                  ? <span className="cc-revoked">已撤销</span>
                  : <Button size="small" onClick={() => { setRevokeTarget(event); setRevokeReason('') }}>撤销</Button>}
              </li>
            ))}
          </ul>
        ) : null}
        {!eventsError && events.length < eventTotal ? (
          <Button onClick={() => {
            const next = eventPage + 1
            void apiFetch<{ items: Event[]; total: number }>(`/api/patients/${id}/medication-events?page=${next}&page_size=20`)
              .then((result) => {
                setEvents((prev) => [...prev, ...result.items])
                setEventPage(next)
                setEventTotal(result.total)
              })
              .catch((error) => message.error((error as Error).message))
          }}
          >加载更多</Button>
        ) : null}
      </Drawer>
      <TemporaryCredentialResult
        open={credential !== null}
        account={credential?.account ?? ''}
        temporaryPassword={credential?.temporaryPassword ?? ''}
        onDone={() => setCredential(null)}
      />

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
          {activePlans.length > 1 ? (
            <Form.Item label="选择计划">
              <Select
                value={revOpen?.id}
                options={activePlans.map((plan) => ({ value: plan.id, label: `${plan.drug_label} · v${plan.version}` }))}
                onChange={(planId) => {
                  const plan = activePlans.find((item) => item.id === planId)
                  if (plan) setRevOpen(plan)
                }}
              />
            </Form.Item>
          ) : null}
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
