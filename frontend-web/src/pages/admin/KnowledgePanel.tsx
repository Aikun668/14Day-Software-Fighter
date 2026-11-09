import { useCallback, useRef, useState } from 'react'
import { Button, Form, Input, Modal, Pagination, Select, message } from 'antd'
import { apiFetch } from '../../api/client'
import {
  ReviewStatusTag,
  errorText,
  isVersionConflict,
  listLabel,
  modelName,
  parseSourceUrl,
  useServerPage,
  type DeviceModel,
  type PageResult,
} from './adminShared'

interface Chunk {
  id: string
  chunk_no: number
  text: string
}

interface KnowledgeDoc {
  id: string
  device_model_id: string
  title: string
  version: string
  review_status: string
  source_url: string | null
  chunks: Chunk[] | null
}

type DetailState =
  | { id: string; phase: 'loading' }
  | { id: string; phase: 'error'; message: string }
  | { id: string; phase: 'ready'; doc: KnowledgeDoc }

export default function KnowledgePanel({
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
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [approveOpen, setApproveOpen] = useState(false)
  const [publishTarget, setPublishTarget] = useState<KnowledgeDoc | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const detailSeq = useRef(0)
  const [form] = Form.useForm()

  const load = useCallback((page: number, pageSize: number, signal: AbortSignal) => {
    return apiFetch<PageResult<KnowledgeDoc>>(`/api/admin/knowledge-documents?page=${page}&page_size=${pageSize}`, { signal })
  }, [])
  const list = useServerPage(load)

  const fetchDoc = (id: string) => apiFetch<KnowledgeDoc>(`/api/admin/knowledge-documents/${id}`)

  const closeForm = () => {
    if (submitting) return
    form.resetFields()
    setFormError(null)
    setOpen(false)
  }

  const submit = async (values: { device_model_id: string; title: string; version: string; source_url?: string; text: string }) => {
    if (submitting) return
    const text = (values.text ?? '').trim()
    if (!text) {
      form.setFields([{ name: 'text', errors: ['请填写正文'] }])
      return
    }
    const source = parseSourceUrl(values.source_url ?? '')
    if (!source.ok) {
      form.setFields([{ name: 'source_url', errors: [source.error] }])
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const created = await apiFetch<KnowledgeDoc>('/api/admin/knowledge-documents', {
        method: 'POST',
        body: JSON.stringify({
          device_model_id: values.device_model_id,
          title: values.title.trim(),
          version: (values.version || '1.0').trim(),
          source_url: source.value,
          text,
        }),
      })
      form.resetFields()
      setOpen(false)
      list.reload()
      const count = Array.isArray(created.chunks) ? created.chunks.length : null
      message.success(count == null ? '草稿已创建' : `草稿已创建，${count} 个片段`)
    } catch (error) {
      setFormError(errorText(error))
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = async (id: string, mode: 'view' | 'approve') => {
    const seq = ++detailSeq.current
    setDetail({ id, phase: 'loading' })
    setApproveOpen(mode === 'approve')
    try {
      const doc = await fetchDoc(id)
      if (detailSeq.current !== seq) return
      if (mode === 'approve' && doc.review_status !== 'DRAFT') {
        message.warning('状态已变化，请刷新')
        setDetail(null)
        setApproveOpen(false)
        list.reload()
        return
      }
      setDetail({ id, phase: 'ready', doc })
    } catch (error) {
      if (detailSeq.current !== seq) return
      setDetail({ id, phase: 'error', message: errorText(error) })
    }
  }

  const approve = async () => {
    if (detail?.phase !== 'ready' || busyId) return
    const id = detail.doc.id
    setBusyId(id)
    try {
      const fresh = await fetchDoc(id)
      if (fresh.review_status !== 'DRAFT') {
        message.warning('状态已变化，请刷新')
        setDetail({ id, phase: 'ready', doc: fresh })
        setApproveOpen(false)
        list.reload()
        return
      }
      const updated = await apiFetch<KnowledgeDoc>(`/api/admin/knowledge-documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ review_action: 'APPROVE' }),
      })
      setDetail(null)
      setApproveOpen(false)
      list.reload()
      message.success(updated.review_status === 'REVIEWED' ? '已审核通过' : '已提交审核')
    } catch (error) {
      message.error(errorText(error))
      if (isVersionConflict(error)) {
        setApproveOpen(false)
        list.reload()
        try {
          const fresh = await fetchDoc(id)
          if (detailSeq.current) setDetail({ id, phase: 'ready', doc: fresh })
        } catch {
          setDetail({ id, phase: 'error', message: '刷新失败' })
        }
      }
    } finally {
      setBusyId(null)
    }
  }

  const askPublish = async (id: string) => {
    if (busyId) return
    setBusyId(id)
    try {
      const doc = await fetchDoc(id)
      if (doc.review_status !== 'REVIEWED') {
        message.warning('状态已变化，请刷新')
        list.reload()
        return
      }
      setPublishTarget(doc)
    } catch (error) {
      message.error(errorText(error))
    } finally {
      setBusyId(null)
    }
  }

  const publish = async () => {
    if (!publishTarget || busyId) return
    const id = publishTarget.id
    setBusyId(id)
    try {
      await apiFetch(`/api/admin/knowledge-documents/${id}/publish`, { method: 'POST' })
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

  const chunkCount = (doc: KnowledgeDoc) => (Array.isArray(doc.chunks) ? String(doc.chunks.length) : '数据异常')

  return (
    <section className="ml-admin-view">
      <header className="ml-admin-head">
        <h1>知识内容</h1>
        <Button type="primary" onClick={() => setOpen(true)} disabled={!models}>新建知识草稿</Button>
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
        {list.items.length > 0 ? (
          <div className="ml-table-wrap">
            <table className="ml-table">
              <thead>
                <tr>
                  <th scope="col">型号</th>
                  <th scope="col">标题</th>
                  <th scope="col">版本</th>
                  <th scope="col">片段数</th>
                  <th scope="col">状态</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((doc) => (
                  <tr key={doc.id}>
                    <td>{modelName(models, doc.device_model_id)}</td>
                    <td className="ml-wrap">{listLabel(doc.title)}</td>
                    <td>{doc.version}</td>
                    <td>{chunkCount(doc)}</td>
                    <td><ReviewStatusTag status={doc.review_status} /></td>
                    <td>
                      <div className="ml-row-actions">
                        <Button size="small" onClick={() => { void openDetail(doc.id, 'view') }}>查看</Button>
                        {doc.review_status === 'DRAFT' ? <Button size="small" onClick={() => { void openDetail(doc.id, 'approve') }}>审核通过</Button> : null}
                        {doc.review_status === 'REVIEWED' ? <Button size="small" type="primary" disabled={busyId === doc.id} onClick={() => { void askPublish(doc.id) }}>发布</Button> : null}
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
        title="新建知识草稿"
        open={open}
        onCancel={closeForm}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="创建草稿"
        cancelText="取消"
        cancelButtonProps={{ disabled: submitting }}
        closable={!submitting}
        width={640}
        destroyOnHidden
        classNames={{ root: 'ml-shell ml-admin-modal' }}
      >
        <Form form={form} layout="vertical" onFinish={submit} disabled={submitting} initialValues={{ version: '1.0' }}>
          <Form.Item name="device_model_id" label="适用型号" rules={[{ required: true, message: '请选择型号' }]}>
            <Select
              placeholder={models ? '选择型号' : '型号信息不可用'}
              disabled={!models}
              options={(models ?? []).map((model) => ({ value: model.id, label: model.model_name }))}
            />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, whitespace: true, message: '请填写标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true, whitespace: true, message: '请填写版本' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="source_url" label="来源链接（选填）">
            <Input placeholder="https://" />
          </Form.Item>
          <Form.Item name="text" label="正文" extra="空行分段" rules={[{ required: true, message: '请填写正文' }]}>
            <Input.TextArea rows={8} />
          </Form.Item>
        </Form>
        {formError ? <p className="ml-field-error" role="alert">{formError}</p> : null}
      </Modal>

      <Modal
        title="知识内容"
        open={detail !== null}
        onCancel={() => { if (!busyId) { detailSeq.current += 1; setDetail(null); setApproveOpen(false) } }}
        width={640}
        classNames={{ root: 'ml-shell ml-admin-modal' }}
        footer={detail?.phase === 'ready' && approveOpen ? [
          <Button key="cancel" disabled={!!busyId} onClick={() => { setDetail(null); setApproveOpen(false) }}>取消</Button>,
          <Button key="ok" type="primary" loading={!!busyId} onClick={() => { void approve() }}>确认审核通过</Button>,
        ] : [
          <Button key="close" onClick={() => { detailSeq.current += 1; setDetail(null); setApproveOpen(false) }}>关闭</Button>,
        ]}
      >
        {detail?.phase === 'loading' ? <div className="ml-skeleton" aria-busy="true" aria-label="加载中" /> : null}
        {detail?.phase === 'error' ? <p className="ml-field-error">{detail.message}</p> : null}
        {detail?.phase === 'ready' ? <KnowledgeBody doc={detail.doc} models={models} /> : null}
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

function KnowledgeBody({ doc, models }: { doc: KnowledgeDoc; models: DeviceModel[] | null }) {
  const chunks = Array.isArray(doc.chunks) ? [...doc.chunks].sort((a, b) => a.chunk_no - b.chunk_no) : null
  const link = safeHttp(doc.source_url)
  return (
    <div className="ml-detail">
      <h2>{doc.title}</h2>
      <p className="ml-detail-meta">
        <span>{modelName(models, doc.device_model_id)}</span>
        <span>{doc.version}</span>
        <ReviewStatusTag status={doc.review_status} />
      </p>
      {link ? <p><a href={link} target="_blank" rel="noopener noreferrer">查看来源</a></p> : null}
      {chunks == null ? <p className="ml-field-error">片段数据异常</p> : (
        <div className="ml-chunks">
          {chunks.map((chunk) => (
            <p key={chunk.id}>{chunk.text}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function safeHttp(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}
