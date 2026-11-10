import { useEffect, useState } from 'react'
import { errorText } from './clinical'

// A changed query renders a loading state immediately, before effects run. Abort + key
// checks keep an older patient/date response from being rendered in a new context.
export function useClinicalQuery<T>(key: string, loader: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const [revision, setRevision] = useState(0)
  const fullKey = `${key}|${revision}`
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: '' })
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    loader(controller.signal).then(data => { if (!controller.signal.aborted) setState({ key: fullKey, data }) })
      .catch(error => { if (!controller.signal.aborted) setState({ key: fullKey, error: errorText(error) }) })
    return () => controller.abort()
  }, [fullKey, enabled, loader])
  const current = enabled && state.key === fullKey ? state : undefined
  return { data: current?.data, error: current?.error, loading: enabled && !current, retry: () => setRevision(n => n + 1) }
}
