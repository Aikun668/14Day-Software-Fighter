import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/auth/LoginPage'
import ChangePasswordPage from './pages/auth/ChangePasswordPage'
import WorkbenchPage from './pages/clinician/WorkbenchPage'
import PatientListPage from './pages/clinician/PatientListPage'
import PatientDetailPage from './pages/clinician/PatientDetailPage'
import PlanEditPage from './pages/clinician/PlanEditPage'
import StatsPage from './pages/clinician/StatsPage'
import FollowupPage from './pages/clinician/FollowupPage'
import AdminRoute from './pages/admin/AdminRoute'
import MedixLayout from './components/medix/MedixLayout'
import { AuthProvider } from './features/auth/AuthContext'
import { RequireAuth } from './features/auth/RequireAuth'

// J013 路由骨架 + 鉴权守卫
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/workbench" element={<RequireAuth><MedixLayout><WorkbenchPage /></MedixLayout></RequireAuth>} />
          <Route path="/patients" element={<RequireAuth><MedixLayout><PatientListPage /></MedixLayout></RequireAuth>} />
          <Route path="/patients/:id" element={<RequireAuth><MedixLayout><PatientDetailPage /></MedixLayout></RequireAuth>} />
          <Route path="/plans" element={<RequireAuth><MedixLayout><PlanEditPage /></MedixLayout></RequireAuth>} />
          <Route path="/stats" element={<RequireAuth><MedixLayout><StatsPage /></MedixLayout></RequireAuth>} />
          <Route path="/followups" element={<RequireAuth><MedixLayout><FollowupPage /></MedixLayout></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><AdminRoute /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
