import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input } from 'antd'
import { ApiError } from '../../api/client.ts'
import doctorUrl from '../../assets/medix/doctor-assistant.svg'
import logoUrl from '../../assets/medix/logo.svg'
import MedixThemeBoundary from '../../components/medix/MedixThemeBoundary.tsx'
import { useAuth } from '../../features/auth/AuthContext.tsx'

function loginErrorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401 && (!error.message || error.message === '未登录或会话已过期')) {
      return '账号或密码错误'
    }
    return error.message || '账号或密码错误'
  }
  return '网络异常，请稍后重试'
}

function LoginForm() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const submitting = useRef(false)

  const onFinish = async (values: { account: string; password: string }) => {
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    setErrorText(null)
    try {
      const user = await login(values.account, values.password)
      if (user.must_change_password) {
        navigate('/change-password')
      } else if (user.role === 'ADMIN') {
        navigate('/admin')
      } else {
        navigate('/workbench')
      }
    } catch (error) {
      setErrorText(loginErrorText(error))
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <>
      <div className="ml-auth-card">
        <div className="ml-auth-brand">
          <img className="ml-auth-mark" src={logoUrl} alt="" />
          <div>
            <div className="ml-auth-name">吸入治疗管理</div>
            <p className="ml-auth-product">吸入治疗指导与依从性辅助管理软件</p>
          </div>
        </div>
        <h1 className="ml-auth-heading">医护端登录</h1>
        <Form
          layout="vertical"
          requiredMark={false}
          onFinish={onFinish}
          onValuesChange={() => setErrorText(null)}
        >
          <Form.Item name="account" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input autoFocus autoComplete="username" placeholder="请输入账号" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password autoComplete="current-password" placeholder="请输入密码" />
          </Form.Item>
          {errorText && (
            <p className="ml-auth-error" role="alert">{errorText}</p>
          )}
          <Button
            className="ml-auth-submit"
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            disabled={loading}
          >
            登录
          </Button>
        </Form>
      </div>
      <img className="ml-auth-art" src={doctorUrl} alt="" />
    </>
  )
}

export default function LoginPage() {
  return (
    <MedixThemeBoundary scope="auth">
      <LoginForm />
    </MedixThemeBoundary>
  )
}
