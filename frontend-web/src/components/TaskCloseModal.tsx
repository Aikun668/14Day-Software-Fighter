import { useState } from 'react'
import { Alert, Button, Checkbox, Input, Modal, message } from 'antd'
import dayjs from 'dayjs'
import { apiFetch } from '../api/client'

interface Props {
  open: boolean
  task: { id: string; patientId: string; patientName: string } | null
  onClose: () => void
  /** 关闭成功后回调（父页面刷新） */
  onSuccess: () => void
}

/**
 * 快速处理待核查任务：填写一句处理说明并关闭任务。
 *
 * 说明：后端规定任务关闭必须走随访（PATCH /tasks 仅允许转 IN_PROGRESS），
 * 因此这里提交一条带 task_id 的随访记录并置 close_task=true，
 * 处理人、时间、关联任务都在随访记录与审计里可追溯（PRD FUP-01）。
 */
export default function TaskCloseModal({ open, task, onClose, onSuccess }: Props) {
  const [note, setNote] = useState('')
  const [retrain, setRetrain] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const close = () => {
    setNote('')
    setRetrain(false)
    setError(null)
    onClose()
  }

  const submit = async () => {
    if (!task) return
    if (!note.trim()) {
      setError('请填写处理说明（如：已电话联系，患者说明忘记携带装置）')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await apiFetch('/api/followups', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: task.patientId,
          task_id: task.id,
          followed_at: dayjs().format('YYYY-MM-DDTHH:mm:ssZ'),
          feedback: note.trim(),
          close_task: true,
          create_retraining_reminder: retrain,
        }),
      })
      close()
      onSuccess()
      message.success('任务已处理并关闭')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={`处理任务 · ${task?.patientName ?? ''}`}
      open={open}
      onCancel={close}
      footer={[
        <Button key="cancel" onClick={close}>取消</Button>,
        <Button key="ok" type="primary" loading={submitting} onClick={submit}>确认处理</Button>,
      ]}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          该患者的待核查任务已到期。关闭前请记录本次处理内容，便于追溯。
        </p>
        <div>
          <label className="field-label" style={{ display: 'block', marginBottom: 8 }}>处理说明（必填）</label>
          <Input.TextArea
            rows={3}
            value={note}
            maxLength={200}
            showCount
            onChange={(e) => {
              setNote(e.target.value)
              setError(null)
            }}
            placeholder="如：已电话联系，患者说明本周外出忘记携带装置，已提醒规律用药"
          />
        </div>
        <Checkbox checked={retrain} onChange={(e) => setRetrain(e.target.checked)}>
          同时安排一次操作复训提醒
        </Checkbox>
        {error && <Alert type="error" showIcon message="处理失败" description={error} />}
      </div>
    </Modal>
  )
}
