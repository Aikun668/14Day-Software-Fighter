import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiFetch } from '../../api/client'
import { collectPages } from '../clinician/medixPaging'

export const ADMIN_TABS = ['model', 'guide', 'user', 'kb', 'audit'] as const
export type AdminTab = (typeof ADMIN_TABS)[number]

export function normalizeAdminTab(value: string | null): AdminTab {
  return ADMIN_TABS.includes(value as AdminTab) ? (value as AdminTab) : 'model'
}

export interface DeviceModel {
  id: string
  category: string
  brand: string
  model_name: string
  manufacturer: string | null
  status: string
}

export interface PageResult<T> {
  items: T[]
  total: number
}

export function errorText(reason: unknown) {
  return reason instanceof Error && reason.message ? reason.message : '请求失败'
}

export function ReviewStatusTag({ status }: { status: string }) {
  if (status === 'DRAFT') return <span className="ml-review is-draft">草稿</span>
  if (status === 'REVIEWED') return <span className="ml-review is-reviewed">已审核</span>
  if (status === 'PUBLISHED') return <span className="ml-review is-published">已发布</span>
  return <span className="ml-review">{status}</span>
}

export function listLabel(value: string) {
  const trimmed = value.replace(/\s*[(（]DEMO[)）]\s*$/i, '').trim()
  return trimmed || value
}

export function modelName(models: DeviceModel[] | null, id: string) {
  if (!models) return '型号信息不可用'
  return models.find((model) => model.id === id)?.model_name ?? '型号信息不可用'
}

export async function loadDeviceCatalog(alive?: () => boolean): Promise<DeviceModel[]> {
  const result = await collectPages<DeviceModel>(
    (page, pageSize) => apiFetch<PageResult<DeviceModel>>(`/api/admin/device-models?page=${page}&page_size=${pageSize}`),
    { alive, pageSize: 100, maxPages: 50 },
  )
  if (!result.complete) throw new Error('型号目录未完整读取')
  return result.items
}

export function parseGuideSteps(text: string): { ok: true; steps: { step_no: number; text: string }[] } | { ok: false; error: string } {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) return { ok: false, error: '请至少填写一步' }
  return { ok: true, steps: lines.map((line, index) => ({ step_no: index + 1, text: line })) }
}

export function parseSourceUrl(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const text = raw.trim()
  if (!text) return { ok: true, value: null }
  try {
    const url = new URL(text)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, error: '来源链接只支持 http 或 https' }
    }
    return { ok: true, value: url.toString() }
  } catch {
    return { ok: false, error: '来源链接格式不正确' }
  }
}

export function isVersionConflict(error: unknown) {
  return error instanceof ApiError && (error.status === 409 || error.code === 'VERSION_EXISTS' || error.code === 'NOT_REVIEWED' || error.code === 'ALREADY_PUBLISHED')
}

type Loader<T> = (page: number, pageSize: number, signal: AbortSignal) => Promise<PageResult<T>>

export function useServerPage<T>(load: Loader<T>) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error' | 'stale'>('loading')
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const seq = useRef(0)
  const ready = useRef(false)

  const reload = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    const my = ++seq.current
    let ignore = false
    setPhase(ready.current ? 'ready' : 'loading')
    load(page, pageSize, controller.signal)
      .then((result) => {
        if (ignore || seq.current !== my) return
        if (!result || !Array.isArray(result.items) || typeof result.total !== 'number') {
          throw new Error('列表响应不可用')
        }
        if (result.items.length === 0 && page > 1 && result.total > 0) {
          setPage(page - 1)
          return
        }
        setItems(result.items)
        setTotal(result.total)
        setError('')
        setPhase('ready')
        ready.current = true
      })
      .catch((reason: unknown) => {
        if (ignore || controller.signal.aborted || seq.current !== my) return
        setError(errorText(reason))
        setPhase(ready.current ? 'stale' : 'error')
      })
    return () => {
      ignore = true
      controller.abort()
    }
  }, [load, page, pageSize, tick])

  const changePageSize = (next: number) => {
    setPageSize(next)
    setPage(1)
  }

  return { page, setPage, pageSize, changePageSize, items, total, phase, error, reload }
}
