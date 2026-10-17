import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/auth/LoginPage'
import ChangePasswordPage from './pages/auth/ChangePasswordPage'
import WorkbenchPage from './pages/clinician/WorkbenchPage'
import PatientListPage from './pages/clinician/PatientListPage'
import PatientDetailPage from './pages/clinician/PatientDetailPage'
import PlanEditPage from './pages/clinician/PlanEditPage'
import StatsPage from './pages/clinician/StatsPage'
import FollowupPage from './pages/clinician/FollowupPage'
import AdminPage from './pages/admin/AdminPage'
import WebLayout from './components/WebLayout'
import { AuthProvider } from './features/auth/AuthContext'
import { RequireAuth } from './features/auth/RequireAuth'

// 业务页统一套 WebLayout（顶栏 + 左侧导航）
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <WebLayout>{children}</WebLayout>
    </RequireAuth>
  )
}

// J013 路由骨架 + 鉴权守卫
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/workbench" element={<Shell><WorkbenchPage /></Shell>} />
          <Route path="/patients" element={<Shell><PatientListPage /></Shell>} />
          <Route path="/patients/:id" element={<Shell><PatientDetailPage /></Shell>} />
          <Route path="/plans" element={<Shell><PlanEditPage /></Shell>} />
          <Route path="/stats" element={<Shell><StatsPage /></Shell>} />
          <Route path="/followups" element={<Shell><FollowupPage /></Shell>} />
          <Route path="/admin" element={<Shell><AdminPage /></Shell>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
