import { useCallback, useState } from 'react'
import { Button, Form, Input, Modal, Select, message } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { ApiError, apiFetch } from '../../api/client'
import { PageHeading } from '../../components/medix/Medix'
import { LoadError } from '../../components/medix/ClinicalUI'
import { fetchAll, type PageResult } from '../../components/medix/clinical'
import { useClinicalQuery } from '../../components/medix/useClinicalQuery'
import { ActionError, AdminPager, ReadMeta, ReviewStatus, SourceLink } from './AdminUI'
import { safeHttp, useAdminAction, type DeviceModel, type Guide, type Knowledge } from './adminState'

type Content = Guide | Knowledge
type Kind = 'guide' | 'kb'
const endpoint = (kind: Kind) => kind === 'guide' ? '/api/admin/device-guides' : '/api/admin/knowledge-documents'
export default function ContentPanel({ kind }: { kind: Kind }) {
  const [page, setPage] = useState(1), [create, setCreate] = useState(false), [selection, setSelection] = useState<{ id: string; mode: 'view' | 'review' | 'publish' } | null>(null)
  const loader = useCallback((signal: AbortSignal) => apiFetch<PageResult<Content>>(`${endpoint(kind)}?page=${page}&page_size=20`, { signal }), [kind, page])
  const directoryLoader = useCallback((signal: AbortSignal) => fetchAll<DeviceModel>('/api/admin/device-models', signal), [])
  const list = useClinicalQuery(`${kind}:${page}`, loader), directory = useClinicalQuery('admin-models', directoryLoader)
  const lastPage = Math.max(1, Math.ceil((list.data?.total ?? 0) / 20))
  if (!list.loading && list.data && page > lastPage) setPage(lastPage)
  const models = directory.data ?? [], modelName = (id: string) => models.find(m => m.id === id)?.model_name ?? '型号信息不可用'
  const title = kind === 'guide' ? '指导版本' : '知识内容', createLabel = kind === 'guide' ? '新建指导草稿' : '新建知识草稿'
  const widths = kind === 'guide' ? [24, 12, 30, 12, 22] : [22, 25, 9, 10, 12, 22]
  const loadDetail = useCallback(async (id: string, signal?: AbortSignal) => {
    if (kind === 'kb') return apiFetch<Knowledge>(`${endpoint(kind)}/${id}`, { signal })
    const result = await apiFetch<PageResult<Guide>>(`${endpoint(kind)}?page=${page}&page_size=20`, { signal })
    const found = result.items.find(x => x.id === id)
    if (!found) throw new ApiError(409, 'ROW_MOVED', '记录已更新，请刷新列表后重新选择')
    return found
  }, [kind, page])
  return <div className="ml-page ml-admin">
    <PageHeading title={title}><Button type="primary" disabled={!directory.data} onClick={() => setCreate(true)}>{createLabel}</Button></PageHeading>
    {directory.error && <LoadError error={`型号目录不可用：${directory.error}`} retry={directory.retry} />}
    <section className="ml-surface">
      {list.error ? <LoadError error={list.error} retry={list.retry} /> : list.loading ? <p className="ml-empty">加载中…</p> : <>
        <div className="ml-table-wrap"><table className="ml-table ml-admin-rows"><colgroup>{widths.map((w, i) => <col key={i} style={{ width: w + '%' }} />)}</colgroup><thead><tr>{(kind === 'guide' ? ['型号', '版本', '标题', '状态', '操作'] : ['型号', '标题', '版本', '片段数', '状态', '操作']).map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{list.data?.items.map(row => <tr key={row.id}>
          <td>{modelName(row.device_model_id)}</td>
          {kind === 'guide' ? <><td className="ml-version">{row.version}</td><td><span className="ml-title-clamp">{row.title}</span></td></> : <><td><span className="ml-title-clamp">{row.title}</span></td><td className="ml-version">{row.version}</td><td>{Array.isArray((row as Knowledge).chunks) ? (row as Knowledge).chunks!.length : '数据异常'}</td></>}
          <td><ReviewStatus value={row.review_status} /></td><td><div className="ml-admin-actions"><Button aria-label={`查看${row.title}`} icon={<EyeOutlined aria-hidden />} onClick={() => setSelection({ id: row.id, mode: 'view' })}>查看</Button>{row.review_status === 'DRAFT' && <Button onClick={() => setSelection({ id: row.id, mode: 'review' })}>审核通过</Button>}{row.review_status === 'REVIEWED' && <Button type="primary" onClick={() => setSelection({ id: row.id, mode: 'publish' })}>发布</Button>}</div></td>
        </tr>)}</tbody></table></div>
        {!list.data?.total && <p className="ml-empty">暂无{title}</p>}
      </>}
      {list.data && <AdminPager page={page} total={list.data.total} onChange={setPage} />}
    </section>
    {create && <CreateContent kind={kind} models={models} onClose={() => setCreate(false)} onSaved={() => { setCreate(false); setPage(1); list.retry() }} />}
    {selection && <ContentDetail key={selection.id + selection.mode} kind={kind} id={selection.id} mode={selection.mode} load={loadDetail} modelName={modelName} onClose={() => setSelection(null)} onRefresh={list.retry} />}
  </div>
}
function CreateContent({ kind, models, onClose, onSaved }: { kind: Kind; models: DeviceModel[]; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm(), action = useAdminAction()
  const save = (v: { device_model_id: string; version: string; title: string; steps_text?: string; text?: string; source_url?: string }) => {
    const common = { device_model_id: v.device_model_id, version: v.version.trim(), title: v.title.trim() }
    const payload = kind === 'guide' ? { ...common, steps: v.steps_text!.split('\n').map(t => t.trim()).filter(Boolean).map((text, i) => ({ step_no: i + 1, text })) } : { ...common, source_url: v.source_url?.trim() || null, text: v.text!.trim() }
    void action.run(() => apiFetch<Content>(endpoint(kind), { method: 'POST', body: JSON.stringify(payload) }), () => { message.success('草稿已创建'); onSaved() }, e => { if (kind === 'guide' && e.status === 409) form.setFields([{ name: 'version', errors: [e.message] }]) })
  }
  const verify = () => action.verify(async () => {
    const values = form.getFieldsValue(), rows = await fetchAll<Content>(endpoint(kind))
    return rows.some(r => r.device_model_id === values.device_model_id && r.title === values.title?.trim() && r.version === values.version?.trim()) ? '发现同名同版本记录，请返回列表核对内容' : '未找到相同记录，请核对列表后再新建'
  })
  return <Modal open centered width={kind === 'guide' ? '37.5rem' : '40rem'} title={kind === 'guide' ? '新建指导草稿' : '新建知识草稿'} rootClassName="ml-theme ml-action-dialog ml-admin-modal" closable={!action.busy} keyboard={!action.busy} maskClosable={!action.busy} onCancel={() => !action.busy && onClose()} footer={<><Button disabled={action.busy} onClick={onClose}>取消</Button><Button aria-label="创建草稿" type="primary" loading={action.busy} disabled={action.blocked} onClick={() => form.submit()}>创建草稿</Button></>}>
    <Form form={form} requiredMark={false} layout="vertical" initialValues={kind === 'kb' ? { version: '1.0' } : undefined} disabled={action.busy || action.blocked} onFinish={save}>
      <Form.Item name="device_model_id" label="适用型号" rules={[{ required: true, message: '请选择型号' }]}><Select showSearch optionFilterProp="label" options={models.map(m => ({ value: m.id, label: m.model_name }))} /></Form.Item>
      <Form.Item name="version" label="版本" rules={[{ required: true, whitespace: true, message: '请填写版本' }]}><Input /></Form.Item>
      <Form.Item name="title" label="标题" rules={[{ required: true, whitespace: true, message: '请填写标题' }]}><Input /></Form.Item>
      {kind === 'guide' ? <Form.Item name="steps_text" label="操作步骤" rules={[{ required: true, whitespace: true, message: '至少填写一步' }]}><Input.TextArea rows={5} placeholder="第一步…" /></Form.Item> : <>
        <Form.Item name="source_url" label="来源链接" rules={[{ validator: (_, v) => !v?.trim() || safeHttp(v.trim()) ? Promise.resolve() : Promise.reject(new Error('仅支持有效的 http/https 链接')) }]}><Input placeholder="https://" /></Form.Item>
        <Form.Item name="text" label="正文" extra="空行分段" rules={[{ required: true, whitespace: true, message: '请填写正文' }]}><Input.TextArea rows={6} /></Form.Item>
      </>}
    </Form>
    <ActionError {...action} verify={verify} />
  </Modal>
}
function ContentDetail({ kind, id, mode, load, modelName, onClose, onRefresh }: { kind: Kind; id: string; mode: 'view' | 'review' | 'publish'; load: (id: string, signal?: AbortSignal) => Promise<Content>; modelName: (id: string) => string; onClose: () => void; onRefresh: () => void }) {
  const loader = useCallback((signal: AbortSignal) => load(id, signal), [id, load])
  const query = useClinicalQuery(id, loader), row = query.data, action = useAdminAction()
  const expected = mode === 'review' ? 'DRAFT' : 'REVIEWED'
  const change = () => {
    if (!row || row.review_status !== expected) return
    void action.run(async () => {
      const current = await load(id)
      if (current.review_status !== expected) throw new ApiError(409, 'CHANGED', '状态已变更，请核对当前内容')
      // Do not approve changed content the user has never read.
      if (JSON.stringify(current) !== JSON.stringify(row)) throw new ApiError(409, 'CHANGED', '内容已更新，请重新阅读后确认')
      return apiFetch<Content>(`${endpoint(kind)}/${id}${mode === 'publish' ? '/publish' : ''}`, { method: mode === 'publish' ? 'POST' : 'PATCH', ...(mode === 'review' ? { body: JSON.stringify({ review_action: 'APPROVE' }) } : {}) })
    }, () => { message.success(mode === 'publish' ? '已发布' : '已审核'); onClose(); onRefresh() }, e => { if (e.status === 409) { query.retry(); onRefresh() } })
  }
  const verify = () => action.verify(async () => { const current = await load(id); query.retry(); onRefresh(); return `当前状态：${({ DRAFT: '草稿', REVIEWED: '已审核', PUBLISHED: '已发布' } as Record<string, string>)[current.review_status] ?? current.review_status}，请核对内容` })
  const validContent = row && (kind === 'guide' ? Array.isArray((row as Guide).steps) && (row as Guide).steps.length > 0 : Array.isArray((row as Knowledge).chunks) && (row as Knowledge).chunks!.length > 0)
  return <Modal open centered width="40rem" title={mode === 'publish' ? '确认发布' : mode === 'review' ? '审核内容' : '查看内容'} rootClassName="ml-theme ml-action-dialog ml-admin-modal" onCancel={() => !action.busy && onClose()} closable={!action.busy} maskClosable={!action.busy} keyboard={!action.busy} footer={<><Button disabled={action.busy} onClick={onClose}>关闭</Button>{mode !== 'view' && <Button aria-label={mode === 'review' ? '确认审核通过' : '确认发布'} type="primary" loading={action.busy} disabled={action.blocked || !validContent || row?.review_status !== expected} onClick={change}>{mode === 'review' ? '确认审核通过' : '确认发布'}</Button>}</>}>
    {query.error ? <LoadError error={query.error} retry={query.retry} /> : query.loading ? <p className="ml-empty">加载中…</p> : row && <>
      <ReadMeta><span>{modelName(row.device_model_id)}</span><span>版本 {row.version}</span><ReviewStatus value={row.review_status} /></ReadMeta>
      <h3 className="ml-content-title">{row.title}</h3>
      {kind === 'guide' ? Array.isArray((row as Guide).steps) ? <ol className="ml-content-steps">{[...(row as Guide).steps].sort((a, b) => a.step_no - b.step_no).map(step => <li key={step.id}><div className="ml-step-heading"><span className="ml-step-number">{step.step_no}.</span><p>{step.text}</p></div>{step.error_notes && <p className="ml-step-notes">{step.error_notes}</p>}{step.image_path && <p className="ml-admin-hint">图片资源不可用：{step.image_path}</p>}</li>)}</ol> : <LoadError error="步骤数据异常" /> : Array.isArray((row as Knowledge).chunks) ? <div className="ml-knowledge-chunks">{[...(row as Knowledge).chunks!].sort((a, b) => a.chunk_no - b.chunk_no).map(c => <p key={c.id}>{c.text}</p>)}</div> : <LoadError error="正文数据异常" />}
      <SourceLink value={row.source_url} title={kind === 'guide' ? (row as Guide).source_title : null} />
    </>}
    <ActionError {...action} verify={verify} />
  </Modal>
}

