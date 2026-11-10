import { useCallback, useContext, useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Select, message } from 'antd'
import { apiFetch } from '../../api/client'
import { useAuth } from '../../features/auth/AuthContext'
import { PageHeading, PatientIdentity } from '../../components/medix/Medix'
import { LoadError } from '../../components/medix/ClinicalUI'
import { fetchAll, type PageResult } from '../../components/medix/clinical'
import { useClinicalQuery } from '../../components/medix/useClinicalQuery'
import { ActionError, AdminPager } from './AdminUI'
import { AdminWorking, useAdminAction } from './adminState'
interface Account { id: string; account: string; role: string; status: string; must_change_password: boolean; avatar_url?: string | null }
interface Created extends Account { temporary_password?: string | null }
const demoCodes: Record<string, string> = { admin: 'P-004', clinician_a: 'P-006', clinician_b: 'P-009', patient_x: 'P-008', patient_y: 'P-003' }
export default function AccountsPanel() {
  const [page, setPage] = useState(1), [create, setCreate] = useState(false), [toggle, setToggle] = useState<Account | null>(null), [result, setResult] = useState<Created | null>(null)
  const loader = useCallback((signal: AbortSignal) => apiFetch<PageResult<Account>>(`/api/admin/users?page=${page}&page_size=20`, { signal }), [page])
  const query = useClinicalQuery(String(page), loader)
  const lastPage = Math.max(1, Math.ceil((query.data?.total ?? 0) / 20))
  if (!query.loading && query.data && page > lastPage) setPage(lastPage)
  return <div className="ml-page ml-admin ml-accounts">
    <PageHeading title="账号管理"><Button type="primary" onClick={() => setCreate(true)}>新建账号</Button></PageHeading>
    <section className="ml-surface">
      {query.error ? <LoadError error={query.error} retry={query.retry} /> : query.loading ? <p className="ml-empty">加载中…</p> : <><div className="ml-table-wrap"><table className="ml-table ml-admin-rows"><colgroup>{[32, 16, 16, 16, 20].map((w, i) => <col key={i} style={{ width: w + '%' }} />)}</colgroup><thead><tr>{['账号', '角色', '状态', '需改密', '操作'].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{query.data?.items.map(row => <tr key={row.id}>
        <td><PatientIdentity name={row.account} code={demoCodes[row.account]} src={row.avatar_url} /></td>
        <td>{{ ADMIN: '管理员', CLINICIAN: '医护', PATIENT: '患者' }[row.role] ?? row.role}</td>
        <td><span className={`ml-review-status is-${row.status.toLowerCase()}`}>{row.status === 'ACTIVE' ? '启用' : row.status === 'DISABLED' ? '停用' : row.status}</span></td><td>{row.must_change_password ? '是' : '否'}</td>
        <td><div className="ml-admin-actions">{['ACTIVE', 'DISABLED'].includes(row.status) ? <Button danger={row.status === 'ACTIVE'} onClick={() => setToggle(row)}>{row.status === 'ACTIVE' ? '停用' : '启用'}</Button> : '—'}</div></td>
      </tr>)}</tbody></table></div>{!query.data?.total && <p className="ml-empty">暂无账号</p>}</>}
      {query.data && <AdminPager page={page} total={query.data.total} onChange={setPage} />}
    </section>
    {create && <CreateAccount onClose={() => setCreate(false)} onSaved={r => { setCreate(false); if (r.temporary_password) setResult(r); else message.success('账号已创建'); query.retry() }} />}
    {toggle && <ToggleAccount key={toggle.id} row={toggle} onClose={() => setToggle(null)} onSaved={() => { setToggle(null); query.retry() }} />}
    {result?.temporary_password && <TemporaryPassword account={result.account} secret={result.temporary_password} onDone={() => setResult(null)} />}
  </div>
}
function CreateAccount({ onClose, onSaved }: { onClose: () => void; onSaved: (r: Created) => void }) {
  const [form] = Form.useForm(), action = useAdminAction()
  const save = (v: { account: string; role: string; initial_password?: string }) => {
    void action.run(() => apiFetch<Created>('/api/admin/users', { method: 'POST', body: JSON.stringify({ account: v.account.trim(), role: v.role, initial_password: v.initial_password || null }) }), onSaved, e => { if (e.status === 409) form.setFields([{ name: 'account', errors: [e.message] }]) })
  }
  const verify = () => action.verify(async () => {
    const rows = await fetchAll<Account>('/api/admin/users')
    return rows.some(r => r.account === form.getFieldValue('account')?.trim()) ? '账号已存在，请返回列表核对；临时密码不会再次返回' : '未找到该账号，请核对列表后再创建'
  })
  return <Modal open centered width="32rem" title="新建账号" rootClassName="ml-theme ml-action-dialog ml-admin-modal" onCancel={() => !action.busy && onClose()} closable={!action.busy} maskClosable={!action.busy} keyboard={!action.busy} footer={<><Button disabled={action.busy} onClick={onClose}>取消</Button><Button aria-label="创建账号" type="primary" loading={action.busy} disabled={action.blocked} onClick={() => form.submit()}>创建账号</Button></>}>
    <Form form={form} layout="vertical" requiredMark={false} disabled={action.busy || action.blocked} initialValues={{ role: 'CLINICIAN' }} onFinish={save}>
      <Form.Item name="account" label="账号" rules={[{ validator: (_, v) => v?.trim().length >= 2 && v.trim().length <= 80 ? Promise.resolve() : Promise.reject(new Error('账号须为2–80个字符')) }]}><Input autoComplete="off" /></Form.Item>
      <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}><Select options={[{ value: 'CLINICIAN', label: '医护' }, { value: 'ADMIN', label: '管理员' }]} /></Form.Item>
      <Form.Item name="initial_password" label="初始密码" extra="留空生成临时密码" rules={[{ validator: (_, v) => !v || v.length >= 8 ? Promise.resolve() : Promise.reject(new Error('密码至少8个字符')) }]}><Input.Password autoComplete="new-password" /></Form.Item>
    </Form>
    <ActionError {...action} verify={verify} />
  </Modal>
}
function TemporaryPassword({ account, secret, onDone }: { account: string; secret: string; onDone: () => void }) {
  const setWorking = useContext(AdminWorking), [copyState, setCopyState] = useState('')
  useEffect(() => { setWorking(true); return () => setWorking(false) }, [setWorking])
  return <Modal open centered width="32rem" title="账号已创建" rootClassName="ml-theme ml-action-dialog ml-admin-modal" closable={false} keyboard={false} maskClosable={false} footer={<Button type="primary" onClick={onDone}>完成</Button>}>
    <div className="ml-temp-password"><p>{account}</p><label htmlFor="temporary-password">临时密码</label><Input.Password id="temporary-password" value={secret} readOnly autoComplete="off" /><div className="ml-temp-tools"><Button onClick={async () => { try { await navigator.clipboard.writeText(secret); setCopyState('已复制') } catch { setCopyState('复制失败，请显隐后手动复制') } }}>复制</Button><span aria-live="polite">{copyState}</span></div></div>
  </Modal>
}
function ToggleAccount({ row, onClose, onSaved }: { row: Account; onClose: () => void; onSaved: () => void }) {
  const { user, logout } = useAuth(), action = useAdminAction()
  const disable = row.status === 'ACTIVE', self = row.id === user?.id
  const confirm = () => void action.run(() => apiFetch<Account>(`/api/admin/users/${row.id}`, { method: 'PATCH', body: JSON.stringify({ status: disable ? 'DISABLED' : 'ACTIVE' }) }), async () => {
    message.success(disable ? '已停用' : '已启用')
    if (disable && self) { await logout(); return }
    onSaved()
  })
  const verify = () => action.verify(async () => {
    const current = (await fetchAll<Account>('/api/admin/users')).find(u => u.id === row.id)
    return current ? `当前状态：${current.status === 'ACTIVE' ? '启用' : current.status === 'DISABLED' ? '停用' : current.status}，请返回列表核对` : '账号不可访问，请返回列表'
  })
  return <Modal open centered width="32rem" title={`${disable ? '停用' : '启用'}账号 ${row.account}`} rootClassName="ml-theme ml-action-dialog ml-admin-modal" onCancel={() => !action.busy && onClose()} closable={!action.busy} keyboard={!action.busy} maskClosable={!action.busy} footer={<><Button disabled={action.busy} onClick={onClose}>取消</Button><Button aria-label={disable ? '确认停用' : '确认启用'} type="primary" danger={disable} loading={action.busy} disabled={action.blocked} onClick={confirm}>{disable ? '确认停用' : '确认启用'}</Button></>}>
    <p>{disable ? self ? '停用当前账号将退出。' : '停用后该账号无法继续访问。' : '确认恢复该账号访问？'}</p>
    <ActionError {...action} verify={verify} />
  </Modal>
}

