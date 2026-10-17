import { useEffect, useState } from 'react'
import { apiFetch } from '../../api/client'
import AppLayout from '../../components/AppLayout'

interface GuideStep { id: string; step_no: number; text: string; error_notes: string | null }
interface Guide { id: string; title: string; steps: GuideStep[] }
interface Device { id: string; device_model_id: string }
interface PatientInfo { id: string; current_devices: Device[] }
interface HistoryItem {
  id: string; source: string; submit_at: string; result: string | null
  step_results: { step_id: string; check_state: string }[]
}

// P03 操作自检（J023，二级页）
export default function TrainingPage() {
  const [guide, setGuide] = useState<Guide | null>(null)
  const [deviceModelId, setDeviceModelId] = useState('')
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const me = await apiFetch<PatientInfo>('/api/me/patient')
        const devices = me.current_devices
        if (!devices || devices.length === 0) {
          setError('暂无绑定装置')
          setLoading(false)
          return
        }
        const g = await apiFetch<Guide>(`/api/device-models/${devices[0].device_model_id}/guide`)
        setGuide(g)
        setDeviceModelId(devices[0].device_model_id)
        // 加载历史
        const h = await apiFetch<{ items: HistoryItem[] }>('/api/me/training-sessions?page_size=20')
        setHistory(h.items)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const setChoice = (stepId: string, state: string) => {
    setChoices((prev) => ({ ...prev, [stepId]: state }))
  }

  const submit = async () => {
    if (!guide) return
    const stepResults = guide.steps.map((s) => ({ step_id: s.id, check_state: choices[s.id] || 'NOT_DONE' }))
    setSubmitting(true)
    setError('')
    try {
      await apiFetch('/api/training-sessions', {
        method: 'POST',
        body: JSON.stringify({ device_model_id: deviceModelId, guide_id: guide.id, step_results: stepResults }),
      })
      setChoices({})
      const h = await apiFetch<{ items: HistoryItem[] }>('/api/me/training-sessions?page_size=20')
      setHistory(h.items)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const stateLabel = (s: string) => s === 'DONE' ? '完成' : s === 'DIFFICULT' ? '有困难' : '未完成'

  return (
    <AppLayout title="操作自检" showBack showTabBar={false}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <div style={{ fontSize: 15, color: 'var(--muted)' }}>逐步自检</div>
        <button onClick={() => setShowHistory(!showHistory)} style={{ background: 'none', border: 'none', color: 'var(--brand-ink)', fontSize: 14, cursor: 'pointer' }}>
          {showHistory ? '返回自检' : '历史记录'}
        </button>
      </div>

      {loading && <p style={{ color: '#6B6E7F', marginTop: 24 }}>加载中…</p>}
      {error && <p style={{ color: '#B02A2A', marginTop: 24 }}>{error}</p>}

      {!showHistory && guide && !loading && (
        <>
          <p style={{ color: '#6B6E7F', fontSize: 13, marginTop: 8 }}>请逐条勾选你的自述情况（不代表设备检测通过）</p>
          {guide.steps.map((s) => (
            <div key={s.id} style={{ marginTop: 12, background: '#fff', border: '1px solid #E6E9F1', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 14, color: '#4D3BA7', fontWeight: 600 }}>步骤 {s.step_no}</div>
              <div style={{ fontSize: 16, color: '#0F0D27', marginTop: 8 }}>{s.text}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {['DONE', 'DIFFICULT', 'NOT_DONE'].map((st) => (
                  <button key={st} onClick={() => setChoice(s.id, st)}
                    style={{
                      flex: 1, height: 40, borderRadius: 8, fontSize: 13, cursor: 'pointer',
                      background: choices[s.id] === st ? '#573BF4' : '#fff',
                      color: choices[s.id] === st ? '#fff' : '#3D3D56',
                      border: choices[s.id] === st ? '1px solid #573BF4' : '1px solid #E6E9F1',
                    }}>
                    {stateLabel(st)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={submit} disabled={submitting}
            style={{ width: '100%', height: 52, marginTop: 24, background: '#573BF4', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? '提交中…' : '提交自检（患者自述）'}
          </button>
        </>
      )}

      {showHistory && (
        <>
          <p style={{ color: '#6B6E7F', fontSize: 13, marginTop: 8 }}>本人历史自检记录</p>
          {history.length === 0 && <p style={{ color: '#6B6E7F', marginTop: 16 }}>暂无记录</p>}
          {history.map((h) => (
            <div key={h.id} style={{ marginTop: 12, background: '#fff', border: '1px solid #E6E9F1', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 14, color: '#0F0D27', fontWeight: 500 }}>
                {h.source === 'PATIENT_REPORT' ? '患者自述' : '医护观察'}
              </div>
              <div style={{ fontSize: 13, color: '#6B6E7F', marginTop: 4 }}>
                {new Date(h.submit_at).toLocaleString('zh-CN')}
              </div>
              <div style={{ fontSize: 13, color: '#3D3D56', marginTop: 8 }}>
                {h.step_results.map(sr => `${stateLabel(sr.check_state)}`).join(' · ')}
              </div>
            </div>
          ))}
        </>
      )}
    </AppLayout>
  )
}
