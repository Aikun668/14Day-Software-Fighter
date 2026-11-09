export interface PageChunk<T> {
  items: T[]
  total: number
}

export async function collectPages<T>(
  load: (page: number, pageSize: number) => Promise<PageChunk<T>>,
  opts?: { pageSize?: number; maxPages?: number; alive?: () => boolean },
): Promise<{ items: T[]; total: number; complete: boolean }> {
  const pageSize = opts?.pageSize ?? 100
  const maxPages = opts?.maxPages ?? 50
  const items: T[] = []
  let total = 0
  for (let page = 1; page <= maxPages; page += 1) {
    if (opts?.alive && !opts.alive()) return { items, total, complete: false }
    const res = await load(page, pageSize)
    if (!res || !Array.isArray(res.items) || typeof res.total !== 'number') {
      throw new Error('列表响应不可用')
    }
    total = res.total
    items.push(...res.items)
    if (items.length >= total || res.items.length === 0) {
      return { items, total, complete: items.length >= total }
    }
  }
  return { items, total, complete: items.length >= total }
}
