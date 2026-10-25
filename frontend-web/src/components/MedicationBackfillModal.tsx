import { useEffect, useMemo, useState } from 'react'
import { Alert, DatePicker, Input, Modal, Radio, Select, message } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { apiFetch } from '../api/client'

interface Plan {
  id: string
  plan_type: string
  drug_label: string | null
  version: number
}

interface Slot {
  id: string
  plan_id: string
  patient_id: string
  scheduled_at: string
  state: string
  has_active_record: boolean
}

type Mode = 'slot' | 'prn'

interface Props {
  open: boolean
  patientId: string | null
  patientName: string
  onClose: () => void
  /** 补登成功后回调（父页面据此刷新） */
  onSuccess: () => void
}

const localDay = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 补登用药弹窗：医护现场把患者漏登记的时点补录进来。
 *
 * 数据流：打开时按患者拉取「近 7 天 ~ 明天」的固定时点与计划；
 * 固定计划走时点选择（plan_id 取自时点自身，兼容历史版本计划）；
 * 按需计划（PRN）走时间选择。提交后由父页面刷新。
 *
 * 说明：这里用受控 state 而非 antd Form —— Modal + destroyOnHidden 下
 * Form 字段注册时机不稳定，曾导致已填值被判为空。
 */
export default function MedicationBackfillModal({ open, patientId, patientName, onClose, onSuccess }: Props) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [mode, setMode] = useState<Mode>('slot')
  const [slotId, setSlotId] = useState<string>('')
  const [prnPlanId, setPrnPlanId] = useState<string>('')
  const [occurredAt, setOccurredAt] = useState<Dayjs | null>(null)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<{ slot?: string; prn?: string; time?: string }>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const regularPlans = useMemo(() => plans.filter((p) => p.plan_type === 'REGULAR'), [plans])
  const prnPlans = useMemo(() => plans.filter((p) => p.plan_type === 'PRN'), [plans])

  useEffect(() => {
    if (!open || !patientId) return
    let alive = true
    setLoading(true)
    setErrors({})
    setSubmitError(null)
    setSlotId('')
    setPrnPlanId('')
    setOccurredAt(null)
    setNote('')
    const end = new Date()
    const from = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7)
    const to = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
    Promise.all([
      apiFetch<{ items: Plan[] }>(`/api/patients/${patientId}/medication-plans?page_size=20`),
      apiFetch<{ items: Slot[] }>(
        `/api/patients/${patientId}/daily-slots?from=${localDay(from)}&to=${localDay(to)}`,
      ).catch(() => ({ items: [] as Slot[] })),
    ])
      .then(([pl, sl]) => {
        if (!alive) return
        setPlans(pl.items)
        setSlots(sl.items)
        const hasRegular = pl.items.some((p) => p.plan_type === 'REGULAR')
        const hasPrn = pl.items.some((p) => p.plan_type === 'PRN')
        setMode(hasRegular ? 'slot' : hasPrn ? 'prn' : 'slot')
        if (!hasRegular && hasPrn) setPrnPlanId(pl.items.find((p) => p.plan_type === 'PRN')!.id)
      })
      .catch((e) => {
        if (alive) message.error((e as Error).message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open, patientId])

  // 时点直接平铺成可点列表（数量少，一眼看清哪些漏登记；避免下拉 + 搜索的额外操作）
  const slotRows = useMemo(
    () =>
      slots.map((s) => {
        const d = dayjs(s.scheduled_at)
        return {
          id: s.id,
          day: d.format('MM-DD'),
          weekday: d.format('ddd'),
          time: d.format('HH:mm'),
          registered: s.has_active_record,
        }
      }),
    [slots],
  )

  const onPickSlot = (id: string) => {
    setSlotId(id)
    setErrors((e) => ({ ...e, slot: undefined }))
    const slot = slots.find((s) => s.id === id)
    if (slot) {
      setOccurredAt(dayjs(slot.scheduled_at))
      setErrors((e) => ({ ...e, time: undefined }))
    }
  }

  const submit = async () => {
    const next: typeof errors = {}
    const slot = mode === 'slot' ? slots.find((s) => s.id === slotId) : undefined
    if (mode === 'slot' && !slot) next.slot = '请选择一个时点'
    if (mode === 'prn' && !prnPlanId) next.prn = '请选择按需计划'
    if (!occurredAt) next.time = '请选择用药时间'
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }
    const planId = mode === 'slot' ? slot!.plan_id : prnPlanId
    setSubmitting(true)
    setSubmitError(null)
    try {
      const r = await apiFetch<{ event: { id: string }; is_duplicate: boolean }>('/api/medication-events', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patientId,
          plan_id: planId,
          slot_id: mode === 'slot' ? slot!.id : null,
          occurred_at: occurredAt!.format('YYYY-MM-DDTHH:mm:ssZ'),
          note: note || null,
        }),
      })
      // 先关弹窗、再提示：提示组件异常不应阻塞关闭
      onClose()
      onSuccess()
      if (r.is_duplicate) {
        message.warning('该时点已有有效登记，已按重复登记记录')
      } else {
        message.success('已补登用药记录')
      }
    } catch (e) {
      setSubmitError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const noPlan = !loading && plans.length === 0
  const fieldError = (msg?: string) =>
    msg ? <span style={{ color: 'var(--bad)', fontSize: 12 }}>{msg}</span> : null

  return (
    <Modal
      title={`补登用药 · ${patientName}`}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="确认补登"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnHidden
    >
      {noPlan ? (
        <Alert
          type="warning"
          showIcon
          message="该患者尚无用药计划"
          description="请先在患者详情中创建用药计划，再补登用药记录。"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {regularPlans.length > 0 && prnPlans.length > 0 && (
            <div>
              <div className="field-label" style={{ marginBottom: 8 }}>登记方式</div>
              <Radio.Group value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <Radio value="slot">按时点登记</Radio>
                <Radio value="prn">按需登记</Radio>
              </Radio.Group>
            </div>
          )}

          {mode === 'slot' ? (
            <div>
              <label className="field-label" style={{ display: 'block', marginBottom: 8 }}>
                漏登记的时点（近 7 天至明天）
              </label>
              {loading ? (
                <p className="muted" style={{ margin: 0 }}>加载中…</p>
              ) : slotRows.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>该区间内没有固定时点</p>
              ) : (
                <ul className="slot-pick-list">
                  {slotRows.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={`slot-pick${slotId === s.id ? ' is-selected' : ''}`}
                        disabled={s.registered}
                        onClick={() => onPickSlot(s.id)}
                        aria-pressed={slotId === s.id}
                      >
                        <span className="slot-date">{s.day} {s.weekday}</span>
                        <span className="slot-time num">{s.time}</span>
                        <span className={`slot-chip${s.registered ? ' is-done' : ''}`}>
                          {s.registered ? '已登记' : '待登记'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {fieldError(errors.slot)}
              <div className="muted" style={{ marginTop: 4 }}>已登记的时点不可重复选择</div>
            </div>
          ) : (
            <div>
              <label className="field-label" style={{ display: 'block', marginBottom: 8 }}>按需计划</label>
              <Select
                style={{ width: '100%' }}
                value={prnPlanId || undefined}
                placeholder="选择按需计划"
                options={prnPlans.map((p) => ({ value: p.id, label: `${p.drug_label || '按需计划'} · v${p.version}` }))}
                onChange={(v) => {
                  setPrnPlanId(v)
                  setErrors((e) => ({ ...e, prn: undefined }))
                }}
                status={errors.prn ? 'error' : undefined}
              />
              {fieldError(errors.prn)}
            </div>
          )}

          <div>
            <label className="field-label" style={{ display: 'block', marginBottom: 8 }}>实际用药时间</label>
            <DatePicker
              showTime
              style={{ width: '100%' }}
              format="YYYY-MM-DD HH:mm"
              value={occurredAt}
              onChange={(d) => {
                setOccurredAt(d)
                setErrors((e) => ({ ...e, time: undefined }))
              }}
              status={errors.time ? 'error' : undefined}
            />
            {fieldError(errors.time)}
          </div>

          <div>
            <label className="field-label" style={{ display: 'block', marginBottom: 8 }}>备注（可选）</label>
            <Input.TextArea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如：患者自述外出忘记携带装置"
            />
          </div>

          {submitError && (
            <Alert type="error" showIcon message="补登失败" description={submitError} />
          )}
        </div>
      )}
    </Modal>
  )
}
