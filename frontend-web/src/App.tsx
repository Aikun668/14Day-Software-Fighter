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

// Clinic Comfort 外壳：侧栏钉在视口里，主栏自己滚。卡片仍按内容高。
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

// Medix Light 外壳挂工作台、患者列表、用药计划、统计与核查、随访中心。
// 详情和管理端继续 Comfort，避免染到未迁移页。
function MedixShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <WebLayout variant="medix">{children}</WebLayout>
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
          <Route path="/workbench" element={<MedixShell><WorkbenchPage /></MedixShell>} />
          <Route path="/patients" element={<MedixShell><PatientListPage /></MedixShell>} />
          <Route path="/patients/:id" element={<ComfortShell crumb={{ parent: '患者', parentTo: '/patients', current: '详情' }}><PatientDetailPage /></ComfortShell>} />
          <Route path="/plans" element={<MedixShell><PlanEditPage /></MedixShell>} />
          <Route path="/stats" element={<MedixShell><StatsPage /></MedixShell>} />
          <Route path="/followups" element={<MedixShell><FollowupPage /></MedixShell>} />
          <Route path="/admin" element={<ComfortShell><AdminPage /></ComfortShell>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
