import { createContext, useContext, useRef, useState } from 'react'
import { message } from 'antd'
import { ApiError } from '../../api/client'

export const AdminWorking = createContext<(busy: boolean) => void>(() => {})
export function useAdminAction() {
  const setWorking = useContext(AdminWorking), lock = useRef(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [blocked, setBlocked] = useState(false)
  const run = async <T,>(write: () => Promise<T>, saved: (value: T) => void | Promise<void>, failed?: (error: ApiError) => void) => {
    if (lock.current || blocked) return
    lock.current = true; setBusy(true); setWorking(true); setError('')
    let value: T
    try { value = await write() }
    catch (e) {
      if (!(e instanceof ApiError) || e.status >= 500) { setBlocked(true); setError('结果未确认，请读取核对后再操作') }
      else { setError(e.message); if ([403, 404].includes(e.status)) setBlocked(true); failed?.(e) }
      lock.current = false; setBusy(false); setWorking(false); return
    }
    // A successful write stays successful even when its subsequent read fails.
    try { await saved(value) } catch { setBlocked(true); setError('已保存，刷新失败，请重试读取'); message.warning('已保存，刷新失败，请重试读取') }
    finally { lock.current = false; setBusy(false); setWorking(false) }
  }
  const verify = async (read: () => Promise<string>) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setWorking(true)
    try { setError(await read()) } catch { setError('核对失败，请重试读取') }
    finally { lock.current = false; setBusy(false); setWorking(false) }
  }
  return { busy, error, blocked, run, verify, clearError: () => setError('') }
}
export const safeHttp = (value?: string | null) => {
  if (!value) return null
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null }
}
export interface DeviceModel { id: string; model_name: string }
export interface ContentBase { id: string; device_model_id: string; title: string; version: string; review_status: string; source_url: string | null; reviewed_at?: string | null; published_at?: string | null }
export interface Guide extends ContentBase { source_title: string | null; steps: { id: string; step_no: number; text: string; error_notes: string | null; image_path: string | null }[] }
export interface Knowledge extends ContentBase { chunks?: { id: string; chunk_no: number; text: string }[] }

