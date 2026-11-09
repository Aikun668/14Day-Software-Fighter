import { useCallback, useState } from 'react'
import { Button, Form, Input, Modal, Pagination, Select } from 'antd'
import { ApiError, apiFetch } from '../../api/client'
import {
  errorText,
  listLabel,
  useServerPage,
  type DeviceModel,
  type PageResult,
} from './adminShared'

const CATEGORIES = [
  { value: 'pMDI', label: 'pMDI' },
  { value: 'DPI', label: 'DPI' },
  { value: 'SMI', label: 'SMI' },
]

export default function DeviceModelsPanel({ onChanged }: { onChanged: () => void }) {
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form] = Form.useForm()

  const load = useCallback((page: number, pageSize: number, signal: AbortSignal) => {
    const search = query ? `&search=${encodeURIComponent(query)}` : ''
    return apiFetch<PageResult<DeviceModel>>(`/api/admin/device-models?page=${page}&page_size=${pageSize}${search}`, { signal })
  }, [query])
  const list = useServerPage(load)

  const applySearch = () => {
    setQuery(draft.trim())
    list.setPage(1)
  }

  const close = () => {
    if (submitting) return
    form.resetFields()
    setFormError(null)
    setOpen(false)
  }

  const submit = async (values: { category: string; brand: string; model_name: string; manufacturer?: string }) => {
    if (submitting) return
    const brand = values.brand.trim()
    const modelName = values.model_name.trim()
    const manufacturer = values.manufacturer?.trim() ?? ''
    if (!values.category || !brand || !modelName) {
      setFormError('请填写类别、品牌和型号')
      return
    }
    setSubmitting(true)
    setFormError(null)
    let wrote = false
    try {
      await apiFetch('/api/admin/device-models', {
        method: 'POST',
        body: JSON.stringify({
          category: values.category,
          brand,
          model_name: modelName,
          manufacturer: manufacturer || null,
        }),
      })
      wrote = true
      form.resetFields()
      setOpen(false)
      list.reload()
      onChanged()
    } catch (error) {
      if (wrote) setFormError('已创建，列表刷新失败，请重试读取')
      else setFormError(error instanceof ApiError ? error.message : errorText(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="ml-admin-view">
      <header className="ml-admin-head">
        <h1>装置型号</h1>
        <Button type="primary" onClick={() => setOpen(true)}>新建型号</Button>
      </header>
      <div className="ml-admin-sheet">
        <div className="ml-admin-tools">
          <Input
            allowClear
            value={draft}
            placeholder="搜索型号或品牌"
            aria-label="搜索型号或品牌"
            onChange={(event) => setDraft(event.target.value)}
            onPressEnter={applySearch}
          />
          <Button onClick={applySearch}>搜索</Button>
        </div>
        {list.phase === 'error' ? <p className="ml-inline-error"><span className="ml-field-error">加载失败</span><button type="button" className="ml-text-btn" onClick={list.reload}>重试</button></p> : null}
        {list.phase === 'stale' ? <p className="ml-inline-error"><span>刷新失败，下面仍是上次结果</span><button type="button" className="ml-text-btn" onClick={list.reload}>重试</button></p> : null}
        {list.phase === 'loading' && list.items.length === 0 ? <div className="ml-skeleton" aria-busy="true" aria-label="加载中" /> : null}
        {list.phase !== 'error' && list.total === 0 && list.phase !== 'loading' ? <p className="ml-empty">暂无型号</p> : null}
        {list.items.length > 0 ? (
          <div className="ml-table-wrap">
            <table className="ml-table ml-device-table">
              <thead>
                <tr>
                  <th scope="col">类别</th>
                  <th scope="col">品牌</th>
                  <th scope="col">型号</th>
                  <th scope="col">厂商</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((model) => (
                  <tr key={model.id}>
                    <td><span className="ml-neutral-tag">{model.category}</span></td>
                    <td>{model.brand}</td>
                    <td>
                      <span className="ml-strong">{listLabel(model.model_name)}</span>
                      {model.status !== 'ACTIVE' ? <span className="ml-neutral-tag">{model.status}</span> : null}
                    </td>
                    <td>{model.manufacturer?.trim() ? model.manufacturer : '—'}</td>
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
        title="新建型号"
        open={open}
        onCancel={close}
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
        <Form form={form} layout="vertical" onFinish={submit} disabled={submitting}>
          <Form.Item name="category" label="类别" rules={[{ required: true, message: '请选择类别' }]}>
            <Select options={CATEGORIES} placeholder="选择类别" />
          </Form.Item>
          <Form.Item name="brand" label="品牌" rules={[{ required: true, message: '请填写品牌' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="model_name" label="型号名称" rules={[{ required: true, message: '请填写型号名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="manufacturer" label="厂商">
            <Input />
          </Form.Item>
        </Form>
        {formError ? <p className="ml-field-error" role="alert">{formError}</p> : null}
      </Modal>
    </section>
  )
}
