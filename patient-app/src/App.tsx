import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import LoginPage from './pages/auth/LoginPage'
import ChangePasswordPage from './pages/auth/ChangePasswordPage'
import TodayPage from './pages/patient/TodayPage'
import GuidePage from './pages/patient/GuidePage'
import TrainingPage from './pages/patient/TrainingPage'
import MedicationPage from './pages/patient/MedicationPage'
import AssistantPage from './pages/patient/AssistantPage'
import { AuthProvider } from './features/auth/AuthContext'
import { RequireAuth } from './features/auth/RequireAuth'

// 根页面（按返回键直接退出，而不是逐级回退）
const ROOT_PATHS = ['/today', '/guide', '/medication']

// 处理 Android 系统返回键：二级页回退，根页按一次提示、再按退出
function BackButtonHandler() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let lastBackAt = 0
    let cleanup: (() => void) | null = null
    CapApp.addListener('backButton', ({ canGoBack }) => {
      const isRoot = ROOT_PATHS.includes(location.pathname)
      const isAuth = location.pathname === '/login' || location.pathname === '/change-password'
      if (isAuth) return // 登录/改密页不拦截，交给系统
      if (!isRoot && canGoBack) {
        navigate(-1)
        return
      }
      // 根页面：双击退出
      const now = Date.now()
      if (now - lastBackAt < 2000) {
        CapApp.exitApp()
      } else {
        lastBackAt = now
      }
    }).then((handle) => {
      cleanup = () => handle.remove()
    })
    return () => { cleanup?.() }
  }, [location.pathname, navigate])

  return null
}

// 设置状态栏：overlay=true 让网页铺满状态栏；同时用 CSS 变量注入真实状态栏高度。
// 注：Android WebView 的 env(safe-area-inset-top) 常为 0，因此这里用插件实测高度兜底。
function StatusBarSetup() {
  useEffect(() => {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
    // 读取真实状态栏高度，注入 CSS 变量供顶栏留白
    StatusBar.getInfo?.().then((info) => {
      const h = info?.height ?? 0
      document.documentElement.style.setProperty('--safe-top-fallback', `${h}px`)
    }).catch(() => {})
  }, [])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <StatusBarSetup />
        <BackButtonHandler />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/today" element={<RequireAuth><TodayPage /></RequireAuth>} />
          <Route path="/guide" element={<RequireAuth><GuidePage /></RequireAuth>} />
          <Route path="/training" element={<RequireAuth><TrainingPage /></RequireAuth>} />
          <Route path="/medication" element={<RequireAuth><MedicationPage /></RequireAuth>} />
          <Route path="/assistant" element={<RequireAuth><AssistantPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
