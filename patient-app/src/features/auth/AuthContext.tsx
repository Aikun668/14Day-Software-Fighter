import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch, setTokenGetter, setUnauthorizedHandler } from '../../api/client'

interface User {
  id: string
  account: string
  role: string
  status: string
  must_change_password: boolean
}

interface AuthState {
  token: string | null
  user: User | null
  login: (account: string, password: string) => Promise<User>
  logout: () => Promise<void>
  setUser: (u: User) => void
}

const AuthContext = createContext<AuthState | null>(null)

// 内存 Token（PRD §8.3.5：不写 localStorage/preferences，冷启动重登）
let memoryToken: string | null = null

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(memoryToken)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    setTokenGetter(() => memoryToken)
    // 401 时清内存 token 并跳登录页（会话失效处理）
    setUnauthorizedHandler(() => {
      memoryToken = null
      setToken(null)
      setUser(null)
      window.location.href = '/login'
    })
  }, [])

  const login = async (account: string, password: string) => {
    const data = await apiFetch<{ access_token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account, password }),
      skipAuthRedirect: true, // 登录失败是凭据错误，不能触发会话失效跳转
    })
    memoryToken = data.access_token
    setToken(data.access_token)
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // 断网退出：本地仍清内存
    }
    memoryToken = null
    setToken(null)
    setUser(null)
  }

  const value = useMemo(
    () => ({ token, user, login, logout, setUser }),
    [token, user],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
