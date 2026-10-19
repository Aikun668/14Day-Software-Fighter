import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import AppLayout from '../../components/AppLayout'
import GuideStepImage from '../../components/GuideStepImage'
import { IconAlert } from '../../components/icons'

interface Device { id: string; device_model_id: string }
interface PatientInfo { id: string; current_devices: Device[] }
interface GuideStep { id: string; step_no: number; text: string; error_notes: string | null; image_path: string | null }
interface Guide { id: string; version: string; title: string; steps: GuideStep[]; source_title: string | null }

// P02 型号指导（J021，底部导航根页面之一）
export default function GuidePage() {
  const navigate = useNavigate()
  const [guide, setGuide] = useState<Guide | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const me = await apiFetch<PatientInfo>('/api/me/patient')
        const devices = me.current_devices
        if (!devices || devices.length === 0) {
          setError('暂无绑定装置，请联系医护人员')
          setLoading(false)
          return
        }
        const deviceModelId = devices[0].device_model_id
        const g = await apiFetch<Guide>(`/api/device-models/${deviceModelId}/guide`)
        setGuide(g)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <AppLayout title="型号指导">
      {loading && <p style={{ color: 'var(--muted)', marginTop: 24 }}>加载中…</p>}
      {error && (
        <div style={{ marginTop: 24, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
          <p style={{ color: '#B02A2A' }}>{error}</p>
          <button onClick={() => window.location.reload()} style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: 15, marginTop: 8 }}>重试</button>
        </div>
      )}

      {guide && !loading && !error && (
        <>
          <div style={{ marginTop: 8, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>{guide.title}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>版本 {guide.version}</div>
          </div>

          {guide.steps.map((s) => (
            <div key={s.id} style={{ marginTop: 12, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 14, color: 'var(--brand-ink)', fontWeight: 600 }}>步骤 {s.step_no}</div>
              <div style={{ fontSize: 16, color: 'var(--ink)', marginTop: 8 }}>{s.text}</div>
              <GuideStepImage src={s.image_path} stepNo={s.step_no} />
              {s.error_notes && (
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ display: 'inline-flex', flexShrink: 0, marginTop: 1 }}>
                    <IconAlert size={15} color="var(--muted)" />
                  </span>
                  <span>{s.error_notes}</span>
                </div>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button onClick={() => navigate('/training')} style={{ flex: 1, height: 52, background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>
              开始自检
            </button>
            <button onClick={() => navigate('/assistant')} style={{ flex: 1, height: 52, background: 'var(--surface)', color: 'var(--brand)', border: '1px solid var(--brand)', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>
              AI 助手
            </button>
          </div>
        </>
      )}
    </AppLayout>
  )
}
