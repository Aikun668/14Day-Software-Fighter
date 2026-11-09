import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, Modal, Select } from 'antd'
import { apiFetch } from '../../api/client'
import {
  MedixPageHeading,
  PatientAvatar,
  PatientIdentity,
  RowAction,
  StatusTag,
  Surface,
} from '../../components/medix'
import { IconClipboard, IconPerson } from '../../components/medix/icons'

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
interface Guide { id: string; title: string; steps?: { id: string; step_no: number; text: string }[] }

const PAGE_SIZE = 20

const cleanDemo = (value: string | null) =>
  value ? value.replace(/\s*[(（]DEMO[)）]/gi, '').trim() : null

function errorText(reason: unknown) {
  return reason instanceof Error && reason.message ? reason.message : '请求失败'
}

export default function PatientListPage() {
  const navigate = useNavigate()
  const listSeq = useRef(0)
  const guideSeq = useRef(0)
  const [data, setData] = useState<Patient[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [diagnosisFilter, setDiagnosisFilter] = useState<string[]>([])
  const [accountFilter, setAccountFilter] = useState<string[]>([])
  const [diagnosisOptions, setDiagnosisOptions] = useState<{ label: string; value: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [listNonce, setListNonce] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [evalPatient, setEvalPatient] = useState<Patient | null>(null)
  const [evalOpen, setEvalOpen] = useState(false)
  const [evalForm] = Form.useForm()
  const [evalModels, setEvalModels] = useState<DeviceModel[]>([])
  const [evalGuides, setEvalGuides] = useState<Guide[]>([])
  const [guidesLoading, setGuidesLoading] = useState(false)
  const [guideNote, setGuideNote] = useState<string | null>(null)
  const [evalSubmitting, setEvalSubmitting] = useState(false)
  const [evalError, setEvalError] = useState<string | null>(null)
  const selectedModel = Form.useWatch('device_model_id', evalForm)

  useEffect(() => {
    const seq = ++listSeq.current
    const controller = new AbortController()
    const q = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
    if (search) q.set('search', search)
    diagnosisFilter.forEach((label) => q.append('diagnosis_label', label))
    if (accountFilter.length === 1) q.set('account_status', accountFilter[0])
    apiFetch<PageResp>(`/api/patients?${q}`, { signal: controller.signal })
      .then((resp) => {
        if (seq !== listSeq.current) return
        if (!resp || !Array.isArray(resp.items) || typeof resp.total !== 'number') {
          setListError('患者列表不可用')
          return
        }
        setData(resp.items)
        setTotal(resp.total)
        setListError(null)
      })
      .catch((error: unknown) => {
        if (seq !== listSeq.current) return
        if (typeof error === 'object' && error && 'name' in error && (error as { name?: string }).name === 'AbortError') return
        setListError(errorText(error))
      })
      .finally(() => {
        if (seq === listSeq.current) setLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [page, search, diagnosisFilter, accountFilter, listNonce])

  useEffect(() => {
    let active = true
    apiFetch<{ diagnosis_labels: string[] }>('/api/patients/filter-options')
      .then((result) => {
        if (!active) return
        const labels = Array.isArray(result?.diagnosis_labels) ? result.diagnosis_labels : []
        setDiagnosisOptions(labels.map((value) => ({ label: value, value })))
      })
      .catch(() => {
        if (active) setDiagnosisOptions([])
      })
    return () => {
      active = false
    }
  }, [])

  const reloadFromFirstPage = () => {
    setLoading(true)
    setPage(1)
    setListNonce((nonce) => nonce + 1)
  }

  const onCreate = async (values: { patient_code: string; display_name: string; diagnosis_label?: string; note?: string }) => {
    if (submitting) return
    setSubmitting(true)
    setCreateError(null)
    try {
      await apiFetch('/api/patients', { method: 'POST', body: JSON.stringify(values) })
      setModalOpen(false)
      form.resetFields()
      reloadFromFirstPage()
    } catch (error) {
      setCreateError(errorText(error))
    } finally {
      setSubmitting(false)
    }
  }

  const openEval = (patient: Patient) => {
    guideSeq.current += 1
    setEvalPatient(patient)
    setEvalGuides([])
    setGuideNote(null)
    setGuidesLoading(false)
    setEvalError(null)
    setEvalSubmitting(false)
    evalForm.resetFields()
    setEvalOpen(true)
    apiFetch<{ items: DeviceModel[] }>('/api/device-models?page_size=100')
      .then((result) => setEvalModels(Array.isArray(result.items) ? result.items : []))
      .catch((error: unknown) => setEvalError(errorText(error)))
  }

  const onModelChange = (modelId: string) => {
    const seq = ++guideSeq.current
    evalForm.setFieldValue('guide_id', undefined)
    setEvalGuides([])
    setGuideNote(null)
    setGuidesLoading(true)
    apiFetch<Guide>(`/api/device-models/${modelId}/guide`)
      .then((guide) => {
        if (seq !== guideSeq.current) return
        setEvalGuides(guide?.id ? [guide] : [])
        setGuideNote(guide?.id ? null : '该型号没有已发布指导')
      })
      .catch(() => {
        if (seq !== guideSeq.current) return
        setEvalGuides([])
        setGuideNote('该型号没有已发布指导')
      })
      .finally(() => {
        if (seq === guideSeq.current) setGuidesLoading(false)
      })
  }

  const submitEval = async (values: { device_model_id: string; guide_id: string; result?: string }) => {
    if (!evalPatient || evalSubmitting) return
    const guide = evalGuides.find((item) => item.id === values.guide_id)
    if (!guide) {
      setEvalError('请先选择指导')
      return
    }
    const steps = Array.isArray(guide.steps) ? guide.steps : []
    setEvalSubmitting(true)
    setEvalError(null)
    try {
      await apiFetch('/api/training-sessions', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: evalPatient.id,
          device_model_id: values.device_model_id,
          guide_id: guide.id,
          result: values.result || '现场观察',
          step_results: steps.map((step) => ({ step_id: step.id, check_state: 'DONE' })),
        }),
      })
      setEvalOpen(false)
      evalForm.resetFields()
      setEvalGuides([])
      setGuideNote(null)
    } catch (error) {
      setEvalError(errorText(error))
    } finally {
      setEvalSubmitting(false)
    }
  }

  const hasFilter = diagnosisFilter.length > 0 || accountFilter.length > 0 || search.length > 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canSubmitEval = evalGuides.length > 0 && !guidesLoading && !evalSubmitting

  const clearFilters = () => {
    setLoading(true)
    setSearchInput('')
    setSearch('')
    setDiagnosisFilter([])
    setAccountFilter([])
    setPage(1)
    setListNonce((nonce) => nonce + 1)
  }

  return (
    <div className="ml-patients">
      <MedixPageHeading
        title="患者管理"
        actions={
          <div className="ml-patients-tools">
            <Input.Search
              className="ml-filter-search"
              placeholder="搜索姓名或编号"
              aria-label="搜索姓名或编号"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onSearch={(value) => {
                setLoading(true)
                setSearchInput(value)
                setSearch(value)
                setPage(1)
                setListNonce((nonce) => nonce + 1)
              }}
              allowClear
            />
            <Select
              className="ml-filter-diagnosis"
              mode="multiple"
              allowClear
              placeholder="诊断标签"
              aria-label="按诊断标签筛选"
              maxTagCount="responsive"
              value={diagnosisFilter}
              onChange={(value) => {
                setLoading(true)
                setDiagnosisFilter(value)
                setPage(1)
                setListNonce((nonce) => nonce + 1)
              }}
              options={diagnosisOptions}
            />
            <Select
              className="ml-filter-account"
              mode="multiple"
              allowClear
              placeholder="账号状态"
              aria-label="按账号绑定状态筛选"
              maxTagCount="responsive"
              value={accountFilter}
              onChange={(value) => {
                setLoading(true)
                setAccountFilter(value)
                setPage(1)
                setListNonce((nonce) => nonce + 1)
              }}
              options={[
                { label: '已绑定', value: 'bound' },
                { label: '未绑定', value: 'unbound' },
              ]}
            />
            {hasFilter ? (
              <Button onClick={clearFilters}>清除筛选</Button>
            ) : null}
            <Button type="primary" onClick={() => { setCreateError(null); setModalOpen(true) }}>新建患者</Button>
          </div>
        }
      />

      <Surface>
        <div className="ml-table-wrap">
          <table className="ml-table">
            <colgroup>
              <col className="ml-col-patient" />
              <col className="ml-col-diagnosis" />
              <col className="ml-col-account" />
              <col className="ml-col-ops" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">患者</th>
                <th scope="col">诊断</th>
                <th scope="col">账号状态</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && data.length === 0 ? (
                <tr>
                  <td colSpan={4}>加载中…</td>
                </tr>
              ) : listError && data.length === 0 ? (
                <tr>
                  <td colSpan={4}><p className="ml-block-error" role="alert">{listError}</p></td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className="ml-empty">{hasFilter ? '没有匹配患者' : '暂无患者'}</p>
                    {hasFilter ? (
                      <div className="ml-fold-row">
                        <button type="button" className="ml-fold" onClick={clearFilters}>清除筛选</button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ) : data.map((patient) => {
                const bound = Boolean(patient.account_user_id)
                const diagnosis = cleanDemo(patient.diagnosis_label)
                return (
                  <tr
                    key={patient.id}
                    className="ml-click-row"
                    data-patient-id={patient.id}
                    tabIndex={0}
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        navigate(`/patients/${patient.id}`)
                      }
                    }}
                  >
                    <td>
                      <PatientIdentity
                        name={patient.display_name}
                        avatar={<PatientAvatar name={patient.display_name} patientId={patient.id} />}
                      />
                    </td>
                    <td>{diagnosis || '—'}</td>
                    <td>
                      <StatusTag kind={bound ? 'bound' : 'unbound'} label={bound ? '已绑定' : '未绑定'} />
                    </td>
                    <td onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                      <div className="ml-row-actions">
                        <RowAction
                          label={`查看${patient.display_name}详情`}
                          icon={<IconPerson />}
                          onClick={() => navigate(`/patients/${patient.id}`)}
                        />
                        <RowAction
                          label={`为${patient.display_name}做现场评估`}
                          icon={<IconClipboard />}
                          onClick={() => openEval(patient)}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {listError && data.length > 0 ? <p className="ml-block-error" role="alert">{listError}</p> : null}
        <div className="ml-table-foot" data-page={page} data-total={total}>
          <span>共 {total} 位</span>
          {pageCount > 1 ? (
            <div className="ml-pager">
              <Button size="small" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => Math.max(1, current - 1)) }}>
                上一页
              </Button>
              <span>{page} / {pageCount}</span>
              <Button size="small" disabled={page >= pageCount || loading} onClick={() => { setLoading(true); setPage((current) => Math.min(pageCount, current + 1)) }}>
                下一页
              </Button>
            </div>
          ) : null}
        </div>
      </Surface>

      <Modal
        title="新建患者"
        open={modalOpen}
        width={480}
        onCancel={() => { if (!submitting) setModalOpen(false) }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="确定"
        cancelText="取消"
        destroyOnHidden
      >
        <Form className="ml-dialog-body" form={form} layout="vertical" onFinish={onCreate}>
          <Form.Item name="patient_code" label="患者编号" rules={[{ required: true, message: '请输入患者编号' }]}>
            <Input aria-label="患者编号" />
          </Form.Item>
          <Form.Item name="display_name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input aria-label="姓名" />
          </Form.Item>
          <Form.Item name="diagnosis_label" label="诊断标签">
            <Input aria-label="诊断标签" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} aria-label="备注" />
          </Form.Item>
          {createError ? <p className="ml-block-error" role="alert">{createError}</p> : null}
        </Form>
      </Modal>

      <Modal
        title="现场评估"
        open={evalOpen}
        width={480}
        onCancel={() => { if (!evalSubmitting) setEvalOpen(false) }}
        onOk={() => evalForm.submit()}
        confirmLoading={evalSubmitting}
        okButtonProps={{ disabled: !canSubmitEval }}
        okText="确定"
        cancelText="取消"
        destroyOnHidden
      >
        <Form className="ml-dialog-body" form={evalForm} layout="vertical" onFinish={submitEval}>
          <div className="ml-modal-who">
            <PatientAvatar name={evalPatient?.display_name || ''} patientId={evalPatient?.id || ''} />
            <div className="ml-modal-name">{evalPatient?.display_name}</div>
          </div>
          <Form.Item name="device_model_id" label="型号" rules={[{ required: true, message: '请选择型号' }]}>
            <Select
              placeholder="选择型号"
              aria-label="型号"
              options={evalModels.map((model) => ({ value: model.id, label: model.model_name }))}
              onChange={onModelChange}
            />
          </Form.Item>
          <Form.Item name="guide_id" label="指导版本" rules={[{ required: true, message: '请选择指导' }]}>
            <Select
              placeholder="选择指导"
              aria-label="指导版本"
              disabled={guidesLoading || evalGuides.length === 0}
              options={evalGuides.map((guide) => ({ value: guide.id, label: guide.title }))}
            />
          </Form.Item>
          {selectedModel && !guidesLoading && guideNote ? <p className="ml-hint">{guideNote}</p> : null}
          <Form.Item name="result" label="评估结论">
            <Input aria-label="评估结论" />
          </Form.Item>
          {evalError ? <p className="ml-block-error" role="alert">{evalError}</p> : null}
        </Form>
      </Modal>
    </div>
  )
}
