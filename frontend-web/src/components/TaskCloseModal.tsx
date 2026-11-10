import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Input, Modal, message } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import { ApiError, apiFetch } from '../api/client'
import { PatientAvatar } from './medix/Medix'
import { fetchAll } from './medix/clinical'
import '../styles/medix-dialogs.css'

export interface CloseTask { id: string; patientId: string; patientName: string; taskType?: string; patientCode?: string; avatarUrl?: string | null; demoPatient?: boolean }
interface Props { open: boolean; task: CloseTask | null; onClose: () => void; onSuccess: () => void | Promise<void> }
export default function TaskCloseModal(props: Props) {
  return props.open && props.task ? <TaskDialog key={props.task.id} {...props} task={props.task} /> : null
}
function TaskDialog({ task, onClose, onSuccess }: Props & { task: CloseTask }) {
  const [note, setNote] = useState(''), [retrain, setRetrain] = useState(false)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [unknown, setUnknown] = useState(false)
  const lock = useRef(false), input = useRef<TextAreaRef>(null)
  const opener = useRef(document.activeElement as HTMLElement | null)
  useEffect(() => { const el = opener.current; return () => { requestAnimationFrame(() => el?.isConnected && el.focus()) } }, [])
  const refresh = async () => { try { await onSuccess() } catch { message.warning('任务已更新，列表刷新失败，请重试读取') } }
  const finish = async () => { message.success('任务已处理并关闭'); onClose(); await refresh() }
  const verify = async () => {
    setBusy(true)
    try {
      const records = await fetchAll<{ task_id: string; feedback: string }>(`/api/patients/${task.patientId}/followups`)
      if (records.some(r => r.task_id === task.id && r.feedback === note.trim())) { await refresh(); setError('找到相同任务的记录，请返回列表核对处理结果') }
      else { await refresh(); setError('未找到本次记录，请返回列表核对后再处理') }
    } catch { setError('核对失败，请重试读取') } finally { setBusy(false) }
  }
  const submit = async () => {
    if (lock.current || blocked) return
    if (!note.trim() || note.trim().length > 200) { setError('请填写 1–200 字处理说明'); input.current?.focus(); return }
    lock.current = true; setBusy(true); setError('')
    try {
      await apiFetch('/api/followups', { method: 'POST', body: JSON.stringify({ patient_id: task.patientId, task_id: task.id, followed_at: new Date().toISOString(), feedback: note.trim(), close_task: true, create_retraining_reminder: retrain }) })
    } catch (e) {
      if (!(e instanceof ApiError) || e.status >= 500) { setUnknown(true); setBlocked(true); setError('结果未确认，请刷新核对') }
      else if (e.status === 409) { setBlocked(true); setError('任务已关闭，请返回列表核对'); await refresh() }
      else if ([403, 404, 422].includes(e.status)) { setBlocked(true); setError(e.status === 422 ? '任务关联已变更，请返回列表重新选择' : '任务不可访问，请返回列表') }
      else setError(e.message)
      lock.current = false; setBusy(false); return
    }
    await finish(); lock.current = false; setBusy(false)
  }
  return <Modal open centered width="35rem" title="处理任务" rootClassName="ml-theme ml-action-dialog" onCancel={() => !lock.current && onClose()} closable={!busy} keyboard={!busy} maskClosable={!busy} footer={<><Button disabled={busy} onClick={onClose}>取消</Button><Button type="primary" loading={busy} disabled={blocked} onClick={submit}>确认处理</Button></>}>
    <div className="ml-dialog-body" aria-busy={busy}>
      <div className="ml-dialog-person"><PatientAvatar code={task.patientCode} src={task.avatarUrl} demoPatient={task.demoPatient} /><div><strong>{task.patientName}</strong><p>{task.taskType === 'MISSED_MEDICATION' ? '连续3个到期时点未发现登记' : '待核查任务'}</p></div></div>
      <div className="ml-dialog-field"><label htmlFor="task-close-note">处理说明</label><Input.TextArea id="task-close-note" ref={input} rows={6} maxLength={200} showCount value={note} disabled={busy || blocked} onChange={e => { setNote(e.target.value); setError('') }} placeholder="填写处理说明" status={error && !blocked ? 'error' : undefined} /></div>
      <Checkbox disabled={busy || blocked} checked={retrain} onChange={e => setRetrain(e.target.checked)}>安排操作复训提醒</Checkbox>
      {error && <div aria-live="polite"><Alert type="error" title={error} action={unknown ? <Button size="small" disabled={busy} onClick={verify}>刷新核对</Button> : undefined} /></div>}
    </div>
  </Modal>
}

