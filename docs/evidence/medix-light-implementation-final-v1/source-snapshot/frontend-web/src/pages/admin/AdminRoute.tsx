import { useContext, useState, useCallback } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Result } from 'antd'
import { useAuth } from '../../features/auth/AuthContext'
import MedixLayout from '../../components/medix/MedixLayout'
import AdminPage from './AdminPage'
import { AdminWorking } from './adminState'

export default function AdminRoute() {
  const { user } = useAuth(), [params] = useSearchParams()
  const tab = params.get('tab') ?? 'model'
  const [working, setWorking] = useState(false), setRouteWorking = useContext(AdminWorking)
  const setLocked = useCallback((value: boolean) => { setWorking(value); setRouteWorking(value) }, [setRouteWorking])
  if (user?.role !== 'ADMIN') return <MedixLayout><Result status="403" title="无权访问" /></MedixLayout>
  if (!['model', 'guide', 'user', 'kb', 'audit'].includes(tab) && !working) return <Navigate to="/admin?tab=model" replace />
  return <AdminWorking.Provider value={setLocked}><MedixLayout navigationLocked={working}><AdminPage tab={tab} /></MedixLayout></AdminWorking.Provider>
}

