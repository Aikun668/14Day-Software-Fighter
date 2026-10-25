import { useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, message, Radio, Select, Table } from 'antd'
import { apiFetch } from '../../api/client'
import PageHeader from '../../components/PageHeader'

interface Patient { id: string; patient_code: string; display_name: string }
interface DailyTime { id: string; local_time: string; label: string | null; is_enabled: boolean }
interface Plan {
  id: string; plan_group_id: string; version: number; drug_label: string;
  plan_type: string; timezone: string; starts_at: string; ends_at: string | null;
  daily_times: DailyTime[]
}

// M03 用药计划编辑（J028）
export default function PlanEditPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [form] = Form.useForm()
  const [models, setModels] = useState<{ id: string; model_name: string }[]>([])
  const [loading, setLoading] = useState(false)

  const fetchPatients = async () => {
    try {
      const r = await apiFetch<{ items: Patient[] }>('/api/patients?page_size=100')
      setPatients(r.items)
    } catch (e) { message.error((e as Error).message) }
  }

  const fetchModels = async () => {
    try {
      const r = await apiFetch<{ items: { id: string; model_name: string }[] }>('/api/device-models?page_size=100')
      setModels(r.items)
    } catch (e) { message.error((e as Error).message) }
  }

  const fetchPlans = async (pid: string) => {
    try {
      const r = await apiFetch<{ items: Plan[] }>(`/api/patients/${pid}/medication-plans?include_history=true&page_size=100`)
      setPlans(r.items)
    } catch (e) { message.error((e as Error).message) }
  }

  useEffect(() => { fetchPatients(); fetchModels() }, [])

  const onSelectPatient = (pid: string) => {
    const p = patients.find((x) => x.id === pid) || null
    setSelectedPatient(p)
    if (pid) fetchPlans(pid)
  }

  const onCreate = async (v: { device_model_id: string; drug_label: string; plan_type: string; starts_at: { format: (f: string) => string }; ends_at?: { format: (f: string) => string }; daily_times_text?: string }) => {
    if (!selectedPatient) return
    setLoading(true)
    try {
      const daily_times = v.plan_type === 'REGULAR'
        ? (v.daily_times_text || '08:00\n20:00').split('\n').filter(s => s.trim()).map((t, i) => ({ local_time: t.trim(), label: `时点${i + 1}` }))
        : []
      await apiFetch(`/api/patients/${selectedPatient.id}/medication-plans`, {
        method: 'POST',
        body: JSON.stringify({
          device_model_id: v.device_model_id,
          drug_label: v.drug_label,
          plan_type: v.plan_type,
          timezone: 'Asia/Shanghai',
          starts_at: v.starts_at.format('YYYY-MM-DDTHH:mm:ssZ'),
          ends_at: v.ends_at ? v.ends_at.format('YYYY-MM-DDTHH:mm:ssZ') : null,
          daily_times,
        }),
      })
      message.success('计划已创建')
      form.resetFields()
      fetchPlans(selectedPatient.id)
    } catch (e) { message.error((e as Error).message) } finally { setLoading(false) }
  }

  return (
    <div>
      <PageHeader title="用药计划编辑" subtitle="调整固定时点与计划周期" />
      <div className="page-toolbar">
        <div className="page-toolbar-left">
          <label htmlFor="plan-patient" className="field-label">选择患者</label>
          <Select
            id="plan-patient"
            style={{ width: 240 }}
            placeholder="选择患者"
            options={patients.map(p => ({ value: p.id, label: `${p.display_name} (${p.patient_code})` }))}
            onChange={onSelectPatient}
            showSearch
            optionFilterProp="label"
          />
        </div>
      </div>

      {selectedPatient && (
        <>
          <section className="page-section">
            <div className="section-head">
              <h2 className="section-title">新建计划 · {selectedPatient.display_name}</h2>
            </div>
            <Form form={form} layout="vertical" onFinish={onCreate}>
              <Form.Item name="device_model_id" label="型号" rules={[{ required: true }]}>
                <Select options={models.map(m => ({ value: m.id, label: m.model_name }))} />
              </Form.Item>
              <Form.Item name="drug_label" label="药物名称" rules={[{ required: true }]}>
                <Input placeholder="如 布地奈德福莫特罗粉吸入剂" />
              </Form.Item>
              <Form.Item name="plan_type" label="计划类型" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio value="REGULAR">固定计划（每日固定时点）</Radio>
                  <Radio value="PRN">按需计划（不固定时点）</Radio>
                </Radio.Group>
              </Form.Item>
              <div className="form-row">
                <Form.Item name="starts_at" label="生效开始日期" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="ends_at" label="生效结束日期（可空）">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </div>
              <Form.Item name="daily_times_text" label="每日时点（每行一个，HH:MM，仅固定计划）">
                <Input.TextArea rows={3} placeholder={'08:00\n20:00'} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>创建计划</Button>
            </Form>
          </section>

          <section className="page-section" style={{ borderBottom: 'none' }}>
            <div className="section-head">
              <h2 className="section-title">历史版本</h2>
            </div>
            <Table rowKey="id" dataSource={plans} pagination={false}
              columns={[
                { title: '版本', dataIndex: 'version' },
                { title: '药物', dataIndex: 'drug_label' },
                { title: '类型', dataIndex: 'plan_type', render: (v: string) => v === 'REGULAR' ? '固定' : '按需' },
                { title: '开始', dataIndex: 'starts_at', render: (v: string) => new Date(v).toLocaleDateString('zh-CN') },
                { title: '结束', dataIndex: 'ends_at', render: (v: string | null) => v ? new Date(v).toLocaleDateString('zh-CN') : '—' },
              ]} />
          </section>
        </>
      )}
    </div>
  )
}
