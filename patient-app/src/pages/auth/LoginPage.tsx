import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'

// G01 患者 App 登录页（J014）
export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async () => {
    if (!account || !password) {
      setError('请输入账号和密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = await login(account, password)
      if (user.must_change_password) {
        navigate('/change-password')
      } else {
        navigate('/today')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24 }}>吸入治疗管理系统</h1>
      <p style={{ color: '#6B6E7F' }}>患者登录</p>

      <div style={{ marginTop: 24 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>账号</label>
        <input
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="请输入账号"
          style={{ width: '100%', height: 48, padding: '0 12px', boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E6E9F1', fontSize: 16 }}
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="请输入密码"
          style={{ width: '100%', height: 48, padding: '0 12px', boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E6E9F1', fontSize: 16 }}
        />
      </div>

      {error && <p style={{ color: '#B02A2A', fontSize: 14, marginTop: 12 }}>{error}</p>}

      <button
        onClick={onSubmit}
        disabled={loading}
        style={{ width: '100%', height: 52, marginTop: 24, background: '#573BF4', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
      >
        {loading ? '登录中…' : '登录'}
      </button>

      <p style={{ color: '#6B6E7F', fontSize: 12, marginTop: 24, textAlign: 'center' }}>
        本软件辅助学习与记录，不能替代专业诊疗。
      </p>
    </div>
  )
}
