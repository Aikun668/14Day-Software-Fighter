import { useClinicalQuery } from '../../components/medix/useClinicalQuery'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, DatePicker, Form, Input, Modal, Radio, Select, TimePicker, message } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import { PageHeading } from '../../components/medix/Medix'
import { ClinicalPanel, LoadError, PatientPicker } from '../../components/medix/ClinicalUI'
import { addDays, cleanDemo, derivePlanPhase, errorText, fetchAll, midnight, phaseLabel, planDateRange, shanghaiDay, validTimes, type MedicationPlan, type MedixPatient } from '../../components/medix/clinical'

interface PlanForm { device_model_id: string; drug_label: string; plan_type: 'REGULAR' | 'PRN'; starts_at: Dayjs; ends_at?: Dayjs }
export default function PlanEditPage() {
  const [params] = useSearchParams()
  const [selected, setSelected] = useState<string | undefined>(params.get('patientId') || undefined)
  const [form] = Form.useForm<PlanForm>()
  const [times, setTimes] = useState<string[]>([])
  const [timeError, setTimeError] = useState('')
  const [adding, setAdding] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  const [now, setNow] = useState(() => Date.now())
  const [shown, setShown] = useState(5)
  const [modal, contextHolder] = Modal.useModal()
  const patients = useClinicalQuery('plans-patients', useCallback(signal => fetchAll<MedixPatient>('/api/patients', signal), []))
  const models = useClinicalQuery('plans-models', useCallback(signal => fetchAll<{ id: string; model_name: string }>('/api/device-models', signal), []))
  const history = useClinicalQuery(`plans-${selected}`, useCallback(signal => fetchAll<MedicationPlan>(`/api/patients/${selected}/medication-plans?include_history=true`, signal), [selected]), !!selected)
  const planType = Form.useWatch('plan_type', form)
  useEffect(() => { const update = () => setNow(Date.now()); window.addEventListener('focus', update); return () => window.removeEventListener('focus', update) }, [])
  const resetDraft = () => { form.resetFields(); setTimes([]); setTimeError(''); setAdding(false); setDirty(false) }
  const choose = (id: string) => {
    if (id === selected || lock.current) return
    const apply = () => { setSelected(id); resetDraft(); setShown(5); setNow(Date.now()) }
    if (dirty) modal.confirm({ title: '切换患者将清空未保存内容', okText: '切换患者', cancelText: '取消', onOk: apply })
    else apply()
  }
  const submit = async (v: PlanForm) => {
    if (!selected || lock.current) return
    if (v.plan_type === 'REGULAR' && !validTimes(times)) { setTimeError('请添加至少一个合法且不重复的时点'); return }
    lock.current = true; setSaving(true)
    try {
      await apiFetch(`/api/patients/${selected}/medication-plans`, { method: 'POST', body: JSON.stringify({
        device_model_id: v.device_model_id, drug_label: v.drug_label.trim(), plan_type: v.plan_type, timezone: 'Asia/Shanghai',
        starts_at: midnight(v.starts_at.format('YYYY-MM-DD')), ends_at: v.ends_at ? midnight(addDays(v.ends_at.format('YYYY-MM-DD'), 1)) : null,
        daily_times: v.plan_type === 'REGULAR' ? [...times].sort().map((local_time, i) => ({ local_time, label: `时点${i + 1}` })) : [],
      }) })
      message.success('计划已创建'); resetDraft(); setShown(5); setNow(Date.now()); history.retry()
    } catch (e) { message.error(errorText(e)) } finally { lock.current = false; setSaving(false) }
  }
  return <div className="ml-clinical-page ml-plan-page">{contextHolder}
    <PageHeading title="用药计划"><PatientPicker patients={patients.data ?? []} value={selected} onChange={choose} disabled={saving} loading={patients.loading} /></PageHeading>
    {patients.error && <LoadError error={patients.error} retry={patients.retry} />}
    <div className="ml-plan-grid">
      <ClinicalPanel title="新建计划">
        {models.error && <LoadError error={models.error} retry={models.retry} />}
        <Form form={form} className="ml-plan-form" layout="vertical" requiredMark={false} disabled={!selected || saving} initialValues={{ plan_type: 'REGULAR', starts_at: dayjs(shanghaiDay()) }} onValuesChange={() => setDirty(true)} onFinish={submit}
          onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).closest('.ant-picker')) event.preventDefault() }}>
          <Form.Item name="device_model_id" label="装置型号" rules={[{ required: true, message: '请选择装置型号' }]}><Select placeholder="请选择装置型号" loading={models.loading} options={(models.data ?? []).map(m => ({ value: m.id, label: m.model_name }))} /></Form.Item>
          <Form.Item name="drug_label" label="药物名称" rules={[{ required: true, whitespace: true, message: '请输入药物名称' }]}><Input placeholder="请输入药物名称" /></Form.Item>
          <Form.Item name="plan_type" label="计划类型"><Radio.Group><Radio value="REGULAR">固定</Radio><Radio value="PRN">按需</Radio></Radio.Group></Form.Item>
          <div className="ml-form-date-pair">
            <Form.Item name="starts_at" label="开始日期" rules={[{ required: true, message: '请选择开始日期' }]}><DatePicker allowClear={false} /></Form.Item>
            <Form.Item name="ends_at" label="结束日期（选填）" dependencies={['starts_at']} rules={[({ getFieldValue }) => ({ validator(_, value: Dayjs | undefined) { return value && getFieldValue('starts_at') && value.isBefore(getFieldValue('starts_at'), 'day') ? Promise.reject(new Error('结束日期不能早于开始日期')) : Promise.resolve() } })]}><DatePicker placeholder="请选择日期" /></Form.Item>
          </div>
          {planType === 'REGULAR' && <div className="ml-time-field"><label>每日时点</label><div className="ml-time-editor">
            {times.map(t => <span className="ml-time-item" key={t}><TimePicker aria-label={`每日时点 ${t}`} value={dayjs(`2000-01-01T${t}`)} format="HH:mm" allowClear={false} needConfirm={false} onChange={d => {
              if (!d) return; const next = d.format('HH:mm'); if (next !== t && times.includes(next)) { setTimeError('时点不能重复'); return }
              setTimes(times.map(x => x === t ? next : x).sort()); setTimeError(''); setDirty(true)
            }} /><button type="button" disabled={saving || !selected} aria-label={`删除时点 ${t}`} onClick={() => { setTimes(times.filter(x => x !== t)); setDirty(true) }}><CloseOutlined /></button></span>)}
            {adding ? <TimePicker aria-label="添加每日时点" autoFocus format="HH:mm" needConfirm={false} onChange={d => { if (!d) return; const t = d.format('HH:mm'); if (times.includes(t)) { setTimeError('时点不能重复'); return }; setTimes([...times, t].sort()); setTimeError(''); setAdding(false); setDirty(true) }} /> : <Button onClick={() => setAdding(true)}>添加时点</Button>}
          </div>{timeError && <div className="ml-section-error" role="alert">{timeError}</div>}</div>}
          <Button type="primary" htmlType="submit" loading={saving}>创建计划</Button>
        </Form>
      </ClinicalPanel>
      <ClinicalPanel title="历史计划">
        {!selected ? <p className="ml-empty">请选择患者</p> : history.loading ? <p className="ml-empty">加载中…</p> : history.error ? <LoadError error={history.error} retry={history.retry} /> : !history.data?.length ? <p className="ml-empty">暂无计划</p> : <>
          <ul className="ml-plan-history">{history.data.slice(0, shown).map(p => { const phase = derivePlanPhase(p, now); return <li key={p.id}><div className="ml-history-heading"><strong>{cleanDemo(p.drug_label)}</strong><span className={`ml-phase ml-phase-${phase}`}>{phaseLabel[phase]}</span></div><div className="ml-history-meta"><span>{phase === 'invalid' ? '日期不可用' : planDateRange(p)}</span><span>{p.plan_type === 'PRN' ? '按需' : p.daily_times.filter(t => t.is_enabled !== false).map(t => t.local_time.slice(0, 5)).sort().join(' · ')}</span></div></li> })}</ul>
          {history.data.length > shown && <button className="ml-text-button" type="button" onClick={() => setShown(n => n + 5)}>加载更多（共 {history.data.length} 条）</button>}
        </>}
      </ClinicalPanel>
    </div>
  </div>
}
