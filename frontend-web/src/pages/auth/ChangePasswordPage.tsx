import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Form, Input, message } from 'antd'
import BrandMark from '../../components/BrandMark'
import { apiFetch } from '../../api/client'
import { useAuth } from '../../features/auth/AuthContext'

// G01 首次改密页（J013）：改密后强制重新登录
export default function ChangePasswordPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { old_password: string; new_password: string; confirm: string }) => {
    if (values.new_password !== values.confirm) {
      message.error('两次输入的新密码不一致')
      return
    }
    setLoading(true)
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password: values.old_password, new_password: values.new_password }),
      })
      message.success('密码已修改，请重新登录')
      await logout()
      navigate('/login')
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
          <BrandMark size={36} />
          <h1 className="auth-title">首次登录需修改密码</h1>
          <p className="auth-sub">修改后需使用新密码重新登录</p>
        </div>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item name="old_password" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 8, message: '至少 8 位' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="confirm" label="确认新密码" rules={[{ required: true, message: '请再次输入新密码' }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            修改并重新登录
          </Button>
        </Form>
      </Card>
    </div>
  )
}
