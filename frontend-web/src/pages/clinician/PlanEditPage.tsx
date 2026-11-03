import { useEffect, useMemo, useState } from 'react'
import { Button, DatePicker, Form, Input, message, Radio, Select } from 'antd'
import { apiFetch } from '../../api/client'
import {
  Card,
  HeroBar,
  TwoColumn,
} from '../../components/clinic'

interface Patient { id: string; patient_code: string; display_name: string }
interface DailyTime { id: string; local_time: string; label: string | null; is_enabled: boolean }
interface Plan {
  id: string; plan_group_id: string; version: number; drug_label: string;
  plan_type: string; timezone: string; starts_at: string; ends_at: string | null;
  daily_times: DailyTime[]
}

const cleanDemo = (value: string) => value.replace(/\s*[(（]DEMO[)）]/gi, '').trim()
const day = (iso: string) => new Date(iso).toLocaleDateString('zh-CN')

type PlanPhase = 'active' | 'pending' | 'closed'

function planPhase(plan: Plan, now: number): PlanPhase {
  const started = new Date(plan.starts_at).getTime() <= now
  if (!started) return 'pending'
  if (plan.ends_at === null) return 'active'
  return 'closed'
}

const PHASE_LABEL: Record<PlanPhase, string> = {
  active: '生效中',
  pending: '待生效',
  closed: '已关闭',
}

// M03 用药计划编辑（J028）
// 干活页：选中患者后填写新计划，并对照历史版本。不是摘要仪表盘。
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
    setPlans([])
    if (pid) fetchPlans(pid)
  }

  const onCreate = async (v: { device_model_id: string; drug_label: string; plan_type: string; starts_at: { format: (f: string) => string }; ends_at?: { format: (f: string) => string }; daily_times_text?: string }) => {
    if (!selectedPatient) return
    setLoading(true)
    try {
      const daily_times = v.plan_type === 'REGULAR'
        ? (v.daily_times_text || '').split('\n').filter(s => s.trim()).map((t, i) => ({ local_time: t.trim(), label: `时点${i + 1}` }))
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

  // now 用 state 初始化器取一次即可，避免渲染期调用不纯函数
  const [now] = useState(() => Date.now())
  // 「当前生效」= 已开始且未结束。未来才开始的不算。
  const currentPlan = useMemo(
    () => plans
      .filter((p) => p.ends_at === null && new Date(p.starts_at).getTime() <= now)
      .sort((a, b) => b.version - a.version)[0] ?? null,
    [plans, now],
  )
  const pendingPlan = useMemo(
    () => plans
      .filter((p) => planPhase(p, now) === 'pending')
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] ?? null,
    [plans, now],
  )
  const headline = currentPlan ?? pendingPlan

  const planType = Form.useWatch('plan_type', form)
  const patientName = selectedPatient?.display_name ?? ''

  return (
    <div className="cc-page cc-plan-page">
      <HeroBar
        eyebrow={<>用药计划 · <span className={selectedPatient ? 'ok' : undefined}>{selectedPatient ? '已选患者' : '未选患者'}</span></>}
        title={selectedPatient ? `为${patientName}编辑方案` : '用药计划'}
        sub={selectedPatient
          ? '在这里写一版新计划，并对照历史版本。'
          : '先选定一位患者，再新建计划或查看历史版本。'}
        actions={
          <Select
            style={{ minWidth: 240 }}
            placeholder="选择患者"
            aria-label="选择患者"
            options={patients.map(p => ({ value: p.id, label: `${p.display_name} (${p.patient_code})` }))}
            onChange={onSelectPatient}
            showSearch
            optionFilterProp="label"
          />
        }
      />

      {selectedPatient && headline ? (
        <div className="cc-plan-now" aria-label={currentPlan ? '当前生效方案' : '待生效方案'}>
          <span className="cc-plan-now-label">{currentPlan ? '当前生效' : '待生效'}</span>
          <span className="cc-plan-now-drug">{cleanDemo(headline.drug_label)}</span>
          <span className={`cc-chip ${headline.plan_type === 'REGULAR' ? 'blue' : ''}`}>
            {headline.plan_type === 'REGULAR' ? '固定' : '按需'}
          </span>
          {headline.plan_type === 'REGULAR' && headline.daily_times?.map((t) => (
            <span key={t.id} className="cc-chip">{t.local_time.slice(0, 5)}</span>
          ))}
          <span className="cc-plan-now-ver">v{headline.version}</span>
        </div>
      ) : null}

      {!selectedPatient ? (
        <Card title="先选择患者">
          <p className="cc-plan-empty">
            在右上角选定一位患者，即可填写新计划，并对照历史版本。
          </p>
        </Card>
      ) : (
        <TwoColumn
          natural
          aside={
            <Card title="历史版本" hint={plans.length > 0 ? `${plans.length} 个` : '对照'}>
              {plans.length === 0 ? (
                <p className="cc-empty-line">该患者还没有用药计划。</p>
              ) : (
                <ul className="cc-record-list">
                  {plans.map((p) => {
                    const phase = planPhase(p, now)
                    return (
                    <li key={p.id}>
                      <div className="cc-record-main">
                        <div className="cc-plan-version">
                          <span className="cc-plan-drug">v{p.version} · {cleanDemo(p.drug_label)}</span>
                          <span className={`cc-chip ${phase === 'active' ? 'blue' : ''}`}>{PHASE_LABEL[phase]}</span>
                          <span className={`cc-chip ${p.plan_type === 'REGULAR' ? 'blue' : ''}`}>{p.plan_type === 'REGULAR' ? '固定' : '按需'}</span>
                        </div>
                        <span className="cc-plan-range">{day(p.starts_at)} ~ {p.ends_at ? day(p.ends_at) : '至今'}</span>
                        {p.plan_type === 'REGULAR' && p.daily_times?.length > 0 && (
                          <div className="cc-plan-times">
                            {p.daily_times.map((t) => (
                              <span key={t.id} className="cc-chip">{t.local_time.slice(0, 5)}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          }
        >
          <Card title="新建计划">
            <Form className="cc-plan-form" form={form} layout="vertical" onFinish={onCreate} initialValues={{ plan_type: 'REGULAR' }}>
              <Form.Item name="device_model_id" label="型号" rules={[{ required: true, message: '请选择型号' }]}>
                <Select options={models.map(m => ({ value: m.id, label: m.model_name }))} placeholder="选择装置型号" />
              </Form.Item>
              <Form.Item name="drug_label" label="药物名称" rules={[{ required: true, message: '请输入药物名称' }]}>
                <Input placeholder="如 布地奈德福莫特罗粉吸入剂" />
              </Form.Item>
              <Form.Item name="plan_type" label="计划类型" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio value="REGULAR">固定计划（每日固定时点）</Radio>
                  <Radio value="PRN">按需计划（不固定时点）</Radio>
                </Radio.Group>
              </Form.Item>
              <div className="cc-form-grid">
                <Form.Item name="starts_at" label="生效开始日期" rules={[{ required: true, message: '请选择开始日期' }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="ends_at" label="生效结束日期（可空）">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </div>
              {planType === 'REGULAR' && (
                <Form.Item
                  name="daily_times_text"
                  label="每日时点（每行一个，HH:MM）"
                  rules={[{ required: true, whitespace: true, message: '请填写至少一个时点' }]}
                >
                  <Input.TextArea rows={3} />
                </Form.Item>
              )}
              <Button type="primary" htmlType="submit" loading={loading}>创建计划</Button>
            </Form>
          </Card>
        </TwoColumn>
      )}
    </div>
  )
}
