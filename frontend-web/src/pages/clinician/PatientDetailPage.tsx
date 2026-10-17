import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Empty, Space, Spin, Tabs, Tag, message } from 'antd'
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
          apiFetch<{ items: Event[] }>(`/api/patients/${id}/medication-events?page_size=50`).catch(() => ({ items: [] })),
          apiFetch<{ items: Training[] }>(`/api/patients/${id}/training-sessions?page_size=50`).catch(() => ({ items: [] })),
          apiFetch<{ items: Followup[] }>(`/api/patients/${id}/followups?page_size=50`).catch(() => ({ items: [] })),
          apiFetch<{ items: { id: string; model_name: string }[] }>('/api/device-models?page_size=100').catch(() => ({ items: [] })),
        ])
        setPatient(p)
        setDevices(d.items)
        setPlans(pl.items)
        setEvents(ev.items)
        setTrainings(tr.items)
        setFollowups(fu.items)
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

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>
  }
  if (!patient) {
    return <Empty description="患者不存在或无权访问" style={{ marginTop: 64 }} />
  }

  const blank = (text: string) => <p className="card-empty" style={{ padding: 0 }}>{text}</p>

  return (
    <div>
      <Button type="link" style={{ paddingLeft: 0, marginBottom: 8 }} onClick={() => navigate('/patients')}>← 返回患者列表</Button>
      <PageHeader title={`${patient.display_name} · ${patient.patient_code}`} />

      <Card title="基本信息" style={{ marginBottom: 24 }}>
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
              label: `动态（${timeline.length}）`,
              children: timeline.length === 0 ? blank('暂无动态') : (
                <div className="timeline">
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
              children: devices.length === 0 ? blank('该患者暂无装置记录') : (
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
              children: plans.length === 0 ? blank('该患者暂无用药计划') : (
                <ul className="record-list">
                  {plans.map((p) => (
                    <li key={p.id}>
                      <div className="record-row">
                        <span className="strong">v{p.version} · {p.drug_label}</span>
                        <Tag color={p.plan_type === 'REGULAR' ? 'blue' : 'default'}>
                          {p.plan_type === 'REGULAR' ? '固定计划' : '按需计划'}
                        </Tag>
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
              label: `用药登记（${events.length}）`,
              children: events.length === 0 ? blank('暂无用药登记记录') : (
                <ul className="record-list">
                  {events.map((e) => (
                    <li key={e.id} className="record-row">
                      <span className="strong tabular">{dt(e.occurred_at)}</span>
                      <Space size={6} wrap>
                        <Tag>{e.source === 'PATIENT_REPORT' ? '患者自述' : '医护观察'}</Tag>
                        {e.slot_id ? <Tag color="blue">固定时点</Tag> : <Tag>按需</Tag>}
                        {e.status === 'REVOKED' && <Tag color="red">已撤销</Tag>}
                      </Space>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              key: 'training',
              label: `训练记录（${trainings.length}）`,
              children: trainings.length === 0 ? blank('暂无训练记录') : (
                <ul className="record-list">
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
              label: `随访（${followups.length}）`,
              children: followups.length === 0 ? blank('暂无随访记录') : (
                <ul className="record-list">
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
    </div>
  )
}
