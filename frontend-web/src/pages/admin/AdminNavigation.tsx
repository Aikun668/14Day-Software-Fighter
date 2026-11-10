import { useEffect, useState, type ReactNode } from 'react'
import { Routes, useLocation, useNavigate } from 'react-router-dom'
import { AdminWorking } from './adminState'

// Keep the active form/result mounted until its write or one-time result is finished.
export default function AdminNavigation({ children }: { children: ReactNode }) {
  const location = useLocation(), navigate = useNavigate()
  const [working, setWorking] = useState(false), [stableLocation, setStableLocation] = useState(location)
  if (!working && stableLocation !== location) setStableLocation(location)
  useEffect(() => {
    if (working && (location.pathname !== stableLocation.pathname || location.search !== stableLocation.search || location.hash !== stableLocation.hash)) {
      navigate(stableLocation.pathname + stableLocation.search + stableLocation.hash, { replace: true })
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (working) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [working, location, stableLocation, navigate])
  return <AdminWorking.Provider value={setWorking}><Routes location={working ? stableLocation : location}>{children}</Routes></AdminWorking.Provider>
}
