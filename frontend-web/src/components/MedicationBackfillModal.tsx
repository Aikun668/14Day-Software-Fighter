import { useEffect, useMemo, useRef, useState } from 'react'
import { DatePicker, Input, Modal, Select, message } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { apiFetch } from '../api/client'
import PatientAvatar from './medix/PatientAvatar'
import MedixThemeBoundary from './medix/MedixThemeBoundary'
import { collectPages } from '../pages/clinician/medixPaging'
import {
  addDays,
  civilDate,
  daysBetween,
  shanghaiNowIso,
  shanghaiParts,
  shanghaiToday,
} from '../pages/clinician/medixClinicalModel'

interface Plan {
  id: string
  plan_type: string
  drug_label: string | null
  version: number
  starts_at?: string
  ends_at?: string | null
}

interface Slot {
  id: string
  plan_id: string
  patient_id: string
  scheduled_at: string
  state?: string
  has_active_record: boolean
}

type Mode = 'slot' | 'prn'
type LoadStatus = 'idle' | 'loading' | 'error' | 'success'

interface Props {
  open: boolean
  patientId: string | null
  patientName: string
  onClose: () => void
  onSuccess: () => void
  appearance?: 'medix'
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function wallFromIso(iso: string): Dayjs | null {
  const parts = shanghaiParts(Date.parse(iso))
  if (!parts) return null
  return dayjs(`${parts.date} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`)
}

function toShanghaiIso(value: Dayjs) {
  return `${value.format('YYYY-MM-DDTHH:mm:ss')}+08:00`
}

function planCovers(plan: Plan, iso: string) {
  if (!plan.starts_at) return true
  const at = Date.parse(iso)
  const start = Date.parse(plan.starts_at)
  const end = plan.ends_at ? Date.parse(plan.ends_at) : null
  if (!Number.isFinite(at) || !Number.isFinite(start)) return false
  if (at < start) return false
  if (end != null && at >= end) return false
  return true
}

function slotKind(slot: Slot, nowMs: number): 'registered' | 'future' | 'eligible' | 'inactive' {
  if (slot.state && slot.state !== 'ACTIVE') return 'inactive'
  if (slot.has_active_record) return 'registered'
  const at = Date.parse(slot.scheduled_at)
  if (!Number.isFinite(at)) return 'inactive'
  if (at > nowMs) return 'future'
  return 'eligible'
}

/**
 * 补登用药。02 与 04 共用这一份。
 * 计划历史和时点分开请求：时点失败不能当成没有计划。
 */
export default function MedicationBackfillModal({ open, patientId, patientName, onClose, onSuccess, appearance }: Props) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [plansStatus, setPlansStatus] = useState<LoadStatus>('idle')
  const [slotsStatus, setSlotsStatus] = useState<LoadStatus>('idle')
  const [plansError, setPlansError] = useState('')
  const [slotsError, setSlotsError] = useState('')
  const [range, setRange] = useState<{ start: string; end: string } | null>(null)
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('slot')
  const [slotId, setSlotId] = useState('')
  const [prnPlanId, setPrnPlanId] = useState('')
  const [occurredAt, setOccurredAt] = useState<Dayjs | null>(null)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<{ slot?: string; prn?: string; time?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const planSeq = useRef(0)
  const slotSeq = useRef(0)
  const medix = appearance === 'medix'

  const loadPlans = (id: string) => {
    const seq = ++planSeq.current
    setPlansStatus('loading')
    setPlansError('')
    collectPages<Plan>(
      (page, pageSize) => apiFetch(`/api/patients/${id}/medication-plans?include_history=true&page=${page}&page_size=${pageSize}`),
      { alive: () => planSeq.current === seq && patientId === id },
    )
      .then((result) => {
        if (planSeq.current !== seq) return
        if (!result.complete) {
          setPlans([])
          setPlansStatus('error')
          setPlansError('计划未完整读取')
          return
        }
        setPlans(result.items)
        setPlansStatus('success')
        const hasPrn = result.items.some((plan) => plan.plan_type === 'PRN')
        const hasRegular = result.items.some((plan) => plan.plan_type === 'REGULAR')
        setMode(hasRegular || !hasPrn ? 'slot' : 'prn')
        if (!hasRegular && hasPrn) {
          const first = result.items.find((plan) => plan.plan_type === 'PRN')
          if (first) setPrnPlanId(first.id)
        }
      })
      .catch((error: unknown) => {
        if (planSeq.current !== seq) return
        setPlans([])
        setPlansStatus('error')
        setPlansError(error instanceof Error ? error.message : '加载失败')
      })
  }

  const loadSlots = (id: string, start: string, end: string) => {
    const seq = ++slotSeq.current
    setSlotsStatus('loading')
    setSlotsError('')
    setSlotId('')
    const to = addDays(end, 1)
    apiFetch<{ items: Slot[] }>(`/api/patients/${id}/daily-slots?from=${start}&to=${to}`)
      .then((result) => {
        if (slotSeq.current !== seq) return
        setSlots(Array.isArray(result?.items) ? result.items : [])
        setSlotsStatus('success')
      })
      .catch((error: unknown) => {
        if (slotSeq.current !== seq) return
        setSlots([])
        setSlotsStatus('error')
        setSlotsError(error instanceof Error ? error.message : '加载失败')
      })
  }

  useEffect(() => {
    if (!open || !patientId) return
    setErrors({})
    setSubmitError(null)
    setSlotId('')
    setPrnPlanId('')
    setOccurredAt(null)
    setNote('')
    setRangeError(null)
    const today = shanghaiToday()
    const start = addDays(today, -6)
    setRange({ start, end: today })
    loadPlans(patientId)
    loadSlots(patientId, start, today)
    return () => {
      planSeq.current += 1
      slotSeq.current += 1
    }
    // 打开或换患者时重置。范围变化走单独的时点请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patientId])

  const regularPlans = useMemo(() => plans.filter((plan) => plan.plan_type === 'REGULAR'), [plans])
  const prnPlans = useMemo(() => plans.filter((plan) => plan.plan_type === 'PRN'), [plans])
  const nowMs = Date.now()

  const rows = useMemo(() => {
    const clocks = new Map<string, number>()
    const base = slots.map((slot) => {
      const parts = shanghaiParts(Date.parse(slot.scheduled_at))
      const label = parts ? `${parts.month}月${parts.day}日 ${pad(parts.hour)}:${pad(parts.minute)}` : slot.scheduled_at
      clocks.set(label, (clocks.get(label) ?? 0) + 1)
      return { slot, label, kind: slotKind(slot, nowMs) }
    })
    return base
      .filter((row) => row.kind !== 'inactive')
      .map((row) => {
        const drug = plans.find((plan) => plan.id === row.slot.plan_id)?.drug_label
        const ambiguous = (clocks.get(row.label) ?? 0) > 1 && drug
        return { ...row, title: ambiguous ? `${row.label} ${drug}` : row.label }
      })
  }, [slots, plans, nowMs])

  const loaded = plansStatus === 'success' && slotsStatus === 'success' && !rangeError
  const noPlan = loaded && plans.length === 0 && slots.length === 0
  const blocked = !loaded || submitting || noPlan

  const pickSlot = (id: string) => {
    const row = rows.find((item) => item.slot.id === id)
    if (!row || row.kind !== 'eligible') return
    setSlotId(id)
    setPrnPlanId('')
    setErrors((current) => ({ ...current, slot: undefined, time: undefined }))
    setOccurredAt(wallFromIso(row.slot.scheduled_at))
  }

  const changeRange = (start: string, end: string) => {
    if (!patientId) return
    const span = daysBetween(start, addDays(end, 1))
    setRange({ start, end })
    setSlotId('')
    setOccurredAt(null)
    if (span > 31) {
      setRangeError('日期跨度最多 31 天')
      setSlotsStatus('idle')
      return
    }
    setRangeError(null)
    loadSlots(patientId, start, end)
  }

  const submit = async () => {
    if (blocked || !patientId) return
    const next: typeof errors = {}
    const slot = mode === 'slot' ? slots.find((item) => item.id === slotId) : undefined
    if (mode === 'slot' && (!slot || slotKind(slot, Date.now()) !== 'eligible' || slot.patient_id !== patientId)) {
      next.slot = '请选择一个可补登时点'
    }
    if (mode === 'prn' && !prnPlanId) next.prn = '请选择按需计划'
    if (!occurredAt) next.time = '请选择实际用药时间'
    const occurredIso = occurredAt ? toShanghaiIso(occurredAt) : ''
    if (occurredAt && Date.parse(occurredIso) > Date.parse(shanghaiNowIso())) next.time = '实际用药时间不能晚于现在'
    const prn = prnPlans.find((plan) => plan.id === prnPlanId)
    if (mode === 'prn' && prn && occurredIso && !planCovers(prn, occurredIso)) next.time = '实际用药时间不在该计划的生效期内'
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }
    const planId = mode === 'slot' ? slot!.plan_id : prnPlanId
    setSubmitting(true)
    setSubmitError(null)
    try {
      const saved = await apiFetch<{ is_duplicate: boolean }>('/api/medication-events', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patientId,
          plan_id: planId,
          slot_id: mode === 'slot' ? slot!.id : null,
          occurred_at: occurredIso,
          note: note.trim() ? note.trim() : null,
        }),
      })
      onClose()
      onSuccess()
      if (saved.is_duplicate) message.warning('已保存，该时点已有登记')
      else message.success('已补登用药记录')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '补登失败')
    } finally {
      setSubmitting(false)
    }
  }

  const showSwitch = loaded && (rows.length > 0 || regularPlans.length > 0) && prnPlans.length > 0
  const prnOptions = prnPlans.map((plan) => {
    const same = prnPlans.filter((item) => item.drug_label === plan.drug_label).length > 1
    const label = plan.drug_label || '按需计划'
    return { value: plan.id, label: same ? `${label} · v${plan.version}` : label }
  })

  const body = (
    <Modal
      title="补登用药"
      open={open}
      width={560}
      onCancel={() => { if (!submitting) onClose() }}
      onOk={() => { void submit() }}
      okText="确认补登"
      cancelText="取消"
      confirmLoading={submitting}
      okButtonProps={{ disabled: blocked }}
      cancelButtonProps={{ disabled: submitting }}
      closable={!submitting}
      destroyOnHidden
      classNames={{ root: 'ml-shell ml-backfill' }}
    >
      <div className="ml-dialog-body">
        <div className="ml-modal-who">
          <PatientAvatar name={patientName} patientId={patientId || ''} />
          <div className="ml-modal-name">{patientName}</div>
        </div>
        {range ? (
          <DatePicker.RangePicker
            allowClear={false}
            value={[dayjs(civilDate(range.start)), dayjs(civilDate(range.end))]}
            disabled={submitting}
            onChange={(values) => {
              const start = values?.[0]?.format('YYYY-MM-DD')
              const end = values?.[1]?.format('YYYY-MM-DD')
              if (start && end) changeRange(start, end)
            }}
          />
        ) : null}
        {rangeError ? <p className="ml-field-error">{rangeError}</p> : null}
        {plansStatus === 'error' ? (
          <p className="ml-inline-error"><span className="ml-field-error">加载失败</span><span>{plansError}</span><button type="button" className="ml-text-btn" onClick={() => patientId && loadPlans(patientId)}>重试计划</button></p>
        ) : null}
        {slotsStatus === 'error' ? (
          <p className="ml-inline-error"><span className="ml-field-error">加载失败</span><span>{slotsError}</span><button type="button" className="ml-text-btn" onClick={() => patientId && range && loadSlots(patientId, range.start, range.end)}>重试时点</button></p>
        ) : null}
        {(plansStatus === 'loading' || slotsStatus === 'loading') ? <p className="ml-hint">加载中</p> : null}
        {noPlan ? <p className="ml-empty">暂无计划</p> : null}
        {loaded && !noPlan && rows.length === 0 && prnPlans.length === 0 ? <p className="ml-empty">暂无可补登时点</p> : null}
        {showSwitch ? (
          <div className="ml-mode-switch" role="radiogroup" aria-label="登记方式">
            <label><input type="radio" name="backfill-mode" checked={mode === 'slot'} onChange={() => { setMode('slot'); setPrnPlanId('') }} />按时点</label>
            <label><input type="radio" name="backfill-mode" checked={mode === 'prn'} onChange={() => { setMode('prn'); setSlotId('') }} />按需</label>
          </div>
        ) : null}
        {mode === 'slot' && loaded && !noPlan ? (
          <div>
            <div className="ml-field-label">选择计划时点</div>
            {rows.length === 0 ? <p className="ml-empty">暂无可补登时点</p> : (
              <div className="ml-slot-list" role="radiogroup" aria-label="选择计划时点">
                {rows.map((row) => (
                  <label key={row.slot.id} className={`ml-slot${slotId === row.slot.id ? ' is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="backfill-slot"
                      disabled={row.kind !== 'eligible' || submitting}
                      checked={slotId === row.slot.id}
                      onChange={() => pickSlot(row.slot.id)}
                    />
                    <span className="ml-slot-time">{row.title}</span>
                    <span className="ml-slot-state">
                      {row.kind === 'registered' ? '已登记' : row.kind === 'future' ? '未到时点' : '可补登'}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {errors.slot ? <span className="ml-field-error">{errors.slot}</span> : null}
          </div>
        ) : null}
        {mode === 'prn' && loaded ? (
          <div>
            <label className="ml-field-label" htmlFor="ml-prn-plan">按需计划</label>
            <Select
              id="ml-prn-plan"
              style={{ width: '100%' }}
              value={prnPlanId || undefined}
              placeholder="选择按需计划"
              options={prnOptions}
              disabled={submitting}
              status={errors.prn ? 'error' : undefined}
              onChange={(value) => {
                setPrnPlanId(value)
                setSlotId('')
                setErrors((current) => ({ ...current, prn: undefined }))
              }}
            />
            {errors.prn ? <span className="ml-field-error">{errors.prn}</span> : null}
          </div>
        ) : null}
        <div>
          <label className="ml-field-label" htmlFor="ml-backfill-time">实际用药时间（必填）</label>
          <DatePicker
            id="ml-backfill-time"
            showTime
            style={{ width: '100%' }}
            format="YYYY-MM-DD HH:mm"
            value={occurredAt}
            disabled={submitting}
            status={errors.time ? 'error' : undefined}
            onChange={(value) => {
              setOccurredAt(value)
              setErrors((current) => ({ ...current, time: undefined }))
            }}
          />
          {errors.time ? <span className="ml-field-error">{errors.time}</span> : null}
        </div>
        <div>
          <label className="ml-field-label" htmlFor="ml-backfill-note">备注（选填）</label>
          <Input.TextArea id="ml-backfill-note" rows={3} value={note} disabled={submitting} placeholder="补充说明" onChange={(event) => setNote(event.target.value)} />
        </div>
        {submitError ? <p className="ml-field-error" role="alert">{submitError}</p> : null}
      </div>
    </Modal>
  )

  if (!medix) return body
  return <MedixThemeBoundary scope="overlay">{body}</MedixThemeBoundary>
}
