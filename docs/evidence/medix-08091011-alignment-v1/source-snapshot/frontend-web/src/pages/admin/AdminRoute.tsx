import { useSearchParams } from 'react-router-dom'
import { Result } from 'antd'
import { useAuth } from '../../features/auth/AuthContext'
import MedixLayout from '../../components/medix/MedixLayout'
import WebLayout from '../../components/WebLayout'
import AdminPage from './AdminPage'
import DeviceModelsPanel from './DeviceModelsPanel'

export default function AdminRoute() {
  const { user } = useAuth(), [params] = useSearchParams()
  if (user?.role !== 'ADMIN') return <MedixLayout><Result status="403" title="无权访问" /></MedixLayout>
  const tab = params.get('tab') ?? 'model'
  return tab === 'model' ? <MedixLayout><DeviceModelsPanel /></MedixLayout> : <WebLayout variant="comfort"><AdminPage /></WebLayout>
}

