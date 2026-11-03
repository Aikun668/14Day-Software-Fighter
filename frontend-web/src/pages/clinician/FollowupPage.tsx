import { useEffect, useState } from 'react'
import { Button, Checkbox, DatePicker, Form, Input, message, Select } from 'antd'
import dayjs from 'dayjs'
import { apiFetch } from '../../api/client'
import TaskCloseModal from '../../components/TaskCloseModal'
import { Card, CollapsibleList, FilterBar, HeroBar, QueueRow } from '../../components/clinic'

interface Patient { id: string; patient_code: string; display_name: string }
interface Task { id: string; patient_id: string; status: string; created_at: string }
interface Followup {
  id: string
  patient_id: string
  followed_at: string
  feedback: string | null
  action_taken: string | null
  next_plan: string | null
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

// M05 随访中心（J038）
// 干活页：跟进待核查队列，并翻随访记录。不是四张摘要卡。
export default function FollowupPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [teamFollowups, setTeamFollowups] = useState<Followup[]>([])
  const [patientFollowups, setPatientFollowups] = useState<Followup[]>([])
  const [historyPatient, setHistoryPatient] = useState<string | null>(null)
  const [formPatient, setFormPatient] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [closing, setClosing] = useState<{ id: string; patientId: string; patientName: string } | null>(null)

  const patientById = (id: string) => patients.find((p) => p.id === id)

  const loadPatients = async () => {
    try {
      const r = await apiFetch<{ items: Patient[] }>('/api/patients?page_size=100')
      setPatients(r.items)
    } catch (e) { message.error((e as Error).message) }
  }

  const loadTasks = async () => {
    try {
      const r = await apiFetch<{ items: Task[] }>('/api/tasks?status=OPEN&page_size=50')
      setTasks(r.items)
    } catch (e) { message.error((e as Error).message) }
  }

  const loadTeamFollowups = async () => {
    try {
      const r = await apiFetch<{ items: Followup[] }>('/api/followups?page_size=50')
      setTeamFollowups(r.items)
    } catch (e) { message.error((e as Error).message) }
  }

  const loadPatientFollowups = async (pid: string) => {
    try {
      const r = await apiFetch<{ items: Followup[] }>(`/api/patients/${pid}/followups?page_size=50`)
      setPatientFollowups(r.items)
    } catch (e) { message.error((e as Error).message) }
  }

  useEffect(() => { loadPatients(); loadTasks(); loadTeamFollowups() }, [])

  useEffect(() => {
    if (!historyPatient) return
    setPatientFollowups([])
    void loadPatientFollowups(historyPatient)
  }, [historyPatient])

