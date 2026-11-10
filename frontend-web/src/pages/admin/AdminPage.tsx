import DeviceModelsPanel from './DeviceModelsPanel'
import ContentPanel from './ContentPanel'
import AccountsPanel from './AccountsPanel'
import AuditPanel from './AuditPanel'
import '../../styles/medix-admin.css'
import '../../styles/medix-dialogs.css'

export default function AdminPage({ tab }: { tab: string }) {
  if (tab === 'guide' || tab === 'kb') return <ContentPanel key={tab} kind={tab} />
  if (tab === 'user') return <AccountsPanel />
  if (tab === 'audit') return <AuditPanel />
  return <DeviceModelsPanel />
}

