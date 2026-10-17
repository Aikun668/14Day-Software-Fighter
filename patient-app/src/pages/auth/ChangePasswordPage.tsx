import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import { useAuth } from '../../features/auth/AuthContext'

// G01 首次改密页（J014）：改密后强制重新登录
export default function ChangePasswordPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async () => {
    if (newPassword !== confirm) {
      setError('两次输入的新密码不一致')
      return
    }
    setLoading(true)
    setError('')
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      })
      await logout()
      navigate('/login')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 48, padding: '0 12px', boxSizing: 'border-box',
    borderRadius: 8, border: '1px solid #E6E9F1', fontSize: 16,
  }

  return (
    <div style={{ padding: 32, maxWidth: 400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24 }}>首次登录需修改密码</h1>
      <div style={{ marginTop: 24 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>原密码</label>
        <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="原密码" style={inputStyle} />
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>新密码</label>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="至少 8 位" style={inputStyle} />
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>确认新密码</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="确认新密码" style={inputStyle} />
      </div>
      {error && <p style={{ color: '#B02A2A', fontSize: 14, marginTop: 12 }}>{error}</p>}
      <button onClick={onSubmit} disabled={loading} style={{ width: '100%', height: 52, marginTop: 24, background: '#573BF4', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? '提交中…' : '修改并重新登录'}
      </button>
    </div>
  )
}
