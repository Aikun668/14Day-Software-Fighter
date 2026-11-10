import { useEffect, useState } from 'react'
import { Button, Form, Input, message, Modal, Popconfirm, Select, Space, Table, Tabs } from 'antd'
import { apiFetch } from '../../api/client'
import { useSearchParams } from 'react-router-dom'
import { fetchAll as fetchDirectory } from '../../components/medix/clinical'
import { Card, HeroBar } from '../../components/clinic'

interface DeviceModel {
  id: string
  category: string
  brand: string
  model_name: string
  manufacturer: string | null
  status: string
}

interface Guide {
  id: string
  device_model_id: string
  version: string
  title: string
  review_status: string
  steps: { id: string; step_no: number; text: string; error_notes: string | null }[]
}

interface UserRow {
  id: string
  account: string
  role: string
  status: string
  must_change_password: boolean
}

interface AuditRow {
  id: string
  actor_id: string | null
  action: string
  resource_type: string
  resource_id: string
  detail: Record<string, unknown> | null
  created_at: string
}

interface KnowledgeDoc {
  id: string
  device_model_id: string
  title: string
  version: string
  review_status: string
  source_url: string | null
  reviewed_at: string | null
  published_at: string | null
  chunks: { id: string; chunk_no: number; text: string }[]
}

