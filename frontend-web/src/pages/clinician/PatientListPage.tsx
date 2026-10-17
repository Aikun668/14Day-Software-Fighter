import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Form, Input, message, Modal, Select, Space, Table, Tag } from 'antd'
import { apiFetch } from '../../api/client'
import PageHeader from '../../components/PageHeader'

interface Patient {
  id: string
  patient_code: string
  display_name: string
  diagnosis_label: string | null
  assigned_clinician_id: string | null
  account_user_id: string | null
}

interface PageResp {
  items: Patient[]
  total: number
}

interface DeviceModel { id: string; model_name: string }
interface Guide { id: string; title: string; steps: { id: string; step_no: number; text: string }[] }

// M02 患者列表/详情（J016）+ 现场评估（J024）
export default function PatientListPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<Patient[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [evalPatient, setEvalPatient] = useState<Patient | null>(null)
  const [evalOpen, setEvalOpen] = useState(false)
  const [evalForm] = Form.useForm()
  const [evalModels, setEvalModels] = useState<DeviceModel[]>([])
  const [evalGuides, setEvalGuides] = useState<Guide[]>([])

  const fetchList = async (p = page, s = search) => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ page: String(p), page_size: '20' })
      if (s) q.set('search', s)
      const resp = await apiFetch<PageResp>(`/api/patients?${q}`)
      setData(resp.items)
      setTotal(resp.total)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList(page, search) }, [page])

  const onCreate = async (values: { patient_code: string; display_name: string; diagnosis_label?: string; note?: string }) => {
    setSubmitting(true)
    try {
      await apiFetch('/api/patients', { method: 'POST', body: JSON.stringify(values) })
      message.success('建档成功')
      setModalOpen(false)
      form.resetFields()
      fetchList(1, search)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const openEval = async (p: Patient) => {
    setEvalPatient(p)
    setEvalOpen(true)
    try {
      const ms = await apiFetch<{ items: DeviceModel[] }>('/api/device-models?page_size=100')
      setEvalModels(ms.items)
    } catch (e) { message.error((e as Error).message) }
  }

  const onModelChange = async (modelId: string) => {
    try {
      const g = await apiFetch<Guide>(`/api/device-models/${modelId}/guide`)
      setEvalGuides([g])
    } catch {
      setEvalGuides([])
    }
  }

  const submitEval = async (v: { guide_id: string; result?: string }) => {
    if (!evalPatient) return
    const guide = evalGuides.find((g) => g.id === v.guide_id)
    if (!guide) { message.error('请先选择指导'); return }
    try {
      const stepResults = guide.steps.map((s) => ({ step_id: s.id, check_state: 'DONE' }))
      await apiFetch('/api/training-sessions', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: evalPatient.id,
          device_model_id: guide.id,
          guide_id: guide.id,
          result: v.result || '现场观察',
          step_results: stepResults,
        }),
      })
      message.success('现场评估已记录')
      setEvalOpen(false)
      evalForm.resetFields()
    } catch (e) { message.error((e as Error).message) }
  }

  // 诊断标签筛选项（去重）
  const diagnosisFilters = useMemo(() => {
    const set = new Set<string>()
    data.forEach((p) => { if (p.diagnosis_label) set.add(p.diagnosis_label) })
    return [...set].map((v) => ({ text: v, value: v }))
  }, [data])

  const columns = [
    { title: '患者编号', dataIndex: 'patient_code', width: 120, render: (v: string) => <span className="tabular">{v}</span> },
    { title: '姓名/别名', dataIndex: 'display_name', render: (v: string) => <span className="strong">{v}</span> },
    {
      title: '诊断标签', dataIndex: 'diagnosis_label',
      filters: diagnosisFilters,
      onFilter: (value: unknown, r: Patient) => r.diagnosis_label === value,
      render: (v: string | null) => v || '—',
    },
    {
      title: '账号', dataIndex: 'account_user_id', width: 120,
      filters: [
        { text: '已绑定', value: 'bound' },
        { text: '未绑定', value: 'unbound' },
      ],
      onFilter: (value: unknown, r: Patient) => (value === 'bound' ? !!r.account_user_id : !r.account_user_id),
      render: (v: string | null) => v ? <Tag className="tag-brand">已绑定</Tag> : <Tag>未绑定</Tag>,
    },
    { title: '操作', key: 'action', width: 180, render: (_: unknown, r: Patient) => (
      <Space size={16}>
        <Button type="link" size="small" onClick={() => navigate(`/patients/${r.id}`)}>查看详情</Button>
        <Button type="text" size="small" style={{ color: 'var(--ink-2)' }} onClick={() => openEval(r)}>现场评估</Button>
      </Space>
    ) },
  ]

  return (
    <div>
      <PageHeader title="患者管理" />
      <Card>
        <div className="toolbar">
          <Input.Search
            placeholder="搜索编号或姓名"
            aria-label="搜索编号或姓名"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => { setPage(1); fetchList(1, v) }}
            style={{ width: 280 }}
          />
          <Button type="primary" onClick={() => setModalOpen(true)}>新建患者</Button>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: (p) => setPage(p),
          }}
        />
      </Card>

      <Modal title="新建患者" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={submitting} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onCreate}>
          <Form.Item name="patient_code" label="患者编号" rules={[{ required: true, message: '请输入患者编号' }]}>
            <Input placeholder="如 P-013" />
          </Form.Item>
          <Form.Item name="display_name" label="姓名/别名" rules={[{ required: true, message: '请输入姓名或别名' }]}>
            <Input placeholder="如 林女士" />
          </Form.Item>
          <Form.Item name="diagnosis_label" label="诊断标签">
            <Input placeholder="如 哮喘（已知档案，非系统诊断）" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} placeholder="备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`现场评估 - ${evalPatient?.display_name || ''}`} open={evalOpen} onCancel={() => setEvalOpen(false)} onOk={() => evalForm.submit()} destroyOnHidden>
        <Form form={evalForm} layout="vertical" onFinish={submitEval}>
          <Form.Item name="device_model_id" label="型号" rules={[{ required: true }]}>
            <Select placeholder="选择型号" options={evalModels.map(m => ({ value: m.id, label: m.model_name }))} onChange={onModelChange} />
          </Form.Item>
          <Form.Item name="guide_id" label="指导版本" rules={[{ required: true }]}>
            <Select placeholder="选择指导" options={evalGuides.map(g => ({ value: g.id, label: `${g.title}` }))} />
          </Form.Item>
          <Form.Item name="result" label="评估结论">
            <Input placeholder="如：操作熟练 / 需重新训练" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
