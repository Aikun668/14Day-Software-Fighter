import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

// 路由守卫：未登录跳登录；首次改密强制跳改密页
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return <>{children}</>
}
