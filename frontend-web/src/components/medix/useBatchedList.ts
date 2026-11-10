import { useCallback, useState } from 'react'
import { apiFetch } from '../../api/client'
import { type PageResult } from './clinical'
import { useClinicalQuery } from './useClinicalQuery'

// Five rows at a time, with a 50-row server cache. Crossing a page boundary reads
// the next server page; local expansion within it makes no network request.
export function useBatchedList<T>(path: string) {
  const [view, setView] = useState({ path, count: 5 })
  const count = view.path === path ? view.count : 5
  const pages = Math.ceil(count / 50)
  const loader = useCallback(async (signal: AbortSignal) => {
    const items: T[] = []; let total = 0
    for (let page = 1; page <= pages; page++) {
      const r = await apiFetch<PageResult<T>>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&page_size=50`, { signal })
      items.push(...r.items); total = r.total
      if (items.length >= total) break
    }
    return { items, total }
  }, [path, pages])
  const query = useClinicalQuery(`${path}:${pages}`, loader)
  return { ...query, items: query.data?.items.slice(0, count) ?? [], total: query.data?.total ?? 0, count,
    more: () => setView({ path, count: Math.min(count + 5, query.data?.total ?? count) }),
    collapse: () => setView({ path, count: 5 }) }
}

