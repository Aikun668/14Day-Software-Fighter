import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input } from 'antd'
import { useAuth } from '../../features/auth/AuthContext'
import { DoctorIllustration, MedixBrand, MedixThemeBoundary } from '../../components/medix/Medix'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const pending = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const onFinish = async (values: { account: string; password: string }) => {
    if (pending.current) return
    pending.current = true
    setLoading(true)
    setError('')
    try {
      const user = await login(values.account, values.password)
      navigate(user.must_change_password ? '/change-password' : user.role === 'ADMIN' ? '/admin' : '/workbench')
    } catch (e) { setError((e as Error).message) }
    finally { pending.current = false; setLoading(false) }
  }
  return <MedixThemeBoundary><main className="ml-auth">
    <section className="ml-login-card" aria-labelledby="login-title">
      <MedixBrand />
      <p className="ml-product-name">吸入治疗指导与依从性辅助管理软件</p>
      <h1 id="login-title">医护端登录</h1>
      <Form onFinish={onFinish} layout="vertical" requiredMark={false}>
        <Form.Item name="account" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
          <Input placeholder="请输入账号" autoComplete="username" />
        </Form.Item>
        <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
          <Input.Password placeholder="请输入密码" autoComplete="current-password" />
        </Form.Item>
        {error && <p className="ml-login-error" role="alert">{error}</p>}
        <Button type="primary" htmlType="submit" aria-label="登录" block loading={loading}>登录</Button>
      </Form>
    </section>
    <DoctorIllustration />
  </main></MedixThemeBoundary>
}
