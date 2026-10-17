import { useEffect, useState } from 'react'
import { apiFetch } from '../../api/client'
import AppLayout from '../../components/AppLayout'

interface Slot { id: string; scheduled_at: string; has_active_record: boolean }
interface Event {
  id: string; slot_id: string | null; source: string; occurred_at: string
  status: string; note: string | null
}
interface Plan { id: string; plan_type: string; drug_label: string; daily_times: { local_time: string }[] }

// P04 用药记录（J030，底部导航根页面之一）
// 支持登记与撤销（MED-03：撤销需确认并给出结果；后端保留原记录、不硬删）
export default function MedicationPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState<string | null>(null)
  const [info, setInfo] = useState('')

  // 撤销确认弹层状态
  const [revoking, setRevoking] = useState<Event | null>(null)
  const [reason, setReason] = useState('')
  const [submittingRevoke, setSubmittingRevoke] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const s = await apiFetch<{ items: Slot[] }>(`/api/me/daily-slots?date=${today}`)
      setSlots(s.items)
      const e = await apiFetch<{ items: Event[] }>('/api/me/medication-events?page_size=50')
      setEvents(e.items)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const record = async (slot: Slot) => {
    setRecording(slot.id)
    setError('')
    setInfo('')
    try {
      const plans = await apiFetch<{ items: Plan[] }>('/api/me/medication-plans')
      const regular = plans.items.find(p => p.plan_type === 'REGULAR')
      if (!regular) { setError('暂无固定计划'); return }
      const res = await apiFetch<{ event: Event; is_duplicate: boolean }>('/api/medication-events', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: regular.id,
          slot_id: slot.id,
          occurred_at: new Date().toISOString(),
        }),
      })
      setInfo(res.is_duplicate
        ? '该时点已有登记，本次记录已保留（同一时点的覆盖统计只计一次）'
        : '登记成功')
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRecording(null)
    }
  }

  const submitRevoke = async () => {
    if (!revoking) return
    if (!reason.trim()) { setError('请填写撤销原因'); return }
    setSubmittingRevoke(true)
    setError('')
    try {
      await apiFetch(`/api/medication-events/${revoking.id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      })
      setRevoking(null)
      setReason('')
      setInfo('已撤销：该记录不再计入统计，原记录保留留痕')
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmittingRevoke(false)
    }
  }

  const timeStr = (iso: string) => new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dateStr = (iso: string) => new Date(iso).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <AppLayout title="用药记录">
      {loading && <p style={{ color: 'var(--muted)', marginTop: 24 }}>加载中…</p>}
      {error && <p style={{ color: '#B02A2A', marginTop: 24 }}>{error}</p>}
      {info && !error && (
        <p style={{ marginTop: 12, padding: '10px 14px', background: 'var(--progress-soft)', color: 'var(--progress-ink)', borderRadius: 10, fontSize: 14 }}>{info}</p>
      )}

      {!loading && (
        <>
          {/* 今日固定时点 */}
          <div style={{ marginTop: 16, fontSize: 15, color: 'var(--ink-2)', fontWeight: 500 }}>今日固定时点</div>
          {slots.length === 0 && <p style={{ color: 'var(--muted)', marginTop: 8 }}>暂无固定计划</p>}
          {slots.map((s) => (
            <div key={s.id} style={{ marginTop: 12, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 20, color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{timeStr(s.scheduled_at)}</div>
                <div style={{ fontSize: 13, color: s.has_active_record ? 'var(--progress-ink)' : 'var(--muted)', marginTop: 4 }}>
                  {s.has_active_record ? '已登记' : '未发现登记'}
                </div>
              </div>
              {!s.has_active_record && (
                <button onClick={() => record(s)} disabled={recording === s.id}
                  style={{ height: 40, padding: '0 16px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: recording === s.id ? 'not-allowed' : 'pointer', opacity: recording === s.id ? 0.6 : 1 }}>
                  {recording === s.id ? '登记中…' : '登记'}
                </button>
              )}
            </div>
          ))}

          {/* 按需登记说明 */}
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
            按需用药可在有需要时随时登记，不计入固定计划的覆盖率。
          </div>

          {/* 历史记录 */}
          <div style={{ marginTop: 24, fontSize: 15, color: 'var(--ink-2)', fontWeight: 500 }}>历史记录</div>
          {events.length === 0 && <p style={{ color: 'var(--muted)', marginTop: 8 }}>暂无记录</p>}
          {events.map((e) => {
            const revoked = e.status === 'REVOKED'
            return (
              <div key={e.id} style={{ marginTop: 12, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, opacity: revoked ? 0.75 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{dateStr(e.occurred_at)}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'var(--line-soft)', color: 'var(--ink-2)' }}>
                      {e.source === 'PATIENT_REPORT' ? '自述' : '医护观察'}
                    </span>
                    {e.slot_id ? <span style={{ fontSize: 12, color: 'var(--brand-ink)' }}>固定时点</span> : <span style={{ fontSize: 12, color: 'var(--muted)' }}>按需</span>}
                    <span style={{ fontSize: 13, color: revoked ? '#B02A2A' : 'var(--progress-ink)' }}>
                      {revoked ? '已撤销' : '有效'}
                    </span>
                  </span>
                </div>
                {e.note && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{e.note}</div>}
                {!revoked && (
                  <button
                    onClick={() => { setRevoking(e); setReason(''); setError('') }}
                    style={{ marginTop: 10, background: 'none', border: '1px solid var(--line)', color: 'var(--ink-2)', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
                  >
                    撤销此记录
                  </button>
                )}
              </div>
            )
          })}

          {/* 撤销确认弹层（页面内卡片，非系统弹窗） */}
          {revoking && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,13,39,0.45)', zIndex: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 520, background: 'var(--surface)', borderRadius: '16px 16px 0 0', padding: '20px 16px calc(var(--safe-bottom) + 20px)' }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>撤销此登记？</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
                  撤销后该记录不再计入统计，但会保留原记录与撤销留痕，无法删除。
                </p>
                <div style={{ marginTop: 14, fontSize: 14, color: 'var(--ink-2)' }}>撤销原因（必填）</div>
                <textarea
                  value={reason}
                  onChange={(ev) => setReason(ev.target.value)}
                  rows={2}
                  placeholder="如：误登记 / 时间选错了"
                  style={{ width: '100%', marginTop: 6, padding: 12, boxSizing: 'border-box', borderRadius: 10, border: '1px solid var(--line)', fontSize: 15, resize: 'none' }}
                />
                {error && <p style={{ color: '#B02A2A', fontSize: 13, marginTop: 8 }}>{error}</p>}
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button onClick={() => { setRevoking(null); setReason(''); setError('') }}
                    style={{ flex: 1, height: 48, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 15, cursor: 'pointer' }}>
                    取消
                  </button>
                  <button onClick={submitRevoke} disabled={submittingRevoke}
                    style={{ flex: 1.4, height: 48, background: '#B02A2A', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, cursor: submittingRevoke ? 'not-allowed' : 'pointer', opacity: submittingRevoke ? 0.6 : 1 }}>
                    {submittingRevoke ? '撤销中…' : '确认撤销'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  )
}