// M06 内容与账号管理（J020 + 账号 + 审计 + 知识内容）
export default function AdminPage() {
  const [params, setParams] = useSearchParams()
  const [models, setModels] = useState<DeviceModel[]>([])
  const [guides, setGuides] = useState<Guide[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [audits, setAudits] = useState<AuditRow[]>([])
  const [kdocs, setKdocs] = useState<KnowledgeDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [modelModal, setModelModal] = useState(false)
  const [guideModal, setGuideModal] = useState(false)
  const [userModal, setUserModal] = useState(false)
  const [kbModal, setKbModal] = useState(false)
  const [kbDetail, setKbDetail] = useState<KnowledgeDoc | null>(null)
  const [modelForm] = Form.useForm()
  const [guideForm] = Form.useForm()
  const [userForm] = Form.useForm()
  const [kbForm] = Form.useForm()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [m, g, u, a, k] = await Promise.all([
        fetchDirectory<DeviceModel>('/api/admin/device-models').then(items => ({ items })),
        apiFetch<{ items: Guide[] }>('/api/admin/device-guides?page_size=100'),
        apiFetch<{ items: UserRow[] }>('/api/admin/users?page_size=100'),
        apiFetch<{ items: AuditRow[] }>('/api/admin/audit-logs?page_size=50'),
        apiFetch<{ items: KnowledgeDoc[] }>('/api/admin/knowledge-documents?page_size=100'),
      ])
      setModels(m.items)
      setGuides(g.items)
      setUsers(u.items)
      setAudits(a.items)
      setKdocs(k.items)
    } catch (e) { message.error((e as Error).message) } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const createModel = async (v: { category: string; brand: string; model_name: string; manufacturer?: string }) => {
    try {
      await apiFetch('/api/admin/device-models', { method: 'POST', body: JSON.stringify(v) })
      message.success('型号已创建')
      setModelModal(false); modelForm.resetFields(); fetchAll()
    } catch (e) { message.error((e as Error).message) }
  }

  const createGuide = async (v: { device_model_id: string; version: string; title: string; steps_text: string }) => {
    try {
      const steps = v.steps_text.split('\n').filter(s => s.trim()).map((text, i) => ({ step_no: i + 1, text: text.trim() }))
      await apiFetch('/api/admin/device-guides', {
        method: 'POST',
        body: JSON.stringify({ device_model_id: v.device_model_id, version: v.version, title: v.title, steps }),
      })
      message.success('指导草稿已创建')
      setGuideModal(false); guideForm.resetFields(); fetchAll()
    } catch (e) { message.error((e as Error).message) }
  }

  const reviewGuide = async (id: string) => {
    try {
      await apiFetch(`/api/admin/device-guides/${id}`, { method: 'PATCH', body: JSON.stringify({ review_action: 'APPROVE' }) })
      message.success('已标记审核通过')
      fetchAll()
    } catch (e) { message.error((e as Error).message) }
  }

  const publishGuide = async (id: string) => {
    try {
      await apiFetch(`/api/admin/device-guides/${id}/publish`, { method: 'POST' })
      message.success('已发布')
      fetchAll()
    } catch (e) { message.error((e as Error).message) }
  }

  const createUser = async (v: { account: string; role: string; initial_password?: string }) => {
    try {
      const r = await apiFetch<{ temporary_password?: string }>('/api/admin/users', { method: 'POST', body: JSON.stringify(v) })
      message.success(r.temporary_password ? `账号已创建，临时密码：${r.temporary_password}（请立即转告本人）` : '账号已创建')
      setUserModal(false); userForm.resetFields(); fetchAll()
    } catch (e) { message.error((e as Error).message) }
  }

  const toggleUser = async (u: UserRow) => {
    const next = u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    try {
      await apiFetch(`/api/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) })
      message.success(next === 'ACTIVE' ? '已启用' : '已停用')
      fetchAll()
    } catch (e) { message.error((e as Error).message) }
  }

  // ---- 知识内容：新建草稿 / 审核 / 发布 / 查看片段 ----
  const createKb = async (v: { device_model_id: string; title: string; version: string; source_url?: string; text: string }) => {
    try {
      await apiFetch('/api/admin/knowledge-documents', { method: 'POST', body: JSON.stringify(v) })
      message.success('知识草稿已创建（自动分块，供 AI 检索引用）')
      setKbModal(false); kbForm.resetFields(); fetchAll()
    } catch (e) { message.error((e as Error).message) }
  }

  const reviewKb = async (id: string) => {
    try {
      await apiFetch(`/api/admin/knowledge-documents/${id}`, {
        method: 'PATCH', body: JSON.stringify({ review_action: 'APPROVE' }),
      })
      message.success('已标记医学审核通过')
      fetchAll()
    } catch (e) { message.error((e as Error).message) }
  }

  const publishKb = async (id: string) => {
    try {
      await apiFetch(`/api/admin/knowledge-documents/${id}/publish`, { method: 'POST' })
      message.success('已发布（AI 助手即刻可引用该资料）')
      fetchAll()
    } catch (e) { message.error((e as Error).message) }
  }

  // 状态标签用自定义类而非预设色：预设「已发布」绿字对比度只有 3.37:1，
  // 达不到正文 4.5:1 的无障碍要求（截图工具已报过 contrastLow）。
  const statusTag = (s: string) => {
    if (s === 'DRAFT') return <span className="status-pill is-draft">草稿</span>
    if (s === 'REVIEWED') return <span className="status-pill is-reviewed">已审核</span>
    if (s === 'PUBLISHED') return <span className="status-pill is-published">已发布</span>
    return <span className="status-pill">{s}</span>
  }

  const roleLabel = (r: string) => ({ ADMIN: '管理员', CLINICIAN: '医护', PATIENT: '患者' }[r] || r)
  const resourceLabel = (r: string) => ({
    medication_event: '用药登记', medication_plan: '用药计划', followup: '随访',
    device_guide: '指导版本', knowledge_document: '知识文档', task: '核查任务',
  }[r] || r)
  const detailKeyLabel = (k: string) => ({
    reason: '原因', old_version: '原版本', version: '版本', model: '型号', close_task: '关闭任务',
  }[k] || k)
  const detailText = (d: Record<string, unknown>) =>
    Object.entries(d)
      .map(([k, v]) => `${detailKeyLabel(k)}：${typeof v === 'boolean' ? (v ? '是' : '否') : String(v)}`)
      .join('；')
  const actionLabel = (a: string) => ({
    PATIENT_CREATE: '患者建档', PATIENT_ACCOUNT_BIND: '绑定患者账号',
    GUIDE_CREATE: '创建指导', GUIDE_REVIEW: '指导审核', GUIDE_PUBLISH: '指导发布',
    KNOWLEDGE_CREATE: '创建知识', KNOWLEDGE_REVIEW: '知识审核', KNOWLEDGE_PUBLISH: '知识发布',
    PLAN_CREATE: '创建计划', PLAN_REVISION: '计划修订',
    MEDICATION_RECORD: '用药登记', MEDICATION_REVOKE: '撤销登记',
    FOLLOWUP_CREATE: '随访记录', DEVICE_BIND: '绑定装置',
    DEVICE_MODEL_CREATE: '新增型号', TASK_CREATE: '生成核查任务',
  }[a] || a)

  const guideColumns = [
    { title: '型号', dataIndex: 'device_model_id', render: (v: string) => models.find(m => m.id === v)?.model_name || v },
    { title: '版本', dataIndex: 'version' },
    { title: '标题', dataIndex: 'title' },
    { title: '状态', dataIndex: 'review_status', render: (v: string) => statusTag(v) },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: Guide) => (
        <Space>
          {r.review_status === 'DRAFT' && <Button size="small" onClick={() => reviewGuide(r.id)}>审核通过</Button>}
          {r.review_status === 'REVIEWED' && <Button size="small" type="primary" onClick={() => publishGuide(r.id)}>发布</Button>}
        </Space>
      ),
    },
  ]

  return (
    <div className="cc-page cc-admin-page">
      <HeroBar
        eyebrow={<>管理端 · <span className="ok">{models.length + guides.length + users.length + kdocs.length} 项内容</span></>}
        title="内容与账号管理"
        sub="维护指导内容、装置型号与用户账号。管理端只做目录与台账，不涉及患者临床数据。"
      />

      <Card>
        <Tabs
          activeKey={params.get('tab') ?? 'model'}
          onChange={tab => setParams({ tab })}
          items={[
            {
              key: 'model',
              label: `装置型号（${models.length}）`,
              children: (
                <>
                  <div className="cc-admin-tools">
                    <span className="cc-admin-note">登记在用的吸入装置类型，供建档与计划选用。</span>
                    <Button type="primary" onClick={() => setModelModal(true)}>新建型号</Button>
                  </div>
                  <Table rowKey="id" loading={loading} dataSource={models} pagination={false}
                    columns={[
                      { title: '类别', dataIndex: 'category' },
                      { title: '品牌', dataIndex: 'brand' },
                      { title: '型号', dataIndex: 'model_name', render: (v: string) => <span className="strong">{v}</span> },
                      { title: '厂商', dataIndex: 'manufacturer', render: (v: string | null) => v || '—' },
                    ]} />
                </>
              ),
            },
            {
              key: 'guide',
              label: `指导版本（${guides.length}）`,
              children: (
                <>
                  <div className="cc-admin-tools">
                    <span className="cc-admin-note">草稿需先「审核通过」再「发布」；已发布版本不可原地修改，需新建版本。</span>
                    <Button type="primary" onClick={() => setGuideModal(true)}>新建指导草稿</Button>
                  </div>
                  <Table rowKey="id" loading={loading} dataSource={guides} pagination={false} columns={guideColumns} />
                </>
              ),
            },
            {
              key: 'user',
              label: `账号（${users.length}）`,
              children: (
                <>
                  <div className="cc-admin-tools">
                    <span className="cc-admin-note">停用账号会立即失效其所有登录会话。</span>
                    <Button type="primary" onClick={() => setUserModal(true)}>新建账号</Button>
                  </div>
                  <Table rowKey="id" loading={loading} dataSource={users} pagination={false}
                    columns={[
                      { title: '账号', dataIndex: 'account', render: (v: string) => <span className="strong">{v}</span> },
                      { title: '角色', dataIndex: 'role', render: (v: string) => roleLabel(v) },
                      {
                        title: '状态', dataIndex: 'status',
                        render: (v: string) => v === 'ACTIVE'
                          ? <span className="status-pill is-published">启用</span>
                          : <span className="status-pill is-disabled">停用</span>,
                      },
                      { title: '需改密', dataIndex: 'must_change_password', render: (v: boolean) => v ? '是' : '否' },
                      {
                        title: '操作', key: 'action',
                        render: (_: unknown, r: UserRow) => r.status === 'ACTIVE' ? (
                          <Popconfirm
                            title="停用该账号？"
                            description="停用后其所有登录会话立即失效。"
                            okText="确认停用"
                            okButtonProps={{ danger: true }}
                            cancelText="取消"
                            onConfirm={() => toggleUser(r)}
                          >
                            <Button type="link" size="small" danger>停用</Button>
                          </Popconfirm>
                        ) : (
                          <Button type="link" size="small" onClick={() => toggleUser(r)}>启用</Button>
                        ),
                      },
                    ]} />
                </>
              ),
            },
            {
              key: 'kb',
              label: `知识内容（${kdocs.length}）`,
              children: (
                <>
                  <div className="cc-admin-tools">
                    <span className="cc-admin-note">知识文档按型号发布，经「审核 → 发布」后供患者端 AI 助手引用；草稿与未发布内容不可被检索。</span>
                    <Button type="primary" onClick={() => setKbModal(true)}>新建知识草稿</Button>
                  </div>
                  <Table rowKey="id" loading={loading} dataSource={kdocs} pagination={false}
                    columns={[
                      { title: '型号', dataIndex: 'device_model_id', render: (v: string) => models.find(m => m.id === v)?.model_name || v },
                      { title: '标题', dataIndex: 'title', render: (v: string) => <span className="strong">{v}</span> },
                      { title: '版本', dataIndex: 'version' },
                      { title: '片段数', render: (_: unknown, r: KnowledgeDoc) => r.chunks?.length || 0 },
                      { title: '状态', dataIndex: 'review_status', render: (v: string) => statusTag(v) },
                      {
                        title: '操作', key: 'action',
                        render: (_: unknown, r: KnowledgeDoc) => (
                          <Space size={4}>
                            <Button size="small" type="link" onClick={() => setKbDetail(r)}>查看</Button>
                            {r.review_status === 'DRAFT' && <Button size="small" onClick={() => reviewKb(r.id)}>审核通过</Button>}
                            {r.review_status === 'REVIEWED' && <Button size="small" type="primary" onClick={() => publishKb(r.id)}>发布</Button>}
                            {r.review_status === 'PUBLISHED' && <span className="muted">已发布（不可改）</span>}
                          </Space>
                        ),
                      },
                    ]} />
                </>
              ),
            },
            {
              key: 'audit',
              label: `审计日志（${audits.length}）`,
              children: (
                <>
                  <div className="cc-admin-tools">
                    <span className="cc-admin-note">记录关键写操作（建档、计划变更、登记撤销、内容发布、随访处理等）；不含密码与令牌。</span>
                  </div>
                  <Table rowKey="id" loading={loading} dataSource={audits} pagination={{ pageSize: 15 }}
                    columns={[
                      { title: '时间', dataIndex: 'created_at', width: 180, render: (v: string) => <span className="tabular">{new Date(v).toLocaleString('zh-CN')}</span> },
                      { title: '操作', dataIndex: 'action', render: (v: string) => actionLabel(v) },
                      { title: '资源', dataIndex: 'resource_type', render: (v: string) => resourceLabel(v) },
                      { title: '详情', dataIndex: 'detail', render: (v: Record<string, unknown> | null) => v ? detailText(v) : '—' },
                    ]} />
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal title="新建型号" open={modelModal} onCancel={() => setModelModal(false)} onOk={() => modelForm.submit()} destroyOnHidden>
        <Form form={modelForm} layout="vertical" onFinish={createModel}>
          <Form.Item name="category" label="类别" rules={[{ required: true }]}>
            <Select options={[{ value: 'pMDI' }, { value: 'DPI' }, { value: 'SMI' }]} />
          </Form.Item>
          <Form.Item name="brand" label="品牌" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="model_name" label="型号名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="manufacturer" label="厂商"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新建指导草稿" open={guideModal} onCancel={() => setGuideModal(false)} onOk={() => guideForm.submit()} destroyOnHidden width={600}>
        <Form form={guideForm} layout="vertical" onFinish={createGuide}>
          <Form.Item name="device_model_id" label="型号" rules={[{ required: true }]}>
            <Select options={models.map(m => ({ value: m.id, label: m.model_name }))} />
          </Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true }]}><Input placeholder="如 1.0" /></Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="steps_text" label="操作步骤（每行一步）" rules={[{ required: true }]}>
            <Input.TextArea rows={6} placeholder={'第一步\n第二步\n第三步'} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="新建账号" open={userModal} onCancel={() => setUserModal(false)} onOk={() => userForm.submit()} destroyOnHidden>
        <Form form={userForm} layout="vertical" onFinish={createUser}>
          <Form.Item name="account" label="账号" rules={[{ required: true, min: 2 }]}><Input placeholder="如 clinician_c" /></Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]} initialValue="CLINICIAN">
            <Select options={[{ value: 'CLINICIAN', label: '医护' }, { value: 'ADMIN', label: '管理员' }]} />
          </Form.Item>
          <Form.Item name="initial_password" label="初始密码（留空则自动生成一次性临时密码）">
            <Input placeholder="留空自动生成" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新建知识草稿 */}
      <Modal title="新建知识草稿" open={kbModal} onCancel={() => setKbModal(false)} onOk={() => kbForm.submit()} destroyOnHidden width={640}>
        <Form form={kbForm} layout="vertical" onFinish={createKb}>
          <Form.Item name="device_model_id" label="适用型号" rules={[{ required: true }]}>
            <Select options={models.map(m => ({ value: m.id, label: m.model_name }))} />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input placeholder="如 万托林使用要点（DEMO）" /></Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true }]} initialValue="1.0"><Input /></Form.Item>
          <Form.Item name="source_url" label="来源链接（可选）"><Input placeholder="https://…" /></Form.Item>
          <Form.Item name="text" label="正文（系统自动分块，供 AI 检索引用）" rules={[{ required: true }]}>
            <Input.TextArea rows={7} placeholder={'每段一个要点，建议按段落或换行分隔。\n例如：使用前必须充分摇匀约 5 秒。\n吸入后应屏气约 10 秒。'} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看知识文档与片段 */}
      <Modal title={kbDetail?.title || '知识文档'} open={kbDetail !== null} onCancel={() => setKbDetail(null)} footer={null} width={640}>
        {kbDetail && (
          <>
            <Space size={8} style={{ marginBottom: 12 }}>
              <span className="muted">{models.find(m => m.id === kbDetail.device_model_id)?.model_name}</span>
              <span className="muted">v{kbDetail.version}</span>
              {statusTag(kbDetail.review_status)}
              <span className="muted">{kbDetail.chunks?.length || 0} 个片段</span>
            </Space>
            <ul className="record-list">
              {(kbDetail.chunks || []).map((c) => (
                <li key={c.id}>
                  <div className="record-row">
                    <span className="muted">片段 {c.chunk_no}</span>
                  </div>
                  <div className="record-body">{c.text}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
    </div>
  )
}
