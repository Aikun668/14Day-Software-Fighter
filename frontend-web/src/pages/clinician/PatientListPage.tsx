import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, message, Modal, Select } from 'antd'
import { apiFetch } from '../../api/client'
import {
  Card,
  FilterBar,
  HeroBar,
  PatientRow,
  StatBand,
  type PatientRowItem,
} from '../../components/clinic'

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

const PAGE_SIZE = 20

// 去掉演示数据标记：档案标签里的 (DEMO) 是给种子脚本用的，不该出现在业务文案里
const cleanDemo = (value: string | null) =>
  value ? value.replace(/\s*[(（]DEMO[)）]/gi, '').trim() : null

// M02 患者列表/详情（J016）+ 现场评估（J024）
export default function PatientListPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<Patient[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  // 筛选：诊断标签 / 账号绑定状态（均在服务端过滤，不是只筛当前页）
  const [diagnosisFilter, setDiagnosisFilter] = useState<string[]>([])
  const [accountFilter, setAccountFilter] = useState<string[]>([])
  const [diagnosisOptions, setDiagnosisOptions] = useState<{ label: string; value: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [evalPatient, setEvalPatient] = useState<Patient | null>(null)
  const [evalOpen, setEvalOpen] = useState(false)
  const [evalForm] = Form.useForm()
  const [evalModels, setEvalModels] = useState<DeviceModel[]>([])
  const [evalGuides, setEvalGuides] = useState<Guide[]>([])

  const fetchList = async (
    p = page,
    s = search,
    diag = diagnosisFilter,
    acct = accountFilter,
  ) => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) })
      if (s) q.set('search', s)
      // 筛选全部在服务端：多选诊断标签重复传参，按「任一」匹配
      diag.forEach((label) => q.append('diagnosis_label', label))
      if (acct.length === 1) q.set('account_status', acct[0])
      // 两个都选 = 不筛选（省略参数，避免空值触发 422）
      const resp = await apiFetch<PageResp>(`/api/patients?${q}`)
      setData(resp.items)
      setTotal(resp.total)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList(page, search) }, [page])  // eslint-disable-line react-hooks/exhaustive-deps

  // 筛选项：全量诊断标签（服务端去重，不受当前页影响）
  useEffect(() => {
    apiFetch<{ diagnosis_labels: string[] }>('/api/patients/filter-options')
      .then((r) => setDiagnosisOptions(r.diagnosis_labels.map((v) => ({ label: v, value: v }))))
      .catch(() => setDiagnosisOptions([]))
  }, [])

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

  // 摘要卡：当前页与筛选后的一致口径（服务端 total 才是权威，这里用当前列表算绑定数）
  const summary = useMemo(() => {
    const bound = data.filter((p) => p.account_user_id).length
    const unbound = data.length - bound
    const labels = new Set(data.map((p) => cleanDemo(p.diagnosis_label)).filter(Boolean))
    return { bound, unbound, labels: labels.size }
  }, [data])

  const rows: PatientRowItem[] = data.map((p) => ({
    key: p.id,
    name: p.display_name,
    code: p.patient_code,
    diagnosis: cleanDemo(p.diagnosis_label),
    account: {
      bound: Boolean(p.account_user_id),
      label: p.account_user_id ? '已绑定' : '未绑定',
    },
    onClick: () => navigate(`/patients/${p.id}`),
    actions: [
      {
        key: 'detail',
        label: '查看详情',
        onClick: () => navigate(`/patients/${p.id}`),
      },
      {
        key: 'eval',
        label: '现场评估',
        onClick: () => { void openEval(p) },
      },
    ],
  }))

  const hasFilter = diagnosisFilter.length > 0 || accountFilter.length > 0 || search.length > 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="cc-page">
      <HeroBar
        eyebrow={<>患者管理 · <span className={total > 0 ? 'ok' : undefined}>{total > 0 ? '系统正常' : '暂无患者'}</span></>}
        title="患者管理"
        sub="下面是负责患者的档案、账号与诊断标签。"
        actions={
          <Button type="primary" onClick={() => setModalOpen(true)}>新建患者</Button>
        }
      />

      <StatBand
        label="患者摘要"
        items={[
          { key: 'total', label: '负责患者', value: total, meta: '当前筛选结果' },
          { key: 'bound', label: '已绑定账号', value: summary.bound, meta: '可同步 App 登记' },
          { key: 'unbound', label: '未绑定账号', value: summary.unbound, warn: summary.unbound > 0, meta: summary.unbound > 0 ? '需处理' : '已处理' },
          { key: 'labels', label: '诊断标签', value: summary.labels, meta: '本页涉及的标签数' },
        ]}
      />

      <Card title="患者列表" hint={`共 ${total} 位`}>
        <FilterBar
          search={
            <Input.Search
              placeholder="搜索编号或姓名"
              aria-label="搜索编号或姓名"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={(v) => { setPage(1); fetchList(1, v) }}
              allowClear
            />
          }
          filters={
            <>
              <Select
                mode="multiple"
                allowClear
                placeholder="诊断标签"
                aria-label="按诊断标签筛选"
                style={{ minWidth: 180 }}
                maxTagCount="responsive"
                value={diagnosisFilter}
                onChange={(v) => {
                  setDiagnosisFilter(v)
                  setPage(1)
                  fetchList(1, search, v, accountFilter)
                }}
                options={diagnosisOptions}
              />
              <Select
                mode="multiple"
                allowClear
                placeholder="账号状态"
                aria-label="按账号绑定状态筛选"
                style={{ minWidth: 140 }}
                maxTagCount="responsive"
                value={accountFilter}
                onChange={(v) => {
                  setAccountFilter(v)
                  setPage(1)
                  fetchList(1, search, diagnosisFilter, v)
                }}
                options={[
                  { label: '已绑定', value: 'bound' },
                  { label: '未绑定', value: 'unbound' },
                ]}
              />
              {hasFilter && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    setSearch('')
                    setDiagnosisFilter([])
                    setAccountFilter([])
                    setPage(1)
                    fetchList(1, '', [], [])
                  }}
                >
                  清除筛选
                </Button>
              )}
            </>
          }
        />

        {loading ? (
          <p className="cc-empty-line">加载中…</p>
        ) : rows.length === 0 ? (
          <div className="cc-empty-line" style={{ padding: '32px 0', textAlign: 'center' }}>
            {hasFilter ? '当前筛选条件下没有患者。' : '还没有患者。点右上角「新建患者」建档。'}
          </div>
        ) : (
          <div className="cc-patient-list">
            {rows.map((item) => <PatientRow key={item.key} item={item} />)}
          </div>
        )}

        {pageCount > 1 && (
          <div className="cc-pager">
            <Button
              size="small"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <span className="cc-pager-text">{page} / {pageCount}</span>
            <Button
              size="small"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              下一页
            </Button>
          </div>
        )}
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
