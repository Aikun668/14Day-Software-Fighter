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

// Clinic Comfort 变体的外壳：收页高 + 侧栏品牌 + 面包屑。
// 新页面要上 Clinic Comfort，就用它，而不是往 WebLayout 里加路径判断。
function ComfortShell({
  children,
  crumb,
}: {
  children: React.ReactNode
  crumb?: { parent: string; parentTo: string; current: string }
}) {
  return (
    <RequireAuth>
      <WebLayout variant="comfort" crumb={crumb}>{children}</WebLayout>
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
          <Route path="/workbench" element={<ComfortShell><WorkbenchPage /></ComfortShell>} />
          <Route path="/patients" element={<ComfortShell><PatientListPage /></ComfortShell>} />
          <Route path="/patients/:id" element={<ComfortShell crumb={{ parent: '患者', parentTo: '/patients', current: '详情' }}><PatientDetailPage /></ComfortShell>} />
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
