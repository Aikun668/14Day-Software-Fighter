import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import AppLayout from '../../components/AppLayout'
import {
  IconBell,
  IconBook,
  IconChat,
  IconCheck,
  IconChevronRight,
  IconClipboard,
  IconRetrain,
} from '../../components/icons'

interface PatientInfo {
  id: string
  patient_code: string
  display_name: string
  diagnosis_label: string | null
  current_devices: { id: string; device_model_id: string }[]
}

interface Slot {
  id: string
  plan_id: string
  scheduled_at: string
  state: string
  has_active_record: boolean
}

interface Reminder {
  id: string
  kind: string
  title: string
  status: string
  due_at: string | null
}

// P01 今日首页（J017）：按 UI_DESIGN §6 实现
// 顶部身份行 → 页标题 → 下一步卡 → 今日固定时点卡 → 学习与帮助 → 页脚
export default function TodayPage() {
  const navigate = useNavigate()
  const [info, setInfo] = useState<PatientInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<{ N: number; M: number; coverage_rate: number | null } | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [slots, setSlots] = useState<Slot[]>([])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    apiFetch<PatientInfo>('/api/me/patient')
      .then((d) => { setInfo(d); setLoading(false) })
      .catch((e) => { setError((e as Error).message); setLoading(false) })

    // 今日固定时点（P01 核心数据）
    apiFetch<{ items: Slot[] }>(`/api/me/daily-slots?date=${today}`)
      .then((r) => setSlots(r.items))
      .catch(() => {})

    // 过去 7 个完整日（不含今日）：与计划区间一致，只统计已到期时点
    const now = new Date()
    const from = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
    const to = now.toISOString().slice(0, 10)
    apiFetch<{ N: number; M: number; coverage_rate: number | null }>(`/api/me/stats?from=${from}&to=${to}`)
      .then(setStats)
      .catch(() => {})

    apiFetch<{ items: Reminder[] }>('/api/me/reminders')
      .then((r) => setReminders(r.items))
      .catch(() => {})
  }, [])

  const hhmm = (iso: string) =>
    new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

  const now = new Date()
  const doneCount = slots.filter((s) => s.has_active_record).length
  const totalCount = slots.length

  // 找「下一个待处理时点」：未登记且已到时间优先，否则最早未登记
  const pendingSlots = slots.filter((s) => !s.has_active_record)
  const dueNow = pendingSlots.find((s) => new Date(s.scheduled_at) <= now)
  const nextSlot = dueNow || pendingSlots[0] || null
  const isDue = nextSlot ? new Date(nextSlot.scheduled_at) <= now : false

  // 环形进度（88px，UI_DESIGN §6）
  const ringSize = 88
  const stroke = 8
  const radius = (ringSize - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = totalCount > 0 ? doneCount / totalCount : 0

  return (
    <AppLayout
      title="今日"
      headerExtra={
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {info ? `${info.display_name} · ${info.patient_code}` : ''}
        </span>
      }
    >
      {/* 装置与诊断行 */}
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        {info?.current_devices?.length ? '已绑定装置' : '暂无装置'}
        {info?.diagnosis_label ? ` · ${info.diagnosis_label}` : ''}
      </div>

      {loading && <p style={{ color: 'var(--muted)' }}>加载中…</p>}
      {error && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
          <p style={{ color: '#B02A2A' }}>{error}</p>
          <button onClick={() => window.location.reload()} style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: 15, marginTop: 8 }}>重试</button>
        </div>
      )}

      {info && !loading && !error && (
        <>
          {/* 学习与帮助（无计划时可先学习） */}
          {totalCount === 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 500 }}>今日暂无固定计划</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                可以先学习型号指导，或完成一次操作自检。
              </div>
            </div>
          )}

          {/* 下一步卡（UI_DESIGN §6） */}
          {totalCount > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 500 }}>
                  {nextSlot
                    ? `下一步 · ${hhmm(nextSlot.scheduled_at)} 时点`
                    : '今日时点已全部登记'}
                </div>
                <div style={{ fontSize: 18, color: 'var(--ink)', fontWeight: 600, marginTop: 6 }}>
                  {nextSlot
                    ? (isDue ? `登记 ${hhmm(nextSlot.scheduled_at)} 用药` : `${hhmm(nextSlot.scheduled_at)} 时点未到`)
                    : '今日暂无待办'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {nextSlot && !isDue ? '到时间后即可登记' : ''}
                </div>
              </div>

              {/* 环形进度：已登记 n / 总数 */}
              <div style={{ position: 'relative', width: ringSize, height: ringSize, flexShrink: 0 }}>
                <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke="var(--brand-soft)" strokeWidth={stroke} />
                  <circle
                    cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none"
                    stroke="var(--brand)" strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - ratio)}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{doneCount} / {totalCount}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>已登记</span>
                </div>
              </div>
            </div>
          )}

          {/* 下一步卡的主按钮（仅未登记且已到时点显示） */}
          {nextSlot && isDue && (
            <button
              onClick={() => navigate('/medication')}
              style={{ width: '100%', height: 52, marginTop: 12, background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, cursor: 'pointer' }}
            >
              登记实际情况
            </button>
          )}

          {/* 今日固定时点卡（UI_DESIGN §6） */}
          {slots.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 8 }}>今日固定时点</div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
                {slots.map((s, idx) => {
                  const passed = new Date(s.scheduled_at) <= now
                  const recorded = s.has_active_record
                  const label = recorded ? '已登记' : passed ? '未发现登记' : '未到时点'
                  const clickable = recorded || passed
                  return (
                    <div
                      key={s.id}
                      onClick={() => { if (clickable) navigate('/medication') }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', cursor: clickable ? 'pointer' : 'default',
                        borderTop: idx > 0 ? '1px solid var(--line-soft)' : 'none',
                        background: clickable ? 'transparent' : 'var(--missed-soft)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                        <span style={{ fontSize: 20, fontWeight: 600, color: clickable ? 'var(--ink)' : 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
                          {hhmm(s.scheduled_at)}
                        </span>
                        <span style={{
                          fontSize: 12, padding: '2px 10px', borderRadius: 999,
                          background: recorded ? 'var(--brand-soft)' : '#FFFFFF',
                          color: recorded ? 'var(--brand-ink)' : (passed ? 'var(--missed)' : 'var(--ink-2)'),
                          border: '1px solid ' + (recorded ? 'var(--brand-soft)' : (passed ? 'var(--missed-line)' : 'var(--line)')),
                        }}>
                          {label}
                        </span>
                      </div>
                      {clickable && <IconChevronRight size={18} color="var(--muted)" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 概览统计 */}
          {stats && stats.N > 0 && (
            <div style={{ marginTop: 16, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 500 }}>近 7 天记录覆盖率</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                    已登记 {stats.M} / 应记录 {stats.N}
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--brand)' }}>
                  {stats.coverage_rate === null ? '—' : `${stats.coverage_rate}%`}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                基于登记记录，不等于实际服药依从性
              </div>
            </div>
          )}

          {/* 站内提醒 */}
          {reminders.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 8 }}>待办提醒</div>
              {reminders.map((r) => {
                const RIcon = r.kind === 'MEDICATION_DUE' ? IconBell : r.kind === 'RETRAIN' ? IconRetrain : IconClipboard
                return (
                  <div key={r.id} style={{ marginTop: 8, background: 'var(--brand-tint)', border: '1px solid var(--brand-soft)', borderRadius: 14, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, color: 'var(--ink)', minWidth: 0 }}>
                      <RIcon size={18} color="var(--brand-ink)" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--brand)', flexShrink: 0 }}>{r.status === 'PENDING' ? '待完成' : '已完成'}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* 学习与帮助入口 */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 8 }}>学习与帮助</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: '型号指导', path: '/guide', icon: IconBook },
                { label: '操作自检', path: '/training', icon: IconCheck },
                { label: 'AI 助手', path: '/assistant', icon: IconChat },
              ].map((it) => {
                const EntryIcon = it.icon
                return (
                  <button key={it.path} onClick={() => navigate(it.path)}
                    style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 8px', cursor: 'pointer', textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', color: 'var(--brand)' }}>
                      <EntryIcon size={26} />
                    </span>
                    <div style={{ fontSize: 14, color: 'var(--ink)', marginTop: 6 }}>{it.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 页脚免责 */}
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 28, textAlign: 'center' }}>
            本软件辅助学习与记录，不能替代专业诊疗。
          </p>
        </>
      )}
    </AppLayout>
  )
}
