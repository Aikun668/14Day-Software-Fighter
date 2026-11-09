import { useRef, useState } from 'react'
import { App, Button, Checkbox, Input, Modal } from 'antd'
import { ApiError, apiFetch } from '../api/client'
import PatientAvatar from './medix/PatientAvatar'
import { shanghaiNowIso, taskTriggerText } from '../pages/clinician/medixClinicalModel.ts'
import '../styles/medix-clinical.css'

interface TaskRef {
  id: string
  patientId: string
  patientName: string
  taskType?: string | null
}

interface Props {
  open: boolean
  task: TaskRef | null
  onClose: () => void
  /** 保存成功后由调用方刷新。刷新失败应拒绝，不能当成提交失败。 */
  onSuccess: () => void | Promise<unknown>
  /** 409 或结果未确认时只读刷新，不表示本次说明已保存。 */
  onInvalidate?: () => void | Promise<unknown>
  onDirtyChange?: (dirty: boolean) => void
  /** 只在 Medix 页面启用。未传时保留原来的弹窗外观。 */
  appearance?: 'medix'
}

/**
 * 快速处理待核查任务。
 * 关闭任务必须走随访：POST /api/followups 且 close_task=true。
 * PATCH /tasks 只能转到 IN_PROGRESS，不能用来关闭。
 */
export default function TaskCloseModal({
  open,
  task,
  onClose,
  onSuccess,
  onInvalidate,
  onDirtyChange,
  appearance,
}: Props) {
  const { message } = App.useApp()
  const [note, setNote] = useState('')
  const [retrain, setRetrain] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [formKey, setFormKey] = useState<string | null>(null)
  const lock = useRef(false)
  const noteRef = useRef<HTMLTextAreaElement | null>(null)
  const activeKey = open ? task?.id ?? null : null
  if (formKey !== activeKey) {
    setFormKey(activeKey)
    setNote('')
    setRetrain(false)
    setError(null)
    setBlocked(false)
    setUncertain(false)
    setSubmitting(false)
  }

  const publishDirty = (nextNote: string, nextRetrain: boolean) => {
    onDirtyChange?.(nextNote.trim().length > 0 || nextRetrain)
  }

  const cleanup = () => {
    setNote('')
    setRetrain(false)
    setError(null)
    setBlocked(false)
    setUncertain(false)
    onDirtyChange?.(false)
  }

  const dismiss = () => {
    if (lock.current) return
    cleanup()
    onClose()
  }

  const submit = async () => {
    if (lock.current || !task || blocked || uncertain) return
    const feedback = note.trim()
    if (!feedback) {
      setError('请填写处理说明')
      noteRef.current?.focus()
      return
    }
    if (feedback.length > 200) {
      setError('处理说明最多 200 字')
      noteRef.current?.focus()
      return
    }
    lock.current = true
    setSubmitting(true)
    setError(null)
    try {
      await apiFetch('/api/followups', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: task.patientId,
          task_id: task.id,
          followed_at: shanghaiNowIso(),
          feedback,
          close_task: true,
          create_retraining_reminder: retrain,
        }),
      })
      message.success(appearance === 'medix' ? '已处理' : '任务已处理并关闭')
      try {
        await onSuccess()
      } catch {
        message.warning('已保存，列表刷新失败')
      }
      lock.current = false
      setSubmitting(false)
      cleanup()
      onClose()
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        setError('任务已关闭')
        setBlocked(true)
        try { await onInvalidate?.() } catch { /* 列表刷新失败时保留提示，不再次提交 */ }
      } else if (reason instanceof ApiError && reason.status === 422) {
        setError('任务不匹配，请返回列表重新选择')
        setBlocked(true)
      } else if (reason instanceof ApiError && (reason.status === 403 || reason.status === 404)) {
        setError('资源不可访问')
        setBlocked(true)
      } else if (reason instanceof ApiError) {
        setError(reason.message)
      } else {
        setUncertain(true)
        setError('结果未确认，请刷新核对')
      }
      lock.current = false
      setSubmitting(false)
    }
  }

  const checkResult = async () => {
    try {
      await onInvalidate?.()
      setUncertain(false)
      setError('列表已刷新。请核对是否已保存；未保存可再次确认处理。')
    } catch {
      setError('列表刷新失败。请稍后再核对，不要重复提交。')
    }
  }

  const medix = appearance === 'medix'
  const reason = taskTriggerText(task?.taskType)
  return (
    <Modal
      title="处理任务"
      open={open}
      width={medix ? '35rem' : undefined}
      onCancel={dismiss}
      mask={{ closable: !submitting }}
      keyboard={!submitting}
      closable={!submitting}
      focusable={{ focusTriggerAfterClose: true }}
      classNames={medix ? { root: 'ml-shell ml-task-close' } : undefined}
      footer={[
        uncertain ? <Button key="check" onClick={() => void checkResult()}>刷新核对</Button> : null,
        <Button key="cancel" disabled={submitting} onClick={dismiss}>取消</Button>,
        <Button key="ok" type="primary" loading={submitting} disabled={!task || blocked || uncertain} onClick={() => void submit()}>
          确认处理
        </Button>,
      ]}
      destroyOnHidden
    >
      <div className={medix ? 'ml-dialog-body' : undefined} aria-busy={submitting} style={medix ? undefined : { display: 'flex', flexDirection: 'column', gap: 16 }}>
        {medix ? (
          <div className="ml-modal-who">
            <PatientAvatar name={task?.patientName || ''} patientId={task?.patientId || ''} />
            <div>
              <div className="ml-modal-name">{task?.patientName}</div>
              <p className="ml-task-reason">{task ? reason : ''}</p>
            </div>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>{task ? reason : ''}</p>
        )}
        <div>
          <label className={medix ? 'ml-field-label' : 'field-label'} htmlFor="ml-task-note" style={medix ? undefined : { display: 'block', marginBottom: 8 }}>
            处理说明（必填）
          </label>
          <Input.TextArea
            id="ml-task-note"
            rows={medix ? 6 : 3}
            value={note}
            maxLength={200}
            showCount
            disabled={submitting || blocked}
            ref={(node) => {
              noteRef.current = node?.resizableTextArea?.textArea ?? null
            }}
            onChange={(event) => {
              setNote(event.target.value)
              setError(null)
              publishDirty(event.target.value, retrain)
            }}
            placeholder={medix ? '填写处理说明' : '如：已电话联系，患者说明本周外出忘记携带装置，已提醒规律用药'}
          />
        </div>
        <Checkbox
          checked={retrain}
          disabled={submitting || blocked}
          onChange={(event) => {
            setRetrain(event.target.checked)
            publishDirty(note, event.target.checked)
          }}
        >
          安排操作复训提醒
        </Checkbox>
        {error ? <span className="ml-field-error" role="alert">{error}</span> : null}
      </div>
    </Modal>
  )
}
