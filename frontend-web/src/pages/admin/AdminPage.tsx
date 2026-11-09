import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  errorText,
  loadDeviceCatalog,
  normalizeAdminTab,
  type DeviceModel,
} from './adminShared'
import DeviceModelsPanel from './DeviceModelsPanel'
import GuidesPanel from './GuidesPanel'
import AccountsPanel from './AccountsPanel'
import KnowledgePanel from './KnowledgePanel'
import AuditPanel from './AuditPanel'
import '../../styles/medix-admin.css'

// 管理端五个视图共用 /admin?tab=。各自请求，一个接口失败不拖垮其他页。
export default function AdminPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab = normalizeAdminTab(raw)
  const [models, setModels] = useState<DeviceModel[] | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [catalogTick, setCatalogTick] = useState(0)

  useEffect(() => {
    if (raw !== tab) setParams({ tab }, { replace: true })
  }, [raw, tab, setParams])

  const needsCatalog = tab === 'guide' || tab === 'kb' || catalogTick > 0
  useEffect(() => {
    if (!needsCatalog) return
    let alive = true
    loadDeviceCatalog(() => alive)
      .then((items) => {
        if (!alive) return
        setModels(items)
        setCatalogError(null)
      })
      .catch((error: unknown) => {
        if (!alive) return
        setModels(null)
        setCatalogError(errorText(error))
      })
    return () => {
      alive = false
    }
  }, [needsCatalog, catalogTick])

  const retryCatalog = () => setCatalogTick((value) => value + 1)

  return (
    <div className="ml-admin">
      {tab === 'model' ? <DeviceModelsPanel onChanged={retryCatalog} /> : null}
      {tab === 'guide' ? (
        <GuidesPanel models={models} catalogError={catalogError} onRetryCatalog={retryCatalog} />
      ) : null}
      {tab === 'user' ? <AccountsPanel /> : null}
      {tab === 'kb' ? (
        <KnowledgePanel models={models} catalogError={catalogError} onRetryCatalog={retryCatalog} />
      ) : null}
      {tab === 'audit' ? <AuditPanel /> : null}
    </div>
  )
}
