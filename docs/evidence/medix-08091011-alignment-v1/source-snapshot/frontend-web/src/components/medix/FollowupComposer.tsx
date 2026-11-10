import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Checkbox, DatePicker, Form, Input, Modal, Select, message } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { ApiError, apiFetch } from '../../api/client'
import { ClinicalPanel, LoadError } from './ClinicalUI'
import { fetchAll, shanghaiParts, shortTime, type MedixPatient } from './clinical'
import { useClinicalQuery } from './useClinicalQuery'
interface Task { id: string; patient_id: string; status: string; created_at: string }
interface Values { task_id?: string; followed_at: Dayjs; feedback?: string; action_taken?: string; next_plan?: string; close_task?: boolean; create_retraining_reminder?: boolean }
interface Props { patients: MedixPatient[]; initialPatient?: string; initialTask?: string; onDirty: (dirty: boolean) => void; onPosting: (busy: boolean) => void; onPatient: (id: string) => void; onCancel: () => void; onSaved: () => void; onRefresh: () => void }
const nowShanghai = () => { const p = shanghaiParts(new Date().toISOString()); return dayjs(`${p.day}T${p.time}`) }
export default function FollowupComposer({ patients, initialPatient, initialTask, onDirty, onPosting, onPatient, onCancel, onSaved, onRefresh }: Props) {
  const [patient, setPatient] = useState(initialPatient), [busy, setBusy] = useState(false), [error, setError] = useState(''), [blocked, setBlocked] = useState(false), [unknown, setUnknown] = useState(false)
  const [form] = Form.useForm<Values>(), [modal, contextHolder] = Modal.useModal()
  const lock = useRef(false), dirty = useRef(false), root = useRef<HTMLDivElement>(null), attempt = useRef<Record<string, unknown> | null>(null)
  const taskId = Form.useWatch('task_id', form)
  const loader = useCallback((signal: AbortSignal) => fetchAll<Task>(`/api/tasks?patient_id=${patient}`, signal), [patient])
  const query = useClinicalQuery(patient ?? '', loader, !!patient)
  const tasks = (query.data ?? []).filter(t => t.patient_id === patient && ['OPEN', 'IN_PROGRESS'].includes(t.status))
  useEffect(() => { root.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); root.current?.querySelector<HTMLElement>('[role="combobox"]')?.focus() }, [])
  const changePatient = (id: string) => {
    const change = () => { setPatient(id); onPatient(id); form.resetFields(); form.setFieldsValue({ task_id: undefined, followed_at: nowShanghai(), close_task: false, create_retraining_reminder: false }); setError(''); setBlocked(false); setUnknown(false); dirty.current = true; onDirty(true) }
    if (dirty.current) modal.confirm({ title: '切换患者并清空未保存内容？', okText: '切换', cancelText: '继续填写', centered: true, onOk: change })
    else change()
  }
  const verify = async () => {
    if (lock.current) return
    lock.current = true; setBusy(true); onPosting(true)
    try {
      const rows = await fetchAll<Record<string, unknown>>(`/api/patients/${patient}/followups`)
      const a = attempt.current
      if (a && rows.some(r => Date.parse(String(r.followed_at)) === Date.parse(String(a.followed_at)) && ['task_id', 'feedback', 'action_taken', 'next_plan'].every(k => (r[k] ?? null) === (a[k] ?? null)))) { onRefresh(); setError('找到相同内容的随访，请核对列表确认结果') }
      else { onRefresh(); setError('未找到本次记录，请核对列表后再新建') }
    } catch { setError('核对失败，请重试读取') } finally { lock.current = false; setBusy(false); onPosting(false) }
  }
  const submit = async (v: Values) => {
    if (lock.current || blocked) return
    if (!patient || !patients.some(p => p.id === patient)) { setError('请选择可访问的患者'); return }
    if (v.task_id && (!tasks.some(t => t.id === v.task_id && t.patient_id === patient) || query.loading || query.error)) { form.setFields([{ name: 'task_id', errors: ['关联任务不可用，请重新选择'] }]); return }
    if (v.close_task && !v.task_id) { setError('请选择要关闭的任务'); return }
    lock.current = true; setBusy(true); onPosting(true); setError('')
    const payload = { patient_id: patient, task_id: v.task_id || null, followed_at: `${v.followed_at.format('YYYY-MM-DDTHH:mm:ss')}+08:00`, feedback: v.feedback?.trim() || null, action_taken: v.action_taken?.trim() || null, next_plan: v.next_plan?.trim() || null, close_task: !!v.close_task, create_retraining_reminder: !!v.create_retraining_reminder }
    attempt.current = payload
    try { await apiFetch('/api/followups', { method: 'POST', body: JSON.stringify(payload) }) }
    catch (e) {
      if (!(e instanceof ApiError) || e.status >= 500) { setBlocked(true); setUnknown(true); setError('结果未确认，请刷新核对') }
      else if (e.status === 409) { setError('任务已关闭，内容已保留，请重新选择关联任务'); query.retry(); onRefresh(); form.setFields([{ name: 'task_id', errors: ['任务已关闭，请重新选择或手动取消关联'] }]) }
      else if ([403, 404].includes(e.status)) { setBlocked(true); setError('患者或任务不可访问，请返回列表') }
      else if (e.status === 422) form.setFields([{ name: 'task_id', errors: [e.message] }])
      else setError(e.message)
      lock.current = false; setBusy(false); onPosting(false); return
    }
    message.success('随访已保存'); lock.current = false; setBusy(false); onPosting(false); onDirty(false); onSaved()
  }
  return <div ref={root} className="ml-follow-composer">
    {contextHolder}
    <ClinicalPanel title="记录随访">
      <Form className="ml-follow-form" form={form} layout="vertical" requiredMark={false} disabled={busy || blocked} initialValues={{ task_id: initialTask, followed_at: nowShanghai(), close_task: false, create_retraining_reminder: false }} onValuesChange={() => { dirty.current = true; onDirty(true) }} onFinish={submit} onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLElement).closest('.ant-picker')) e.preventDefault() }}>
        <div className="ml-follow-form-grid">
          <Form.Item label="患者"><Select aria-label="随访患者" value={patient} placeholder="选择患者" showSearch optionFilterProp="search" options={patients.map(p => ({ value: p.id, label: p.display_name, search: p.display_name + p.patient_code }))} onChange={changePatient} /></Form.Item>
          <Form.Item label="随访时间" name="followed_at" rules={[{ required: true, message: '请选择随访时间' }]}><DatePicker showTime format="YYYY-MM-DD HH:mm" /></Form.Item>
        </div>
        <Form.Item label="关联任务" name="task_id"><Select allowClear placeholder="选择关联任务" loading={query.loading} disabled={!patient || busy || blocked || !!query.error || query.loading} options={tasks.map(t => ({ value: t.id, label: `待核查任务 · ${shortTime(t.created_at)}` }))} onChange={() => form.setFieldValue('close_task', false)} /></Form.Item>
        {query.error && <LoadError error={query.error} retry={query.retry} />}
        <Form.Item label="反馈" name="feedback"><Input.TextArea rows={2} /></Form.Item>
        <div className="ml-follow-form-grid"><Form.Item label="措施" name="action_taken"><Input.TextArea rows={2} /></Form.Item><Form.Item label="后续" name="next_plan"><Input.TextArea rows={2} /></Form.Item></div>
        <div className="ml-follow-checks"><Form.Item name="close_task" valuePropName="checked" noStyle><Checkbox disabled={!taskId || busy || blocked}>关闭关联任务</Checkbox></Form.Item><Form.Item name="create_retraining_reminder" valuePropName="checked" noStyle><Checkbox>安排操作复训提醒</Checkbox></Form.Item></div>
        {error && <Alert role="alert" type="error" title={error} action={unknown ? <Button disabled={busy} onClick={verify}>刷新核对</Button> : undefined} />}
        <div className="ml-follow-submit"><Button disabled={busy} onClick={onCancel}>取消</Button><Button htmlType="submit" type="primary" loading={busy} disabled={blocked}>保存随访</Button></div>
      </Form>
    </ClinicalPanel>
  </div>
}

