import { useEffect, useState } from 'react'
import { Button, Checkbox, DatePicker, Form, Input, message, Select, Space, Tag, Typography } from 'antd'
import { apiFetch } from '../../api/client'
import PageHeader from '../../components/PageHeader'
import TaskCloseModal from '../../components/TaskCloseModal'

const { Text } = Typography

interface Patient { id: string; patient_code: string; display_name: string }
interface Task { id: string; patient_id: string; status: string; created_at: string }
interface Followup { id: string; patient_id: string; followed_at: string; feedback: string | null; action_taken: string | null; next_plan: string | null }

// M05 随访中心（J038）
export default function FollowupPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [closing, setClosing] = useState<{ id: string; patientId: string; patientName: string } | null>(null)

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

  const loadFollowups = async (pid: string) => {
    try {
      const r = await apiFetch<{ items: Followup[] }>(`/api/patients/${pid}/followups?page_size=50`)
      setFollowups(r.items)
    } catch (e) { message.error((e as Error).message) }
  }

  useEffect(() => { loadPatients(); loadTasks() }, [])

  const onSelectPatient = (pid: string) => {
    setSelectedPatient(pid)
    if (pid) loadFollowups(pid)
  }

  const onSubmit = async (v: {
    task_id?: string; followed_at: { format: (f: string) => string }; feedback?: string;
    action_taken?: string; next_plan?: string; close_task?: boolean; create_retraining_reminder?: boolean
  }) => {
    if (!selectedPatient) { message.error('请先选择患者'); return }
    setSubmitting(true)
    try {
      await apiFetch('/api/followups', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: selectedPatient,
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
      loadTasks()
      loadFollowups(selectedPatient)
    } catch (e) { message.error((e as Error).message) } finally { setSubmitting(false) }
  }

  return (
    <div>
      <PageHeader title="随访中心" subtitle="记录随访结果，跟踪患者反馈与后续计划" />

      <div className="followup-layout">
        <div>
          <section className="page-section">
            <div className="section-head">
              <h2 className="section-title">待处理任务（{tasks.length}）</h2>
            </div>
            {tasks.length === 0 ? <Text type="secondary">暂无待处理任务</Text> : (
              <ul className="record-list">
                {tasks.map((t) => {
                  const p = patients.find(x => x.id === t.patient_id)
                  return (
                    <li key={t.id} className="record-row">
                      <span className="record-main">
                        <span className="strong">{p?.display_name || t.patient_id} · {p?.patient_code || ''}</span>
                        <span className="record-meta">连续多次未登记 · {new Date(t.created_at).toLocaleString('zh-CN')}</span>
                      </span>
                      <Space size={12}>
                        <Tag className="tag-brand">待核查</Tag>
                        <Button size="small" onClick={() => {
                          setClosing({ id: t.id, patientId: t.patient_id, patientName: p?.display_name || t.patient_id })
                        }}>快速处理</Button>
                        <Button type="link" size="small" onClick={() => {
                          if (p) { setSelectedPatient(p.id); loadFollowups(p.id); form.setFieldValue('task_id', t.id) }
                        }}>填写完整随访</Button>
                      </Space>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="page-section" style={{ borderBottom: 'none' }}>
            <div className="section-head">
              <h2 className="section-title">随访历史</h2>
            </div>
            {followups.length === 0 ? <Text type="secondary">暂无随访记录</Text> : (
              <ul className="record-list">
                {followups.map((f) => (
                  <li key={f.id}>
                    <div className="record-row">
                      <span className="strong tabular">{new Date(f.followed_at).toLocaleString('zh-CN')}</span>
                    </div>
                    <div className="record-body">
                      {f.feedback && <span>反馈：{f.feedback}</span>}
                      {f.action_taken && <span>措施：{f.action_taken}</span>}
                      {f.next_plan && <span>后续：{f.next_plan}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="followup-form-card">
          <div className="section-head">
            <h2 className="section-title">记录随访</h2>
          </div>
          <Form form={form} layout="vertical" onFinish={onSubmit}>
            {/* 患者不进表单字段（由页面状态控制），这里用原生 label 关联，保证读屏可读出名称 */}
            <div className="form-field">
              <label htmlFor="followup-patient">患者</label>
              <Select
                id="followup-patient"
                placeholder="选择患者"
                style={{ width: '100%' }}
                value={selectedPatient}
                options={patients.map(p => ({ value: p.id, label: `${p.display_name} (${p.patient_code})` }))}
                onChange={onSelectPatient} showSearch optionFilterProp="label"
              />
            </div>
            <Form.Item name="task_id" label="关联任务（可选）">
              <Select allowClear placeholder="选择要关闭的任务"
                options={tasks.map(t => ({ value: t.id, label: `${patients.find(p => p.id === t.patient_id)?.display_name || ''} - ${new Date(t.created_at).toLocaleDateString('zh-CN')}` }))} />
            </Form.Item>
            <Form.Item name="followed_at" label="随访日期" rules={[{ required: true, message: '请选择随访日期' }]}>
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="feedback" label="反馈 / 疑问"><Input.TextArea rows={2} /></Form.Item>
            <Form.Item name="action_taken" label="宣教措施 / 发现问题"><Input.TextArea rows={2} /></Form.Item>
            <Form.Item name="next_plan" label="后续计划"><Input.TextArea rows={2} /></Form.Item>
            <Space size={16} wrap style={{ marginBottom: 20 }}>
              <Form.Item name="close_task" valuePropName="checked" noStyle>
                <Checkbox>关闭关联任务</Checkbox>
              </Form.Item>
              <Form.Item name="create_retraining_reminder" valuePropName="checked" noStyle>
                <Checkbox>安排复训提醒</Checkbox>
              </Form.Item>
            </Space>
            <Button type="primary" htmlType="submit" block loading={submitting}>保存随访</Button>
          </Form>
        </div>
      </div>

      <TaskCloseModal
        open={!!closing}
        task={closing}
        onClose={() => setClosing(null)}
        onSuccess={() => {
          void loadTasks()
          if (selectedPatient) void loadFollowups(selectedPatient)
        }}
      />
    </div>
  )
}
