import { useCallback, useState } from 'react'
import { Button, Form, Input, Modal, Pagination, Select, message } from 'antd'
import { ApiError, apiFetch } from '../../api/client'
import { useAuth } from '../../features/auth/AuthContext'
import TemporaryCredentialResult from '../../components/medix/TemporaryCredentialResult'
import neutralUrl from '../../assets/medix/avatar-neutral.svg'
import { errorText, useServerPage, type PageResult } from './adminShared'

interface UserRow {
  id: string
  account: string
  role: string
  status: string
  must_change_password: boolean
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: '管理员',
  CLINICIAN: '医护',
  PATIENT: '患者',
}

export default function AccountsPanel() {
  const { user, logout } = useAuth()
  const [role, setRole] = useState<string | undefined>()
  const [status, setStatus] = useState<string | undefined>()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [credential, setCredential] = useState<{ account: string; temporaryPassword: string } | null>(null)
  const [confirmUser, setConfirmUser] = useState<UserRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form] = Form.useForm()

  const load = useCallback((page: number, pageSize: number, signal: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (role) params.set('role', role)
    if (status) params.set('status', status)
    return apiFetch<PageResult<UserRow>>(`/api/admin/users?${params.toString()}`, { signal })
  }, [role, status])
  const list = useServerPage(load)

  const closeForm = () => {
    if (submitting) return
    form.resetFields()
    setFormError(null)
    setOpen(false)
  }

  const submit = async (values: { account: string; role: string; initial_password?: string }) => {
    if (submitting) return
    const account = values.account.trim()
    const password = values.initial_password ?? ''
    if (account.length < 2 || account.length > 80) {
      form.setFields([{ name: 'account', errors: ['账号需要 2–80 个字符'] }])
      return
    }
    if (password !== '' && password.length < 8) {
      form.setFields([{ name: 'initial_password', errors: ['密码至少 8 个字符'] }])
      return
    }
    const body: { account: string; role: string; initial_password?: string } = {
      account,
      role: values.role,
    }
    if (password !== '') body.initial_password = password
    setSubmitting(true)
    setFormError(null)
    try {
      const created = await apiFetch<{ temporary_password: string | null; must_change_password: boolean }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      form.resetFields()
      setOpen(false)
      list.setPage(1)
      list.reload()
      if (created.temporary_password) {
        setCredential({ account, temporaryPassword: created.temporary_password })
      } else {
        message.success('账号已创建')
      }
    } catch (error) {
      const text = errorText(error)
      if (error instanceof ApiError && error.code === 'ACCOUNT_EXISTS') {
        form.setFields([{ name: 'account', errors: ['账号已存在'] }])
      } else {
        setFormError(text)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const applyStatus = async (row: UserRow, next: 'ACTIVE' | 'DISABLED') => {
    if (busyId) return
    if (next === 'DISABLED' && row.role === 'ADMIN' && row.status === 'ACTIVE') {
      try {
        const admins = await apiFetch<PageResult<UserRow>>('/api/admin/users?role=ADMIN&status=ACTIVE&page_size=1')
        if (admins.total <= 1) {
          message.error('不能停用唯一的管理员账号')
          setConfirmUser(null)
          return
        }
      } catch (error) {
        message.error(`无法确认管理员数量，已取消停用。${errorText(error)}`)
        return
      }
    }
    setBusyId(row.id)
    const self = user?.id === row.id && next === 'DISABLED'
    try {
      await apiFetch(`/api/admin/users/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })
      setConfirmUser(null)
      if (self) {
        await logout()
        window.location.assign('/login')
        return
      }
      list.reload()
      message.success(next === 'ACTIVE' ? '已启用' : '已停用')
    } catch (error) {
      message.error(errorText(error))
      list.reload()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="ml-admin-view">
      <header className="ml-admin-head">
        <h1>账号管理</h1>
        <Button type="primary" onClick={() => setOpen(true)}>新建账号</Button>
      </header>
      <div className="ml-admin-sheet">
        <div className="ml-admin-tools">
          <Select
            allowClear
            placeholder="全部角色"
            aria-label="按角色筛选"
            value={role}
            options={[
              { value: 'ADMIN', label: '管理员' },
              { value: 'CLINICIAN', label: '医护' },
              { value: 'PATIENT', label: '患者' },
            ]}
            onChange={(value) => { setRole(value); list.setPage(1) }}
          />
          <Select
            allowClear
            placeholder="全部状态"
            aria-label="按状态筛选"
            value={status}
            options={[
              { value: 'ACTIVE', label: '启用' },
              { value: 'DISABLED', label: '停用' },
            ]}
            onChange={(value) => { setStatus(value); list.setPage(1) }}
          />
        </div>
        {list.phase === 'error' ? <p className="ml-inline-error"><span className="ml-field-error">加载失败</span><button type="button" className="ml-text-btn" onClick={list.reload}>重试</button></p> : null}
        {list.phase === 'stale' ? <p className="ml-inline-error"><span>刷新失败，下面仍是上次结果</span><button type="button" className="ml-text-btn" onClick={list.reload}>重试</button></p> : null}
        {list.phase === 'loading' && list.items.length === 0 ? <div className="ml-skeleton" aria-busy="true" aria-label="加载中" /> : null}
        {list.items.length > 0 ? (
          <div className="ml-table-wrap">
            <table className="ml-table">
              <thead>
                <tr>
                  <th scope="col">账号</th>
                  <th scope="col">角色</th>
                  <th scope="col">状态</th>
                  <th scope="col">需改密</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="ml-account-cell">
                        <img src={neutralUrl} alt="" />
                        <span className="ml-wrap">{row.account}</span>
                      </span>
                    </td>
                    <td>{ROLE_LABEL[row.role] ?? row.role}</td>
                    <td>
                      {row.status === 'ACTIVE' ? <span className="ml-review is-published">启用</span> : null}
                      {row.status === 'DISABLED' ? <span className="ml-review is-draft">停用</span> : null}
                      {row.status !== 'ACTIVE' && row.status !== 'DISABLED' ? <span className="ml-review">{row.status}</span> : null}
                    </td>
                    <td>{row.must_change_password ? '是' : '否'}</td>
                    <td>
                      {row.status === 'ACTIVE' ? (
                        <button type="button" className="ml-stop" disabled={busyId === row.id} onClick={() => setConfirmUser(row)}>停用</button>
                      ) : null}
                      {row.status === 'DISABLED' ? (
                        <Button size="small" disabled={busyId === row.id} onClick={() => { void applyStatus(row, 'ACTIVE') }}>启用</Button>
                      ) : null}
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
        title="新建账号"
        open={open}
        onCancel={closeForm}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="创建"
        cancelText="取消"
        cancelButtonProps={{ disabled: submitting }}
        closable={!submitting}
        width={512}
        destroyOnHidden
        classNames={{ root: 'ml-shell ml-admin-modal' }}
      >
        <Form form={form} layout="vertical" onFinish={submit} disabled={submitting} initialValues={{ role: 'CLINICIAN' }}>
          <Form.Item name="account" label="账号" rules={[{ required: true, message: '请填写账号' }]}>
            <Input maxLength={80} />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={[{ value: 'CLINICIAN', label: '医护' }, { value: 'ADMIN', label: '管理员' }]} />
          </Form.Item>
          <Form.Item name="initial_password" label="初始密码（留空则生成临时密码）">
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
        {formError ? <p className="ml-field-error" role="alert">{formError}</p> : null}
      </Modal>

      <Modal
        title={confirmUser ? `停用 ${confirmUser.account}` : '停用账号'}
        open={confirmUser !== null}
        onCancel={() => { if (!busyId) setConfirmUser(null) }}
        onOk={() => { if (confirmUser) void applyStatus(confirmUser, 'DISABLED') }}
        confirmLoading={busyId === confirmUser?.id}
        okText="确认停用"
        cancelText="取消"
        closable={!busyId}
        classNames={{ root: 'ml-shell ml-admin-modal' }}
      >
        <p>停用后该账号无法继续访问。</p>
        {confirmUser && user?.id === confirmUser.id ? <p>停用当前账号将退出。</p> : null}
      </Modal>

      <TemporaryCredentialResult
        open={credential !== null}
        account={credential?.account ?? ''}
        temporaryPassword={credential?.temporaryPassword ?? ''}
        onDone={() => setCredential(null)}
      />
    </section>
  )
}
