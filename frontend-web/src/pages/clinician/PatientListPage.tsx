import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, message, Modal, Select } from 'antd'
import { SearchOutlined, UserOutlined, ProfileOutlined, DownOutlined } from '@ant-design/icons'
import { apiFetch } from '../../api/client'
import { PageHeading, PatientIdentity, RowAction, StatusTag } from '../../components/medix/Medix'

interface Patient { id: string; patient_code: string; display_name: string; diagnosis_label: string | null; assigned_clinician_id: string | null; account_user_id: string | null; avatar_url?: string | null }
interface PageResp { items: Patient[]; total: number }
interface DeviceModel { id: string; model_name: string }
interface Guide { id: string; title: string; steps: { id: string; step_no: number; text: string }[] }
const PAGE_SIZE = 20
const cleanDemo = (value: string | null) => value ? value.replace(/\s*[(（]DEMO[)）]/gi, '').trim() : null

export default function PatientListPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<Patient[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [diagnosisFilter, setDiagnosisFilter] = useState<string[]>([])
  const [accountFilter, setAccountFilter] = useState<string | undefined>()
  const [diagnosisOptions, setDiagnosisOptions] = useState<{ label: string; value: string }[]>([])
  const [loadedRequest, setLoadedRequest] = useState('')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const createPending = useRef(false)
  const [evalPatient, setEvalPatient] = useState<Patient | null>(null)
  const [evalOpen, setEvalOpen] = useState(false)
  const [evalForm] = Form.useForm()
  const [evalModels, setEvalModels] = useState<DeviceModel[]>([])
  const [evalGuides, setEvalGuides] = useState<Guide[]>([])
  const [evalSubmitting, setEvalSubmitting] = useState(false)
  const [guideLoading, setGuideLoading] = useState(false)
  const [modelSelected, setModelSelected] = useState(false)
  const guideRequest = useRef(0)
  const evalPending = useRef(false)
  const request = useRef(0)
  const requestKey = JSON.stringify([page, query, diagnosisFilter, accountFilter, reload])
  const loading = loadedRequest !== requestKey

  useEffect(() => {
    const sequence = ++request.current
    let active = true
    const q = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
    if (query) q.set('search', query)
    diagnosisFilter.forEach(label => q.append('diagnosis_label', label))
    if (accountFilter) q.set('account_status', accountFilter)
    apiFetch<PageResp>(`/api/patients?${q}`).then(r => {
      if (active && sequence === request.current) { setData(r.items); setTotal(r.total); setError('') }
    }).catch(e => { if (active && sequence === request.current) setError((e as Error).message) })
      .finally(() => { if (active && sequence === request.current) setLoadedRequest(JSON.stringify([page, query, diagnosisFilter, accountFilter, reload])) })
    return () => { active = false }
  }, [page, query, diagnosisFilter, accountFilter, reload])
  useEffect(() => {
    apiFetch<{ diagnosis_labels: string[] }>('/api/patients/filter-options')
      .then(r => setDiagnosisOptions(r.diagnosis_labels.map(v => ({ label: cleanDemo(v) || v, value: v })))).catch(() => {})
  }, [])

  const onCreate = async (values: { patient_code: string; display_name: string; diagnosis_label?: string; note?: string }) => {
    if (createPending.current) return
    createPending.current = true
    setSubmitting(true)
    try {
      await apiFetch('/api/patients', { method: 'POST', body: JSON.stringify(values) })
      message.success('建档成功')
      setModalOpen(false); form.resetFields(); setPage(1); setReload(r => r + 1)
    } catch (e) { message.error((e as Error).message) }
    finally { createPending.current = false; setSubmitting(false) }
  }
  const openEval = async (p: Patient) => {
    guideRequest.current += 1
    setEvalPatient(p); setEvalOpen(true); setEvalGuides([]); setModelSelected(false); setGuideLoading(false); evalForm.resetFields()
    try {
      const ms = await apiFetch<{ items: DeviceModel[] }>('/api/device-models?page_size=100')
      setEvalModels(ms.items)
    } catch (e) { message.error((e as Error).message) }
  }
  const onModelChange = async (modelId: string) => {
    const sequence = ++guideRequest.current
    setModelSelected(true); setEvalGuides([]); setGuideLoading(true); evalForm.setFieldValue('guide_id', undefined)
    try {
      const g = await apiFetch<Guide>(`/api/device-models/${modelId}/guide`)
      if (sequence === guideRequest.current) setEvalGuides([g])
    } catch { if (sequence === guideRequest.current) setEvalGuides([]) }
    finally { if (sequence === guideRequest.current) setGuideLoading(false) }
  }
  const submitEval = async (v: { device_model_id: string; guide_id: string; result?: string }) => {
    if (!evalPatient || evalPending.current) return
    const guide = evalGuides.find(g => g.id === v.guide_id)
    if (!guide || guideLoading) { message.error('请先选择指导'); return }
    evalPending.current = true; setEvalSubmitting(true)
    try {
      await apiFetch('/api/training-sessions', { method: 'POST', body: JSON.stringify({
        patient_id: evalPatient.id, device_model_id: v.device_model_id, guide_id: guide.id,
        result: v.result || '现场观察', step_results: guide.steps.map(s => ({ step_id: s.id, check_state: 'DONE' })),
      }) })
      message.success('现场评估已记录'); setEvalOpen(false); evalForm.resetFields()
    } catch (e) { message.error((e as Error).message) }
    finally { evalPending.current = false; setEvalSubmitting(false) }
  }
  const hasFilter = !!(diagnosisFilter.length || accountFilter || query)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return <div className="ml-page ml-patients-page">
    <PageHeading title="患者管理">
      <Input className="ml-patient-search" prefix={<SearchOutlined />} placeholder="搜索姓名或编号" aria-label="搜索姓名或编号" value={search} allowClear onChange={e => { setSearch(e.target.value); if (!e.target.value) { setQuery(''); setPage(1) } }} onPressEnter={() => { setQuery(search.trim()); setPage(1) }} />
      <Select className="ml-diagnosis-filter" mode="multiple" allowClear placeholder="诊断标签" aria-label="按诊断标签筛选" maxTagCount="responsive" suffixIcon={<DownOutlined />} value={diagnosisFilter} onChange={v => { setDiagnosisFilter(v); setPage(1) }} options={diagnosisOptions} />
      <Select className="ml-account-filter" allowClear placeholder="账号状态" aria-label="按账号绑定状态筛选" suffixIcon={<DownOutlined />} value={accountFilter} onChange={v => { setAccountFilter(v); setPage(1) }} options={[{ label: '已绑定', value: 'bound' }, { label: '未绑定', value: 'unbound' }]} />
      <Button type="primary" onClick={() => setModalOpen(true)}>新建患者</Button>
      {hasFilter && <button className="ml-text-button" type="button" onClick={() => { setSearch(''); setQuery(''); setDiagnosisFilter([]); setAccountFilter(undefined); setPage(1) }}>清除筛选</button>}
    </PageHeading>
    <section className="ml-surface ml-patients-table" aria-label="患者列表" aria-busy={loading}>
      {error && <p role="alert" className="ml-section-error">{error} <button type="button" className="ml-text-button" onClick={() => setReload(r => r + 1)}>重试</button></p>}
      {loading && data.length === 0 ? <p className="ml-empty">加载中…</p> : data.length === 0 ? <p className="ml-empty">{error ? '患者列表暂不可用' : hasFilter ? '没有匹配患者' : '暂无患者'}</p> : <div className="ml-table-wrap"><table className="ml-table">
        <colgroup><col style={{ width: '32%' }} /><col style={{ width: '34%' }} /><col style={{ width: '20%' }} /><col style={{ width: '14%' }} /></colgroup>
        <thead><tr><th>患者</th><th>诊断</th><th>账号状态</th><th>操作</th></tr></thead>
        <tbody>{data.map(p => <tr key={p.id}><td><PatientIdentity name={p.display_name} code={p.patient_code} src={p.avatar_url} demoPatient={Boolean(p.diagnosis_label?.includes('DEMO'))} onClick={() => navigate(`/patients/${p.id}`)} /></td><td>{cleanDemo(p.diagnosis_label) || '—'}</td><td><StatusTag bound={Boolean(p.account_user_id)} /></td><td className="ml-actions-cell"><div className="ml-row-actions"><RowAction label={`查看${p.display_name}详情`} icon={<UserOutlined />} onClick={() => navigate(`/patients/${p.id}`)} /><RowAction label={`为${p.display_name}现场评估`} icon={<ProfileOutlined />} onClick={() => { void openEval(p) }} /></div></td></tr>)}</tbody>
      </table></div>}
      <footer className="ml-table-footer"><span>共 {total} 位</span>{pageCount > 1 && <div className="ml-pager"><Button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>上一页</Button><span>{page} / {pageCount}</span><Button disabled={page >= pageCount || loading} onClick={() => setPage(p => p + 1)}>下一页</Button></div>}</footer>
    </section>
    <Modal rootClassName="ml-theme" title="新建患者" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={submitting} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={onCreate}>
        <Form.Item name="patient_code" label="患者编号" rules={[{ required: true, message: '请输入患者编号' }]}><Input /></Form.Item>
        <Form.Item name="display_name" label="姓名/别名" rules={[{ required: true, message: '请输入姓名或别名' }]}><Input /></Form.Item>
        <Form.Item name="diagnosis_label" label="诊断标签"><Input /></Form.Item>
        <Form.Item name="note" label="备注"><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
    <Modal rootClassName="ml-theme" title={`现场评估 · ${evalPatient?.display_name || ''}`} open={evalOpen} onCancel={() => { guideRequest.current += 1; setEvalOpen(false) }} onOk={() => evalForm.submit()} confirmLoading={evalSubmitting} okButtonProps={{ disabled: guideLoading || !evalGuides.length }} destroyOnHidden>
      <Form form={evalForm} layout="vertical" onFinish={submitEval}>
        <Form.Item name="device_model_id" label="型号" rules={[{ required: true, message: '请选择型号' }]}><Select placeholder="选择型号" options={evalModels.map(m => ({ value: m.id, label: m.model_name }))} onChange={onModelChange} /></Form.Item>
        <Form.Item name="guide_id" label="指导版本" rules={[{ required: true, message: '请选择指导' }]}><Select placeholder={modelSelected && !guideLoading && !evalGuides.length ? '暂无已发布指导' : '选择指导'} loading={guideLoading} options={evalGuides.map(g => ({ value: g.id, label: g.title }))} /></Form.Item>
        <Form.Item name="result" label="评估结论"><Input /></Form.Item>
      </Form>
    </Modal>
  </div>
}
