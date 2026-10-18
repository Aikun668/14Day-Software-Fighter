import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, DatePicker, Empty, Form, Input, Modal, Select, Space, Spin, Tabs, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { apiFetch } from '../../api/client'
import PageHeader from '../../components/PageHeader'

interface PatientDetail {
  id: string
  patient_code: string
  display_name: string
  diagnosis_label: string | null
  note: string | null
  assigned_clinician_id: string | null
  account_user_id: string | null
}

interface Device {
  id: string
  device_model_id: string
  effective_from: string
  effective_to: string | null
}

interface Plan {
  id: string
  version: number
  drug_label: string
  plan_type: string
  starts_at: string
  ends_at: string | null
  daily_times: { local_time: string; label: string | null }[]
}

interface Event {
  id: string
  slot_id: string | null
  source: string
  occurred_at: string
  status: string
  note: string | null
}

interface Training {
  id: string
  source: string
  submit_at: string
  result: string | null
}

interface Followup {
  id: string
  followed_at: string
  feedback: string | null
  action_taken: string | null
  next_plan: string | null
}

// M02 患者详情（J016 补充）：档案 / 装置 / 计划 / 记录 / 训练 / 随访
export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<PatientDetail | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [trainings, setTrainings] = useState<Training[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])
  const [modelNames, setModelNames] = useState<Record<string, string>>({})
  // 各列表的服务端总数（页面上只取前 50 条，计数要显示真实总数）
  const [totals, setTotals] = useState({ events: 0, trainings: 0, followups: 0, plans: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      try {
        const [p, d, pl, ev, tr, fu, models] = await Promise.all([
          apiFetch<PatientDetail>(`/api/patients/${id}`),
          apiFetch<{ items: Device[] }>(`/api/patients/${id}/devices`).catch(() => ({ items: [] })),
          apiFetch<{ items: Plan[] }>(`/api/patients/${id}/medication-plans?include_history=true&page_size=100`).catch(() => ({ items: [] })),
          apiFetch<{ items: Event[]; total: number }>(`/api/patients/${id}/medication-events?page_size=50`).catch(() => ({ items: [], total: 0 })),
          apiFetch<{ items: Training[]; total: number }>(`/api/patients/${id}/training-sessions?page_size=50`).catch(() => ({ items: [], total: 0 })),
          apiFetch<{ items: Followup[]; total: number }>(`/api/patients/${id}/followups?page_size=50`).catch(() => ({ items: [], total: 0 })),
          apiFetch<{ items: { id: string; model_name: string }[] }>('/api/device-models?page_size=100').catch(() => ({ items: [] })),
        ])
        setPatient(p)
        setDevices(d.items)
        setPlans(pl.items)
        setEvents(ev.items)
        setTrainings(tr.items)
        setFollowups(fu.items)
        // 服务端总数（列表只取了前 50 条，标签计数不能直接用数组长度）
        setTotals({ events: ev.total, trainings: tr.total, followups: fu.total, plans: pl.items.length })
        setModelNames(Object.fromEntries(models.items.map((m) => [m.id, m.model_name])))
      } catch (e) {
        message.error((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const dt = (s: string) => new Date(s).toLocaleString('zh-CN')
  const d = (s: string) => new Date(s).toLocaleDateString('zh-CN')

  // ---- 动态时间线：把计划/登记/训练/随访合并为一条按时间倒序的轴 ----
  type TimelineItem = {
    key: string
    at: number            // 排序时间戳
    day: string           // 日期分组
    time: string
    kind: 'plan' | 'event' | 'training' | 'followup'
    title: string
    detail: string
    tone: 'plan' | 'ok' | 'warn' | 'bad'
  }
  const toneLabel: Record<TimelineItem['kind'], string> = {
    plan: '计划', event: '登记', training: '训练', followup: '随访',
  }
  const timeline: TimelineItem[] = [
    ...plans.map<TimelineItem>((p) => ({
      key: `p-${p.id}`, at: new Date(p.starts_at).getTime(),
      day: d(p.starts_at), time: new Date(p.starts_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      kind: 'plan',
      title: `用药计划更新为 v${p.version}（${p.plan_type === 'REGULAR' ? '固定' : '按需'}）`,
      detail: `${p.drug_label}｜每日时点：${p.daily_times?.length ? p.daily_times.map((t) => String(t.local_time).slice(0, 5)).join(' / ') : '—'}`,
      tone: 'plan',
    })),
    ...events.map<TimelineItem>((e) => ({
      key: `e-${e.id}`, at: new Date(e.occurred_at).getTime(),
      day: d(e.occurred_at), time: new Date(e.occurred_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      kind: 'event',
      title: e.status === 'REVOKED' ? '用药登记（已撤销）' : '用药登记',
      detail: `${e.source === 'PATIENT_REPORT' ? '患者自述' : '医护观察'}${e.slot_id ? ' · 固定时点' : ' · 按需'}${e.note ? ` · ${e.note}` : ''}`,
      tone: e.status === 'REVOKED' ? 'bad' : 'ok',
    })),
    ...trainings.map<TimelineItem>((t) => ({
      key: `t-${t.id}`, at: new Date(t.submit_at).getTime(),
      day: d(t.submit_at), time: new Date(t.submit_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      kind: 'training',
      title: t.source === 'PATIENT_REPORT' ? '操作自检（患者自述）' : '操作评估（医护观察）',
      detail: t.result || '—',
      tone: t.source === 'PATIENT_REPORT' ? 'ok' : 'plan',
    })),
    ...followups.map<TimelineItem>((f) => ({
      key: `f-${f.id}`, at: new Date(f.followed_at).getTime(),
      day: d(f.followed_at), time: new Date(f.followed_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      kind: 'followup',
      title: '随访记录',
      detail: [f.feedback, f.action_taken, f.next_plan].filter(Boolean).join('｜'),
      tone: 'warn',
    })),
  ].sort((a, b) => b.at - a.at)

  // 按日期分组渲染
  const timelineGroups = timeline.reduce<{ day: string; items: TimelineItem[] }[]>((acc, it) => {
    const last = acc[acc.length - 1]
    if (last && last.day === it.day) last.items.push(it)
    else acc.push({ day: it.day, items: [it] })
    return acc
  }, [])

  // ---- 医护闭环操作（编辑 / 绑账号 / 绑装置 / 撤销登记 / 计划修订）----
  const [editOpen, setEditOpen] = useState(false)
  const [bindAcctOpen, setBindAcctOpen] = useState(false)
  const [bindDevOpen, setBindDevOpen] = useState(false)
  const [revOpen, setRevOpen] = useState<Plan | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<Event | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [editForm] = Form.useForm()
  const [bindAcctForm] = Form.useForm()
  const [bindDevForm] = Form.useForm()
  const [revForm] = Form.useForm()
  const [deviceOptions, setDeviceOptions] = useState<{ value: string; label: string }[]>([])

  const reload = async () => {
    if (!id) return
    const [p2, d2, pl2, ev2, tr2, fu2] = await Promise.all([
      apiFetch<PatientDetail>(`/api/patients/${id}`),
      apiFetch<{ items: Device[] }>(`/api/patients/${id}/devices`).catch(() => ({ items: [] })),
      apiFetch<{ items: Plan[] }>(`/api/patients/${id}/medication-plans?include_history=true&page_size=100`).catch(() => ({ items: [] })),
      apiFetch<{ items: Event[]; total: number }>(`/api/patients/${id}/medication-events?page_size=50`).catch(() => ({ items: [], total: 0 })),
      apiFetch<{ items: Training[]; total: number }>(`/api/patients/${id}/training-sessions?page_size=50`).catch(() => ({ items: [], total: 0 })),
      apiFetch<{ items: Followup[]; total: number }>(`/api/patients/${id}/followups?page_size=50`).catch(() => ({ items: [], total: 0 })),
    ])
    setPatient(p2); setDevices(d2.items); setPlans(pl2.items)
    setEvents(ev2.items); setTrainings(tr2.items); setFollowups(fu2.items)
    setTotals({
      events: ev2.total ?? ev2.items.length,
      trainings: tr2.total ?? tr2.items.length,
      followups: fu2.total ?? fu2.items.length,
      plans: pl2.items.length,
    })
  }

  const openEdit = () => {
    editForm.setFieldsValue({
      display_name: patient?.display_name,
      diagnosis_label: patient?.diagnosis_label,
      note: patient?.note,
    })
    setEditOpen(true)
  }

  const submitEdit = async (v: { display_name: string; diagnosis_label?: string; note?: string }) => {
    setBusy(true)
    try {
      await apiFetch(`/api/patients/${id}`, { method: 'PATCH', body: JSON.stringify(v) })
      message.success('患者信息已更新')
      setEditOpen(false)
      await reload()
    } catch (e) { message.error((e as Error).message) } finally { setBusy(false) }
  }

  const openBindAcct = () => setBindAcctOpen(true)

  const submitBindAcct = async (v: { account: string; initial_password?: string }) => {
    setBusy(true)
    try {
      const r = await apiFetch<{ temporary_password: string | null }>(`/api/patients/${id}/account`, {
        method: 'POST', body: JSON.stringify(v),
      })
      message.success(r.temporary_password
        ? `账号已创建，临时密码（一次性展示，请立即转告）：${r.temporary_password}`
        : '账号绑定成功')
      setBindAcctOpen(false)
      bindAcctForm.resetFields()
      await reload()
    } catch (e) { message.error((e as Error).message) } finally { setBusy(false) }
  }

  const openBindDev = async () => {
    try {
      const ms = await apiFetch<{ items: { id: string; model_name: string }[] }>('/api/device-models?page_size=100')
      setDeviceOptions(ms.items.map((m) => ({ value: m.id, label: m.model_name })))
      setBindDevOpen(true)
    } catch (e) { message.error((e as Error).message) }
  }

  const submitBindDev = async (v: { device_model_id: string; effective_from: string }) => {
    setBusy(true)
    try {
      await apiFetch(`/api/patients/${id}/devices`, {
        method: 'POST',
        body: JSON.stringify({ device_model_id: v.device_model_id, effective_from: `${v.effective_from}T00:00:00+08:00` }),
      })
      message.success('装置已绑定（旧装置生效期自动关闭）')
      setBindDevOpen(false)
      bindDevForm.resetFields()
      await reload()
    } catch (e) { message.error((e as Error).message) } finally { setBusy(false) }
  }

  const submitRevision = async (v: { starts_at: string; drug_label?: string; times_text?: string }) => {
    if (!revOpen) return
    setBusy(true)
    try {
      const daily = (v.times_text || '')
        .split('\n').map((s) => s.trim()).filter(Boolean)
        .map((t) => ({ local_time: t }))
      await apiFetch(`/api/medication-plans/${revOpen.id}/revisions`, {
        method: 'POST',
        body: JSON.stringify({
          starts_at: `${v.starts_at}T00:00:00+08:00`,
          drug_label: v.drug_label || undefined,
          daily_times: revOpen.plan_type === 'REGULAR' ? daily : undefined,
        }),
      })
      message.success('计划已修订（旧版本生效期自动关闭）')
      setRevOpen(null)
      revForm.resetFields()
      await reload()
    } catch (e) { message.error((e as Error).message) } finally { setBusy(false) }
  }

  const submitRevoke = async () => {
    if (!revokeTarget) return
    if (!revokeReason.trim()) { message.warning('请填写撤销原因'); return }
    setBusy(true)
    try {
      await apiFetch(`/api/medication-events/${revokeTarget.id}/revoke`, {
        method: 'POST', body: JSON.stringify({ reason: revokeReason.trim() }),
      })
      message.success('已撤销：该记录不再计入统计，原记录保留留痕')
      setRevokeTarget(null)
      setRevokeReason('')
      await reload()
    } catch (e) { message.error((e as Error).message) } finally { setBusy(false) }
  }

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>
  }
  if (!patient) {
    return <Empty description="患者不存在或无权访问" style={{ marginTop: 64 }} />
  }

  const blank = (text: string) => <p className="card-empty" style={{ padding: 0 }}>{text}</p>
  // 列表只取前 50 条：标签显示服务端总数，超出时在列表上方给出说明，避免误以为「就这么多」
  const LIST_LIMIT = 50
  const truncated = (kind: 'events' | 'trainings' | 'followups') => totals[kind] > LIST_LIMIT
  const truncatedHint = `仅显示最近 ${LIST_LIMIT} 条（更早的记录仍保留在库中，标签数字为总条数）。`
  // 空状态给下一步：说明数据从哪来（UI/UX 规范：空状态不应是死胡同）
  const blankHint = (text: string, action?: React.ReactNode) => (
    <div className="card-empty" style={{ padding: 0 }}>
      <p style={{ margin: '0 0 8px' }}>{text}</p>
      {action}
    </div>
  )

  return (
    <div>
      <Button type="link" style={{ paddingLeft: 0, marginBottom: 8 }} onClick={() => navigate('/patients')}>← 返回患者列表</Button>
      <PageHeader title={`${patient.display_name} · ${patient.patient_code}`} />

      <Card
        title="基本信息"
        style={{ marginBottom: 24 }}
        extra={
          <Space size={8}>
            <Button size="small" onClick={openEdit}>编辑信息</Button>
            {patient.account_user_id
              ? null
              : <Button size="small" type="primary" onClick={openBindAcct}>绑定登录账号</Button>}
            <Button size="small" onClick={openBindDev}>绑定装置</Button>
          </Space>
        }
      >
        <dl className="info-grid">
          <div>
            <dt>患者编号</dt>
            <dd className="tabular">{patient.patient_code}</dd>
          </div>
          <div>
            <dt>姓名/别名</dt>
            <dd>{patient.display_name}</dd>
          </div>
          <div>
            <dt>诊断标签</dt>
            <dd>{patient.diagnosis_label || '—'}</dd>
          </div>
          <div>
            <dt>登录账号</dt>
            <dd>{patient.account_user_id ? <Tag className="tag-brand">已绑定</Tag> : <Tag>未绑定</Tag>}</dd>
          </div>
          <div className="span-2">
            <dt>备注</dt>
            <dd>{patient.note || '—'}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <Tabs
          items={[
            {
              key: 'timeline',
              label: `动态（${totals.events + totals.trainings + totals.followups + totals.plans}）`,
              children: timeline.length === 0 ? blank('暂无动态') : (
                <div className="timeline">
                  {(truncated('events') || truncated('trainings') || truncated('followups'))
                    ? <p className="muted" style={{ margin: '0 0 8px' }}>{truncatedHint}</p>
                    : null}
                  {timelineGroups.map((g) => (
                    <div key={g.day} className="tl-group">
                      <div className="tl-day">{g.day}</div>
                      <ul className="tl-list">
                        {g.items.map((it) => (
                          <li key={it.key} className="tl-item">
                            <span className={`tl-dot tone-${it.tone}`} aria-hidden />
                            <div className="tl-body">
                              <div className="tl-head">
                                <span className={`tl-kind kind-${it.kind}`}>{toneLabel[it.kind]}</span>
                                <span className="tl-title">{it.title}</span>
                                <span className="tl-time">{it.time}</span>
                              </div>
                              <div className="tl-detail">{it.detail}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              key: 'device',
              label: `装置（${devices.length}）`,
              children: devices.length === 0 ? blankHint('该患者暂无装置记录。', (
                <Button size="small" type="primary" onClick={openBindDev}>立即绑定装置</Button>
              )) : (
                <ul className="record-list">
                  {devices.map((dv) => (
                    <li key={dv.id} className="record-row">
                      <span className="strong">{modelNames[dv.device_model_id] || dv.device_model_id}</span>
                      <span className="record-meta">生效 {d(dv.effective_from)} ~ {dv.effective_to ? d(dv.effective_to) : '至今'}</span>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              key: 'plan',
              label: `用药计划（${plans.length}）`,
              children: plans.length === 0 ? blankHint('该患者暂无用药计划。', (
                <Button size="small" type="primary" onClick={() => navigate('/plans')}>去创建用药计划</Button>
              )) : (
                <ul className="record-list">
                  {plans.map((p) => (
                    <li key={p.id}>
                      <div className="record-row">
                        <span className="strong">v{p.version} · {p.drug_label}</span>
                        <Space size={6}>
                          <Tag color={p.plan_type === 'REGULAR' ? 'blue' : 'default'}>
                            {p.plan_type === 'REGULAR' ? '固定计划' : '按需计划'}
                          </Tag>
                          {p.ends_at === null && (
                            <Button size="small" onClick={() => {
                              revForm.setFieldsValue({
                                starts_at: dayjs().format('YYYY-MM-DD'),
                                drug_label: p.drug_label,
                                times_text: p.daily_times?.map((t) => String(t.local_time).slice(0, 5)).join('\n') || '',
                              })
                              setRevOpen(p)
                            }}>修订此计划</Button>
                          )}
                        </Space>
                      </div>
                      <div className="record-body">
                        <span className="record-meta">生效：{d(p.starts_at)} ~ {p.ends_at ? d(p.ends_at) : '至今'}</span>
                        {p.plan_type === 'REGULAR' && (
                          <span>
                            每日时点：
                            {p.daily_times?.length
                              ? p.daily_times.map((t, i) => <Tag key={i}>{String(t.local_time).slice(0, 5)}</Tag>)
                              : '—'}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              key: 'event',
              label: `用药登记（${totals.events}）`,
              children: events.length === 0 ? blank('暂无用药登记记录') : (
                <ul className="record-list">
                  {truncated('events') && <li><p className="muted" style={{ margin: 0 }}>{truncatedHint}</p></li>}
                  {events.map((e) => (
                    <li key={e.id} className="record-row">
                      <span className="strong tabular">{dt(e.occurred_at)}</span>
                      <Space size={6} wrap>
                        <Tag>{e.source === 'PATIENT_REPORT' ? '患者自述' : '医护观察'}</Tag>
                        {e.slot_id ? <Tag color="blue">固定时点</Tag> : <Tag>按需</Tag>}
                        {e.status === 'REVOKED'
                          ? <Tag color="red">已撤销</Tag>
                          : <Button size="small" onClick={() => { setRevokeTarget(e); setRevokeReason('') }}>撤销</Button>}
                      </Space>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              key: 'training',
              label: `训练记录（${totals.trainings}）`,
              children: trainings.length === 0 ? blankHint('暂无训练记录。患者完成操作自检或医护提交现场评估后，会显示在这里。') : (
                <ul className="record-list">
                  {truncated('trainings') && <li><p className="muted" style={{ margin: 0 }}>{truncatedHint}</p></li>}
                  {trainings.map((t) => (
                    <li key={t.id} className="record-row">
                      <span className="strong tabular">{dt(t.submit_at)}</span>
                      <Space size={6} wrap>
                        <Tag color={t.source === 'PATIENT_REPORT' ? 'default' : 'purple'}>
                          {t.source === 'PATIENT_REPORT' ? '患者自述' : '医护观察'}
                        </Tag>
                        <span>{t.result || '—'}</span>
                      </Space>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              key: 'followup',
              label: `随访（${totals.followups}）`,
              children: followups.length === 0 ? blankHint('暂无随访记录。', (
                <Button size="small" onClick={() => navigate('/followups')}>去记录随访</Button>
              )) : (
                <ul className="record-list">
                  {truncated('followups') && <li><p className="muted" style={{ margin: 0 }}>{truncatedHint}</p></li>}
                  {followups.map((f) => (
                    <li key={f.id}>
                      <div className="record-row">
                        <span className="strong tabular">{dt(f.followed_at)}</span>
                      </div>
                      <div className="record-body">
                        {f.feedback && <span>反馈：{f.feedback}</span>}
                        {f.action_taken && <span>措施：{f.action_taken}</span>}
                        {f.next_plan && <span>后续：{f.next_plan}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      </Card>

      {/* 编辑患者信息 */}
      <Modal title="编辑患者信息" open={editOpen} onCancel={() => setEditOpen(false)} onOk={() => editForm.submit()} confirmLoading={busy} destroyOnHidden>
        <Form form={editForm} layout="vertical" onFinish={submitEdit}>
          <Form.Item name="display_name" label="姓名/别名" rules={[{ required: true, message: '请输入姓名或别名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="diagnosis_label" label="诊断标签">
            <Input placeholder="已知档案标签，非系统诊断" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 绑定登录账号 */}
      <Modal title="绑定登录账号" open={bindAcctOpen} onCancel={() => setBindAcctOpen(false)} onOk={() => bindAcctForm.submit()} confirmLoading={busy} destroyOnHidden>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          账号已存在时将直接绑定（须为未绑定的患者账号）；新账号会生成一次性临时密码。
        </p>
        <Form form={bindAcctForm} layout="vertical" onFinish={submitBindAcct}>
          <Form.Item name="account" label="账号" rules={[{ required: true, min: 2, message: '请输入账号' }]}>
            <Input placeholder="如 patient_wang" />
          </Form.Item>
          <Form.Item name="initial_password" label="初始密码（留空则自动生成临时密码）">
            <Input.Password placeholder="留空自动生成" autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 绑定装置 */}
      <Modal title="绑定装置" open={bindDevOpen} onCancel={() => setBindDevOpen(false)} onOk={() => bindDevForm.submit()} confirmLoading={busy} destroyOnHidden>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          绑定新装置后，原装置生效期自动关闭；历史训练记录不改写。
        </p>
        <Form form={bindDevForm} layout="vertical" onFinish={submitBindDev}>
          <Form.Item name="device_model_id" label="装置型号" rules={[{ required: true, message: '请选择型号' }]}>
            <Select options={deviceOptions} placeholder="选择型号" />
          </Form.Item>
          <Form.Item name="effective_from" label="生效日期" rules={[{ required: true, message: '请选择生效日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 计划修订 */}
      <Modal title={`修订计划（v${revOpen?.version ?? ''}）`} open={revOpen !== null} onCancel={() => setRevOpen(null)} onOk={() => revForm.submit()} confirmLoading={busy} destroyOnHidden>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          修订会创建新版本：旧版本生效期自动关闭到新版本开始日，历史统计不改写。
        </p>
        <Form form={revForm} layout="vertical" onFinish={submitRevision}>
          <Form.Item name="starts_at" label="新版本生效日期" rules={[{ required: true, message: '请选择生效日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="drug_label" label="药物名称（可选，留空沿用）">
            <Input />
          </Form.Item>
          {revOpen?.plan_type === 'REGULAR' && (
            <Form.Item name="times_text" label="每日时点（每行一个，如 08:00）" rules={[{ required: true, message: '请至少填写一个时点' }]}>
              <Input.TextArea rows={3} placeholder={'08:00\n20:00'} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 撤销登记（医护侧，破坏性操作需原因） */}
      <Modal title="撤销此用药登记？" open={revokeTarget !== null} onCancel={() => { setRevokeTarget(null); setRevokeReason('') }} onOk={submitRevoke} confirmLoading={busy} okText="确认撤销" okButtonProps={{ danger: true }} destroyOnHidden>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          撤销后该记录不再计入统计，原记录与撤销留痕保留、不可删除。
        </p>
        <Input.TextArea
          value={revokeReason}
          onChange={(e) => setRevokeReason(e.target.value)}
          rows={2}
          placeholder="撤销原因（必填），如：患者反馈当时未实际使用"
        />
      </Modal>
    </div>
  )
}
