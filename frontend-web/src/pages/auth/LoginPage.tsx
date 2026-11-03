import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Form, Input, message } from 'antd'
import { useAuth } from '../../features/auth/AuthContext'

// G01 医护 Web 登录页（J013）
export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { account: string; password: string }) => {
    setLoading(true)
    try {
      const user = await login(values.account, values.password)
      if (user.must_change_password) {
        navigate('/change-password')
      } else if (user.role === 'ADMIN') {
        navigate('/admin')
      } else {
        navigate('/workbench')
      }
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <div className="auth-brand">
          <div className="auth-mark" aria-hidden="true">吸</div>
          <h1 className="auth-title">吸入治疗指导与依从性辅助管理软件</h1>
          <p className="auth-sub">医护端登录</p>
        </div>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item name="account" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input autoFocus placeholder="请输入账号" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  )
}
