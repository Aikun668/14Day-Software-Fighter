import { useCallback, useState } from 'react'
import { Button, Form, Input, Modal, Pagination, Select, message } from 'antd'
import { ApiError, apiFetch } from '../../api/client'
import {
  ReviewStatusTag,
  errorText,
  isVersionConflict,
  listLabel,
  modelName,
  parseGuideSteps,
  useServerPage,
  type DeviceModel,
  type PageResult,
} from './adminShared'

interface GuideStep {
  id: string
  step_no: number
  text: string
  error_notes: string | null
  image_path: string | null
}

interface Guide {
  id: string
  device_model_id: string
  version: string
  title: string
  source_title: string | null
  source_url: string | null
  review_status: string
  steps: GuideStep[]
}

export default function GuidesPanel({
  models,
  catalogError,
  onRetryCatalog,
}: {
  models: DeviceModel[] | null
  catalogError: string | null
  onRetryCatalog: () => void
}) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<Guide | null>(null)
  const [approveOpen, setApproveOpen] = useState(false)
  const [publishTarget, setPublishTarget] = useState<Guide | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form] = Form.useForm()

  const load = useCallback((page: number, pageSize: number, signal: AbortSignal) => {
    return apiFetch<PageResult<Guide>>(`/api/admin/device-guides?page=${page}&page_size=${pageSize}`, { signal })
  }, [])
  const list = useServerPage(load)

  const refetchPage = () => apiFetch<PageResult<Guide>>(`/api/admin/device-guides?page=${list.page}&page_size=${list.pageSize}`)

  const closeForm = () => {
    if (submitting) return
    form.resetFields()
    setFormError(null)
    setOpen(false)
  }

  const submit = async (values: { device_model_id: string; version: string; title: string; steps_text: string }) => {
    if (submitting) return
    const parsed = parseGuideSteps(values.steps_text || '')
    if (!parsed.ok) {
      form.setFields([{ name: 'steps_text', errors: [parsed.error] }])
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      await apiFetch('/api/admin/device-guides', {
        method: 'POST',
        body: JSON.stringify({
          device_model_id: values.device_model_id,
          version: values.version.trim(),
          title: values.title.trim(),
          steps: parsed.steps,
        }),
      })
      form.resetFields()
      setOpen(false)
      list.reload()
      message.success('指导草稿已创建')
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_EXISTS') {
        form.setFields([{ name: 'version', errors: [error.message || '该型号此版本已存在'] }])
      } else {
        setFormError(errorText(error))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const openFresh = async (id: string, mode: 'view' | 'approve') => {
    if (busyId) return
    setBusyId(id)
    try {
      const fresh = await refetchPage()
      const row = fresh.items.find((item) => item.id === id)
      if (!row) {
        message.warning('记录已变化，请刷新')
        list.reload()
        return
      }
      if (mode === 'approve' && row.review_status !== 'DRAFT') {
        message.warning('状态已变化，请刷新')
        list.reload()
        return
      }
      setViewer(row)
      setApproveOpen(mode === 'approve')
    } catch (error) {
      message.error(errorText(error))
    } finally {
      setBusyId(null)
    }
  }

  const approve = async () => {
    if (!viewer || busyId) return
    setBusyId(viewer.id)
    try {
      const fresh = await refetchPage()
      const row = fresh.items.find((item) => item.id === viewer.id)
      if (!row || row.review_status !== 'DRAFT') {
        message.warning('状态已变化，请刷新')
        setViewer(null)
        setApproveOpen(false)
        list.reload()
        return
      }
      await apiFetch(`/api/admin/device-guides/${viewer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ review_action: 'APPROVE' }),
      })
      setViewer(null)
      setApproveOpen(false)
      list.reload()
      message.success('已审核通过')
    } catch (error) {
      message.error(errorText(error))
      if (isVersionConflict(error)) {
        setViewer(null)
        setApproveOpen(false)
        list.reload()
      }
    } finally {
      setBusyId(null)
    }
  }

  const askPublish = async (id: string) => {
    if (busyId) return
    setBusyId(id)
    try {
      const fresh = await refetchPage()
      const row = fresh.items.find((item) => item.id === id)
      if (!row) {
        message.warning('记录已变化，请刷新')
        list.reload()
        return
      }
      if (row.review_status !== 'REVIEWED') {
        message.warning('状态已变化，请刷新')
        list.reload()
        return
      }
      setPublishTarget(row)
    } catch (error) {
      message.error(errorText(error))
    } finally {
      setBusyId(null)
    }
  }

  const publish = async () => {
    if (!publishTarget || busyId) return
    setBusyId(publishTarget.id)
    try {
      await apiFetch(`/api/admin/device-guides/${publishTarget.id}/publish`, { method: 'POST' })
      setPublishTarget(null)
      list.reload()
      message.success('已发布')
    } catch (error) {
      message.error(errorText(error))
      if (isVersionConflict(error)) {
        setPublishTarget(null)
        list.reload()
      }
    } finally {
      setBusyId(null)
    }
  }

  const steps = [...(viewer?.steps ?? [])].sort((a, b) => a.step_no - b.step_no)

  return (
    <section className="ml-admin-view">
      <header className="ml-admin-head">
        <h1>指导版本</h1>
        <Button type="primary" onClick={() => setOpen(true)} disabled={!models}>新建指导草稿</Button>
      </header>
      <div className="ml-admin-sheet">
        {catalogError ? (
          <p className="ml-inline-error">
            <span className="ml-field-error">型号信息不可用</span>
            <button type="button" className="ml-text-btn" onClick={onRetryCatalog}>重试</button>
          </p>
        ) : null}
        {list.phase === 'error' ? <p className="ml-inline-error"><span className="ml-field-error">加载失败</span><button type="button" className="ml-text-btn" onClick={list.reload}>重试</button></p> : null}
        {list.phase === 'stale' ? <p className="ml-inline-error"><span>刷新失败，下面仍是上次结果</span><button type="button" className="ml-text-btn" onClick={list.reload}>重试</button></p> : null}
        {list.phase === 'loading' && list.items.length === 0 ? <div className="ml-skeleton" aria-busy="true" aria-label="加载中" /> : null}
        {list.phase !== 'error' && list.total === 0 && list.phase !== 'loading' ? <p className="ml-empty">暂无指导</p> : null}
        {list.items.length > 0 ? (
          <div className="ml-table-wrap">
            <table className="ml-table">
              <thead>
                <tr>
                  <th scope="col">型号</th>
                  <th scope="col">版本</th>
                  <th scope="col">标题</th>
                  <th scope="col">状态</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((guide) => (
                  <tr key={guide.id}>
                    <td>{modelName(models, guide.device_model_id)}</td>
                    <td>{guide.version}</td>
                    <td className="ml-wrap">{listLabel(guide.title)}</td>
                    <td><ReviewStatusTag status={guide.review_status} /></td>
                    <td>
                      <div className="ml-row-actions">
                        <Button size="small" disabled={busyId === guide.id} onClick={() => { void openFresh(guide.id, 'view') }}>查看</Button>
                        {guide.review_status === 'DRAFT' ? (
                          <Button size="small" disabled={busyId === guide.id} onClick={() => { void openFresh(guide.id, 'approve') }}>审核通过</Button>
                        ) : null}
                        {guide.review_status === 'REVIEWED' ? (
                          <Button size="small" type="primary" disabled={busyId === guide.id} onClick={() => { void askPublish(guide.id) }}>发布</Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <Pagination
          current={list.page}
          pageSize={list.pageSize}
          total={list.total}
          showSizeChanger
          pageSizeOptions={[20, 50, 100]}
          onChange={(next, size) => {
            if (size !== list.pageSize) list.changePageSize(size)
            else list.setPage(next)
          }}
        />
      </div>

      <Modal
        title="新建指导草稿"
        open={open}
        onCancel={closeForm}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="创建草稿"
        cancelText="取消"
        cancelButtonProps={{ disabled: submitting }}
        closable={!submitting}
        width={600}
        destroyOnHidden
        classNames={{ root: 'ml-shell ml-admin-modal' }}
      >
        <Form form={form} layout="vertical" onFinish={submit} disabled={submitting}>
          <Form.Item name="device_model_id" label="型号" rules={[{ required: true, message: '请选择型号' }]}>
            <Select
              placeholder={models ? '选择型号' : '型号信息不可用'}
              disabled={!models}
              options={(models ?? []).map((model) => ({ value: model.id, label: model.model_name }))}
            />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true, whitespace: true, message: '请填写版本' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, whitespace: true, message: '请填写标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="steps_text" label="操作步骤（每行一步）" rules={[{ required: true, message: '请填写步骤' }]}>
            <Input.TextArea rows={6} placeholder={'第一步…\n第二步…'} />
          </Form.Item>
        </Form>
        {formError ? <p className="ml-field-error" role="alert">{formError}</p> : null}
      </Modal>

      <Modal
        title="指导内容"
        open={viewer !== null}
        onCancel={() => { if (!busyId) { setViewer(null); setApproveOpen(false) } }}
        footer={approveOpen ? [
          <Button key="cancel" disabled={!!busyId} onClick={() => { setViewer(null); setApproveOpen(false) }}>取消</Button>,
          <Button key="ok" type="primary" loading={busyId === viewer?.id} onClick={() => { void approve() }}>确认审核通过</Button>,
        ] : [
          <Button key="close" onClick={() => setViewer(null)}>关闭</Button>,
        ]}
        width={640}
        classNames={{ root: 'ml-shell ml-admin-modal' }}
      >
        {viewer ? (
          <div className="ml-detail">
            <p className="ml-detail-meta">
              <span>{modelName(models, viewer.device_model_id)}</span>
              <span>{viewer.version}</span>
              <ReviewStatusTag status={viewer.review_status} />
            </p>
            <h2>{viewer.title}</h2>
            {viewer.source_title ? <p>来源：{viewer.source_title}</p> : null}
            {viewer.source_url ? <SafeLink href={viewer.source_url} /> : null}
            <ol className="ml-steps">
              {steps.map((step) => (
                <li key={step.id}>
                  <span className="ml-step-no">{step.step_no}</span>
                  <div>
                    <p>{step.text}</p>
                    {step.error_notes ? <p className="ml-hint">错误提示：{step.error_notes}</p> : null}
                    {step.image_path ? <p className="ml-hint">图片不可用</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="确认发布"
        open={publishTarget !== null}
        onCancel={() => { if (!busyId) setPublishTarget(null) }}
        onOk={() => { void publish() }}
        confirmLoading={busyId === publishTarget?.id}
        okText="确认发布"
        cancelText="取消"
        closable={!busyId}
        classNames={{ root: 'ml-shell ml-admin-modal' }}
      >
        {publishTarget ? <p>发布「{publishTarget.title}」版本 {publishTarget.version}。发布后不能在这里修改。</p> : null}
      </Modal>
    </section>
  )
}

function SafeLink({ href }: { href: string }) {
  const parsed = (() => {
    try {
      const url = new URL(href)
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
    } catch {
      return null
    }
  })()
  if (!parsed) return <p className="ml-hint">来源链接不可用</p>
  return <p><a href={parsed} target="_blank" rel="noopener noreferrer">查看来源</a></p>
}
