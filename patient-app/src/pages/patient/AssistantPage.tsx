import { useEffect, useState } from 'react'
import { apiFetch } from '../../api/client'
import AppLayout from '../../components/AppLayout'

interface Device { id: string; device_model_id: string }
interface PatientInfo { id: string; current_devices: Device[] }
interface Citation { document_title: string; version: string; step_ref: string }
interface AskResult { status: string; answer: string; citations: Citation[] }

// 与后端 rag/service.py 的 _NO_LLM_LABEL 保持一致：以此区分抽取式回答与外部模型回答
const NO_LLM_LABEL = '未启用大模型，基于已审核片段的抽取式回答'

// P05 AI 指导助手（J042，二级页）
export default function AssistantPage() {
  const [deviceModelId, setDeviceModelId] = useState('')
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<AskResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [noDevice, setNoDevice] = useState(false)

  useEffect(() => {
    apiFetch<PatientInfo>('/api/me/patient')
      .then((me) => {
        if (me.current_devices && me.current_devices.length > 0) {
          setDeviceModelId(me.current_devices[0].device_model_id)
        } else {
          setNoDevice(true)
        }
      })
      .catch((e) => setError((e as Error).message))
  }, [])

  const ask = async () => {
    if (!question.trim()) { setError('请输入问题'); return }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const r = await apiFetch<AskResult>('/api/ai/ask', {
        method: 'POST',
        body: JSON.stringify({ device_model_id: deviceModelId, question: question.trim() }),
      })
      setResult(r)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout title="AI 指导助手" showBack showTabBar={false}>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
        仅基于本人当前型号的已审核资料回答装置操作问题，不提供诊疗建议。
      </p>

      {noDevice && <p style={{ color: '#B02A2A', marginTop: 16 }}>暂无绑定装置，无法使用助手</p>}

      {!noDevice && (
        <>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例如：这个型号使用前需要做哪些准备？（请勿输入姓名、电话等身份信息）"
            rows={3}
            style={{ width: '100%', marginTop: 16, padding: 12, boxSizing: 'border-box', borderRadius: 14, border: '1px solid #E6E9F1', fontSize: 16, resize: 'none' }}
          />
          <button onClick={ask} disabled={loading}
            style={{ width: '100%', height: 52, marginTop: 12, background: '#573BF4', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? '查询中…' : '提问'}
          </button>
        </>
      )}

      {error && <p style={{ color: '#B02A2A', marginTop: 16 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 20, background: '#fff', border: '1px solid #E6E9F1', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, color: result.status === 'ANSWERED' ? '#14938E' : '#6B6E7F', fontWeight: 500 }}>
            {result.status === 'ANSWERED' ? '已回答（基于已审核资料）'
              : result.status === 'NO_EVIDENCE' ? '资料不足'
              : result.status === 'OUT_OF_SCOPE' ? '超出范围'
              : '服务不可用'}
          </div>
          <div style={{ fontSize: 16, color: '#0F0D27', marginTop: 10, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {result.answer}
          </div>
          {result.status === 'ANSWERED' && !result.answer.startsWith(NO_LLM_LABEL) && (
            <p style={{ fontSize: 13, color: '#6B6E7F', marginTop: 12 }}>
              回答由外部模型生成，内容仅供参考，以医护说明为准。
            </p>
          )}
          {result.citations.length > 0 && (
            <div style={{ marginTop: 14, borderTop: '1px solid #F0F2F7', paddingTop: 12 }}>
              <div style={{ fontSize: 13, color: '#6B6E7F', marginBottom: 6 }}>资料出处：</div>
              {result.citations.map((c, i) => (
                <div key={i} style={{ fontSize: 13, color: '#4D3BA7' }}>
                  · {c.document_title}（版本 {c.version}，{c.step_ref}）
                </div>
              ))}
            </div>
          )}
          {result.status !== 'ANSWERED' && (
            <p style={{ fontSize: 13, color: '#6B6E7F', marginTop: 12 }}>
              建议联系您的医护人员获取进一步帮助。
            </p>
          )}
        </div>
      )}

      <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 24, textAlign: 'center' }}>
        本软件辅助学习与记录，不能替代专业诊疗。
      </p>
    </AppLayout>
  )
}
