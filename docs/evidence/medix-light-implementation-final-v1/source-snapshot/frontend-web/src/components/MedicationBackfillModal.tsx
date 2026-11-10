import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, DatePicker, Input, Modal, Radio, Select, message } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { ApiError, apiFetch } from '../api/client'
import { PatientAvatar } from './medix/Medix'
import { LoadError } from './medix/ClinicalUI'
import { addDays, fetchAll, shanghaiDay, shanghaiParts, shortTime, type MedicationPlan } from './medix/clinical'
import { useClinicalQuery } from './medix/useClinicalQuery'
import '../styles/medix-dialogs.css'

interface Slot { id: string; plan_id: string; patient_id: string; scheduled_at: string; state: string; has_active_record: boolean }
interface Props {
  open: boolean; patientId: string | null; patientName: string; patientCode?: string; avatarUrl?: string | null; demoPatient?: boolean
  onClose: () => void; onSuccess: () => void | Promise<void>
}
const pickerTime = (iso: string) => { const p = shanghaiParts(iso); return dayjs(`${p.day}T${p.time}`) }
const timestamp = (d: Dayjs) => `${d.format('YYYY-MM-DDTHH:mm:ss')}+08:00`
const eligible = (slot: Slot) => slot.state === 'ACTIVE' && !slot.has_active_record && Date.parse(slot.scheduled_at) <= Date.now()
export default function MedicationBackfillModal(props: Props) {
  return props.open && props.patientId ? <BackfillDialog key={props.patientId} {...props} patientId={props.patientId} /> : null
}
function BackfillDialog({ patientId, patientName, patientCode, avatarUrl, demoPatient, onClose, onSuccess }: Props & { patientId: string }) {
  const [mode, setMode] = useState<'slot' | 'prn' | null>(null), [slotId, setSlotId] = useState(''), [prnId, setPrnId] = useState('')
  const [occurredAt, setOccurredAt] = useState<Dayjs | null>(null), [note, setNote] = useState('')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [unknown, setUnknown] = useState(false)
  const [invalidField, setInvalidField] = useState<'slot' | 'prn' | 'time' | null>(null)
  const invalid = (field: 'slot' | 'prn' | 'time', text: string) => {
    setInvalidField(field); setError(text)
    requestAnimationFrame(() => { const el = field === 'slot' ? document.querySelector<HTMLElement>('.ml-slot-options input:checked, .ml-slot-options input:not(:disabled)') : document.getElementById(field === 'prn' ? 'backfill-prn' : 'backfill-time'); el?.scrollIntoView({ block: 'nearest' }); el?.focus() })
  }
  const lock = useRef(false), opener = useRef(document.activeElement as HTMLElement | null)
  const [today] = useState(shanghaiDay)
  const plansLoader = useCallback((signal: AbortSignal) => fetchAll<MedicationPlan>(`/api/patients/${patientId}/medication-plans?include_history=true`, signal), [patientId])
  const slotsLoader = useCallback((signal: AbortSignal) => apiFetch<{ items: Slot[] }>(`/api/patients/${patientId}/daily-slots?from=${addDays(today, -6)}&to=${addDays(today, 1)}`, { signal }), [patientId, today])
  const plansQuery = useClinicalQuery(patientId, plansLoader), slotsQuery = useClinicalQuery(patientId, slotsLoader)
  const plans = plansQuery.data ?? [], slots = slotsQuery.data?.items ?? []
  const prnPlans = plans.filter(p => p.plan_type === 'PRN')
  const hasFixed = slots.length > 0 || plans.some(p => p.plan_type === 'REGULAR')
  const currentMode = mode ?? (hasFixed || !prnPlans.length ? 'slot' : 'prn')
  const loading = plansQuery.loading || slotsQuery.loading, readError = !!plansQuery.error || !!slotsQuery.error
  const disabled = busy || blocked
  useEffect(() => { const el = opener.current; return () => { requestAnimationFrame(() => el?.isConnected && el.focus()) } }, [])
  const finish = async (duplicate = false) => {
    message.success(duplicate ? '已保存，该时点已有登记' : '已补登用药记录'); onClose()
    try { await onSuccess() } catch { message.warning('记录已保存，列表刷新失败，请重试读取') }
  }
  const verify = async () => {
    setBusy(true)
    try {
      const records = await fetchAll<{ status: string; slot_id: string | null; plan_id: string; occurred_at: string }>(`/api/patients/${patientId}/medication-events`)
      if (records.some(r => r.status === 'ACTIVE' && (currentMode === 'slot' ? r.slot_id === slotId : r.plan_id === prnId && Date.parse(r.occurred_at) === Date.parse(timestamp(occurredAt!))))) { setError('找到该时点或计划的登记，请返回页面核对结果'); try { await onSuccess() } catch { /* Parent exposes its read error. */ } }
      else setError('未找到本次记录，请返回页面核对后再补登')
    } catch { setError('核对失败，请重试读取') } finally { setBusy(false) }
  }
  const submit = async () => {
    if (lock.current || blocked || loading || readError) return
    const slot = slots.find(s => s.id === slotId)
    if (currentMode === 'slot' && (!slot || !eligible(slot))) { invalid('slot', '请选择已到期且未登记的时点'); return }
    if (slot && (slot.patient_id !== patientId || !plans.some(p => p.id === slot.plan_id && p.plan_type === 'REGULAR'))) { invalid('slot', '时点与患者或计划不匹配，请刷新后重新选择'); return }
    if (!occurredAt || !occurredAt.isValid()) { invalid('time', '请选择实际用药时间'); return }
    const occurred = timestamp(occurredAt), ms = Date.parse(occurred)
    if (ms > Date.now()) { invalid('time', '实际用药时间不能晚于当前时间'); return }
    const plan = plans.find(p => p.id === (currentMode === 'slot' ? slot!.plan_id : prnId))
    if (currentMode === 'prn' && (!plan || plan.plan_type !== 'PRN' || ms < Date.parse(plan.starts_at) || (plan.ends_at && ms >= Date.parse(plan.ends_at)))) { invalid('prn', '请选择在该用药时间生效的按需计划'); return }
    lock.current = true; setBusy(true); setError('')
    let result: { is_duplicate: boolean }
    try {
      result = await apiFetch('/api/medication-events', { method: 'POST', body: JSON.stringify({ patient_id: patientId, plan_id: currentMode === 'slot' ? slot!.plan_id : prnId, slot_id: currentMode === 'slot' ? slot!.id : null, occurred_at: occurred, note: note.trim() || null }) })
    } catch (e) {
      if (!(e instanceof ApiError) || e.status >= 500) { setBlocked(true); setUnknown(true); setError('结果未确认，请刷新核对') }
      else { setError(e.message); if ([403, 404].includes(e.status)) setBlocked(true); if (e.status === 409) slotsQuery.retry() }
      lock.current = false; setBusy(false); return
    }
    await finish(result.is_duplicate); lock.current = false; setBusy(false)
  }
  return <Modal open centered width="35rem" title="补登用药" rootClassName="ml-theme ml-action-dialog" onCancel={() => !lock.current && onClose()} closable={!busy} maskClosable={!busy} keyboard={!busy} footer={<><Button disabled={busy} onClick={onClose}>取消</Button><Button type="primary" loading={busy} disabled={blocked || loading || readError || (!plans.length && !slots.length)} onClick={submit}>确认补登</Button></>}>
    <div className="ml-dialog-body" aria-busy={busy || loading}>
      <div className="ml-dialog-person"><PatientAvatar code={patientCode} src={avatarUrl} demoPatient={demoPatient} /><strong>{patientName}</strong></div>
      {plansQuery.error && <LoadError error={`计划加载失败：${plansQuery.error}`} retry={plansQuery.retry} />}
      {slotsQuery.error && <LoadError error={`时点加载失败：${slotsQuery.error}`} retry={slotsQuery.retry} />}
      {loading ? <p className="ml-empty">加载中…</p> : !readError && !plans.length && !slots.length ? <p className="ml-empty">该患者尚无用药计划</p> : !readError && <>
        {hasFixed && prnPlans.length > 0 && <Radio.Group aria-label="登记方式" value={currentMode} disabled={disabled} onChange={e => { setMode(e.target.value); setSlotId(''); setPrnId(''); setOccurredAt(null); setError(''); setInvalidField(null) }}><Radio value="slot">按时点登记</Radio><Radio value="prn">按需登记</Radio></Radio.Group>}
        {currentMode === 'slot' ? <div className="ml-dialog-field"><label id="backfill-slots-label">选择计划时点</label>
          {!slots.length ? <p className="ml-empty">近7日内没有固定时点</p> : <Radio.Group className={`ml-slot-options${invalidField === 'slot' ? ' is-invalid' : ''}`} aria-labelledby="backfill-slots-label" value={slotId} disabled={disabled} onChange={e => { if (disabled) return; setSlotId(e.target.value); const s = slots.find(x => x.id === e.target.value)!; setOccurredAt(pickerTime(s.scheduled_at)); setError(''); setInvalidField(null) }}>
            {slots.map(s => <Radio key={s.id} value={s.id} disabled={disabled || !eligible(s)}><span>{shortTime(s.scheduled_at)}{slots.some(x => x.id !== s.id && x.scheduled_at === s.scheduled_at) ? ` · ${plans.find(p => p.id === s.plan_id)?.drug_label || '计划不可用'}` : ''}</span>{!eligible(s) && <small>{s.has_active_record ? '已登记' : s.state !== 'ACTIVE' ? '已取消' : '未到时点'}</small>}</Radio>)}
          </Radio.Group>}
          {!!slots.length && !slots.some(eligible) && <p className="ml-empty">暂无可补登时点</p>}
        </div> : <div className="ml-dialog-field"><label htmlFor="backfill-prn">按需计划</label><Select id="backfill-prn" status={invalidField === 'prn' ? 'error' : undefined} value={prnId || undefined} disabled={disabled} placeholder="选择按需计划" options={prnPlans.map(p => ({ value: p.id, label: `${p.drug_label || '按需计划'} · v${p.version}` }))} onChange={v => { setPrnId(v); setError(''); setInvalidField(null) }} /></div>}
        <div className="ml-dialog-field"><label htmlFor="backfill-time">实际用药时间</label><DatePicker id="backfill-time" status={invalidField === 'time' ? 'error' : undefined} showTime format="YYYY-MM-DD HH:mm" disabled={disabled} value={occurredAt} onChange={d => { setOccurredAt(d); setError(''); setInvalidField(null) }} /></div>
        <div className="ml-dialog-field"><label htmlFor="backfill-note">备注</label><Input.TextArea id="backfill-note" rows={3} disabled={disabled} value={note} onChange={e => setNote(e.target.value)} placeholder="补充说明" /></div>
      </>}
      {error && <div aria-live="polite"><Alert type="error" title={error} action={unknown ? <Button disabled={busy} onClick={verify}>刷新核对</Button> : undefined} /></div>}
    </div>
  </Modal>
}

