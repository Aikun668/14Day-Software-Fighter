import { useCallback, useRef, useState } from 'react'
import { Alert, Button, Form, Input, Modal, Pagination, Select, message } from 'antd'
import { apiFetch, ApiError } from '../../api/client'
import { PageHeading } from '../../components/medix/Medix'
import { LoadError } from '../../components/medix/ClinicalUI'
import { useClinicalQuery } from '../../components/medix/useClinicalQuery'
import { type PageResult } from '../../components/medix/clinical'
import '../../styles/medix-followups.css'
import '../../styles/medix-dialogs.css'
interface Model { id: string; category: string; brand: string; model_name: string; manufacturer: string | null; status: string }
interface Values { category: string; brand: string; model_name: string; manufacturer?: string }
export default function DeviceModelsPanel() {
  const [page, setPage] = useState(1), [open, setOpen] = useState(false)
  const loader = useCallback((signal: AbortSignal) => apiFetch<PageResult<Model>>(`/api/admin/device-models?page=${page}&page_size=20`, { signal }), [page])
  const query = useClinicalQuery(String(page), loader)
  return <div className="ml-page ml-admin-models">
    <PageHeading title="装置型号"><Button type="primary" onClick={() => setOpen(true)}>新建型号</Button></PageHeading>
    <section className="ml-surface">
      {query.error ? <LoadError error={query.error} retry={query.retry} /> : query.loading ? <p className="ml-empty">加载中…</p> : <><div className="ml-table-wrap"><table className="ml-table"><colgroup>{[15, 22, 38, 25].map(w => <col key={w} style={{ width: w + '%' }} />)}</colgroup><thead><tr>{['类别', '品牌', '型号', '厂商'].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{query.data?.items.map(m => <tr key={m.id}><td><span className="ml-model-category">{m.category}</span></td><td>{m.brand}</td><td><strong>{m.model_name}</strong>{m.status !== 'ACTIVE' && <span className="ml-model-category">{m.status === 'INACTIVE' ? '停用' : m.status}</span>}</td><td>{m.manufacturer || '—'}</td></tr>)}</tbody></table></div>{!query.data?.total && <p className="ml-empty">暂无装置型号</p>}</>}
      {!!query.data && query.data.total > 20 && <div className="ml-table-footer"><span>共 {query.data.total} 个型号</span><Pagination current={page} pageSize={20} total={query.data.total} showSizeChanger={false} onChange={setPage} /></div>}
    </section>
    {open && <CreateModel onClose={() => setOpen(false)} onSaved={() => { setOpen(false); query.retry() }} />}
  </div>
}
function CreateModel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm<Values>(), [busy, setBusy] = useState(false), [error, setError] = useState(''), [blocked, setBlocked] = useState(false)
  const lock = useRef(false)
  const save = async (v: Values) => {
    if (lock.current || blocked) return
    lock.current = true; setBusy(true); setError('')
    try { await apiFetch('/api/admin/device-models', { method: 'POST', body: JSON.stringify({ category: v.category, brand: v.brand.trim(), model_name: v.model_name.trim(), manufacturer: v.manufacturer?.trim() || null }) }) }
    catch (e) { setError(e instanceof ApiError && e.status < 500 ? e.message : '结果未确认，请返回列表核对'); if (!(e instanceof ApiError) || e.status >= 500 || [403, 404].includes(e.status)) setBlocked(true); lock.current = false; setBusy(false); return }
    message.success('型号已创建'); lock.current = false; setBusy(false); onSaved()
  }
  return <Modal open centered width="32rem" title="新建型号" rootClassName="ml-theme ml-action-dialog" onCancel={() => !lock.current && onClose()} keyboard={!busy} maskClosable={!busy} closable={!busy} footer={<><Button disabled={busy} onClick={onClose}>取消</Button><Button aria-label="创建型号" type="primary" loading={busy} disabled={blocked} onClick={() => form.submit()}>创建型号</Button></>}>
    <Form form={form} layout="vertical" requiredMark={false} disabled={busy || blocked} onFinish={save}>
      <Form.Item name="category" label="类别" rules={[{ required: true, message: '请选择类别' }]}><Select options={['pMDI', 'DPI', 'SMI'].map(value => ({ value }))} /></Form.Item>
      <Form.Item name="brand" label="品牌" rules={[{ required: true, whitespace: true, message: '请填写品牌' }]}><Input /></Form.Item>
      <Form.Item name="model_name" label="型号" rules={[{ required: true, whitespace: true, message: '请填写型号' }]}><Input /></Form.Item>
      <Form.Item name="manufacturer" label="厂商"><Input /></Form.Item>
      {error && <Alert type="error" title={error} />}
    </Form>
  </Modal>
}