  const openComposer = (patientId?: string, taskId?: string) => {
    setComposing(true)
    if (patientId) {
      setFormPatient(patientId)
      setHistoryPatient(patientId)
    }
    form.setFieldsValue({
      task_id: taskId,
      followed_at: dayjs(),
    })
    requestAnimationFrame(() => {
      document.getElementById('cc-follow-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  const onSubmit = async (v: {
    task_id?: string
    followed_at: { format: (f: string) => string }
    feedback?: string
    action_taken?: string
    next_plan?: string
    close_task?: boolean
    create_retraining_reminder?: boolean
  }) => {
    if (!formPatient) { message.error('请先选择患者'); return }
    setSubmitting(true)
    try {
      await apiFetch('/api/followups', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: formPatient,
          task_id: v.task_id || null,
          followed_at: v.followed_at ? v.followed_at.format('YYYY-MM-DDTHH:mm:ssZ') : new Date().toISOString(),
          feedback: v.feedback,
          action_taken: v.action_taken,
          next_plan: v.next_plan,
          close_task: !!v.close_task,
          create_retraining_reminder: !!v.create_retraining_reminder,
        }),
      })
      message.success('随访已保存' + (v.close_task ? '，任务已关闭' : ''))
      form.resetFields()
      setComposing(false)
      setFormPatient(null)
      void loadTasks()
      void loadTeamFollowups()
      if (historyPatient) void loadPatientFollowups(historyPatient)
    } catch (e) { message.error((e as Error).message) } finally { setSubmitting(false) }
  }

  const shown = historyPatient ? patientFollowups : teamFollowups
  const historyName = historyPatient ? patientById(historyPatient) : null

  return (
    <div className="cc-page cc-follow-page">
      <HeroBar
        eyebrow={<>随访 · {tasks.length > 0 ? `${tasks.length} 条待核查` : <span className="ok">已清空</span>}</>}
        title="随访中心"
        sub={composing
          ? '写完这一次，保存后回到队列。'
          : tasks.length > 0
            ? '先处理下面的待核查。要记完整一次，用右上角的新建随访。'
            : '待核查已经清空。需要留下记录时，再新建一条随访。'}
        actions={composing ? null : (
          <Button type="primary" onClick={() => openComposer()}>新建随访</Button>
        )}
      />

      <div className="cc-stack">
        {composing && (
          <Card title="记录随访" hint="保存后出现在下面的记录里" id="cc-follow-form">
            <Form className="cc-follow-form" form={form} layout="vertical" onFinish={onSubmit}>
              <div className="cc-follow-field">
                <label htmlFor="followup-patient">患者</label>
                <Select
                  id="followup-patient"
                  placeholder="选择患者"
                  aria-label="选择患者"
                  style={{ width: '100%' }}
                  value={formPatient ?? undefined}
                  options={patients.map(p => ({ value: p.id, label: `${p.display_name} (${p.patient_code})` }))}
                  onChange={(id) => {
                    setFormPatient(id)
                    setHistoryPatient(id)
                  }}
                  showSearch
                  optionFilterProp="label"
                />
              </div>
              <Form.Item name="task_id" label="关联任务（可选）">
                <Select
                  allowClear
                  placeholder="选择要关闭的任务"
                  options={tasks.map(t => ({
                    value: t.id,
                    label: `${patientById(t.patient_id)?.display_name || '患者'} · ${fmt(t.created_at)}`,
                  }))}
                />
              </Form.Item>
              <Form.Item name="followed_at" label="随访时间" rules={[{ required: true, message: '请选择随访时间' }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="feedback" label="反馈 / 疑问"><Input.TextArea rows={2} /></Form.Item>
              <Form.Item name="action_taken" label="宣教措施 / 发现问题"><Input.TextArea rows={2} /></Form.Item>
              <Form.Item name="next_plan" label="后续计划"><Input.TextArea rows={2} /></Form.Item>
              <div className="cc-follow-checks">
                <Form.Item name="close_task" valuePropName="checked" noStyle>
                  <Checkbox>关闭关联任务</Checkbox>
                </Form.Item>
                <Form.Item name="create_retraining_reminder" valuePropName="checked" noStyle>
                  <Checkbox>安排复训提醒</Checkbox>
                </Form.Item>
              </div>
              <div className="cc-follow-submit">
                <Button type="primary" htmlType="submit" loading={submitting}>保存随访</Button>
                <Button onClick={() => { setComposing(false); form.resetFields() }}>取消</Button>
              </div>
            </Form>
          </Card>
        )}

        <Card title="待核查" hint={tasks.length > 0 ? `${tasks.length} 条` : '已清空'}>
          {tasks.length === 0 ? (
            <p className="cc-empty-line">暂无待核查任务。</p>
          ) : (
            <ul className="cc-task-list">
              {tasks.map((t) => {
                const p = patientById(t.patient_id)
                const name = p?.display_name || '患者'
                return (
                  <li key={t.id}>
                    <QueueRow
                      name={name}
                      meta={p?.patient_code}
                      extra={`连续多次未登记 · ${fmt(t.created_at)}`}
                      onClick={() => openComposer(t.patient_id, t.id)}
                      actions={[
                        {
                          key: 'quick',
                          label: '快速处理',
                          onClick: () => setClosing({ id: t.id, patientId: t.patient_id, patientName: name }),
                        },
                        {
                          key: 'full',
                          label: '填写随访',
                          onClick: () => openComposer(t.patient_id, t.id),
                        },
                      ]}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card
          title="随访记录"
          hint={historyName ? historyName.display_name : `最近 ${shown.length} 条`}
        >
          <FilterBar
            filters={
              <>
                <Select
                  allowClear
                  placeholder="按患者筛选"
                  aria-label="按患者筛选随访记录"
                  style={{ minWidth: 220 }}
                  value={historyPatient ?? undefined}
                  options={patients.map(p => ({ value: p.id, label: `${p.display_name} (${p.patient_code})` }))}
                  onChange={(id) => {
                    setHistoryPatient(id ?? null)
                    if (!id) setPatientFollowups([])
                  }}
                  showSearch
                  optionFilterProp="label"
                />
              </>
            }
          />
          {shown.length === 0 ? (
            <p className="cc-empty-line">
              {historyPatient ? '这位患者还没有随访记录。' : '还没有随访记录。'}
            </p>
          ) : (
            <ul className="cc-follow-timeline">
              <CollapsibleList
                collapseAt={4}
                items={shown.map((f) => {
                  const p = patientById(f.patient_id)
                  return (
                    <li key={f.id} className="cc-follow-item">
                      <div className="cc-follow-when">
                        <strong>{new Date(f.followed_at).toLocaleString('zh-CN')}</strong>
                        <span>{p?.display_name || '患者'}{p ? ` · ${p.patient_code}` : ''}</span>
                      </div>
                      {f.feedback ? <p>反馈：{f.feedback}</p> : null}
                      {f.action_taken ? <p>措施：{f.action_taken}</p> : null}
                      {f.next_plan ? <p>后续：{f.next_plan}</p> : null}
                    </li>
                  )
                })}
              />
            </ul>
          )}
        </Card>
      </div>

      <TaskCloseModal
        open={!!closing}
        task={closing}
        onClose={() => setClosing(null)}
        onSuccess={() => {
          void loadTasks()
          void loadTeamFollowups()
          if (historyPatient) void loadPatientFollowups(historyPatient)
        }}
      />
    </div>
  )
}
