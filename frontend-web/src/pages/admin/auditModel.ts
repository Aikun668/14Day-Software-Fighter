// 审计区间只从已有分页日志派生。不发日期参数，不把未读全的页画成全量。

import { addDays, shanghaiNowIso, shanghaiParts } from '../clinician/medixClinicalModel.ts'

export const AUDIT_PAGE_SIZE = 100
export const AUDIT_MAX_PAGES = 50

export interface AuditEvent {
  id: string
  created_at: string
  action: string
  resource_type: string
  resource_id: string
  actor_id: string | null
  detail: unknown
}

export interface AuditPage {
  items: AuditEvent[]
  total: number
}

export type AuditCategory = 'review' | 'publish' | 'model' | 'account' | 'other'

export type AuditReason = 'failed' | 'incomplete' | 'unstable'

export interface FoldResult {
  events: AuditEvent[]
  complete: boolean
  reason?: AuditReason
  done: boolean
  unstable: boolean
}

export interface AuditSummary {
  days: { day: string; count: number }[]
  groups: { category: AuditCategory; count: number }[]
  total: number
  visibleEvents: AuditEvent[]
  anomalies: AuditEvent[]
}

const REVIEW = new Set(['GUIDE_REVIEW', 'KNOWLEDGE_REVIEW'])
const PUBLISH = new Set(['GUIDE_PUBLISH', 'KNOWLEDGE_PUBLISH'])
const MODEL = new Set(['DEVICE_MODEL_CREATE'])
// 账号启停当前没有 write_audit。空集合是已核实结果，不要按名字猜测。
const ACCOUNT = new Set<string>()

export const CATEGORY_ORDER: AuditCategory[] = ['account', 'review', 'publish', 'model', 'other']

export const CATEGORY_LABEL: Record<AuditCategory, string> = {
  account: '账号管理',
  review: '内容审核',
  publish: '内容发布',
  model: '型号维护',
  other: '其他',
}

const ACTION_LABEL: Record<string, string> = {
  PATIENT_CREATE: '患者建档',
  PATIENT_ACCOUNT_BIND: '绑定患者账号',
  GUIDE_CREATE: '创建指导',
  GUIDE_REVIEW: '审核指导',
  GUIDE_PUBLISH: '发布指导',
  KNOWLEDGE_CREATE: '创建知识',
  KNOWLEDGE_REVIEW: '审核知识',
  KNOWLEDGE_PUBLISH: '发布知识',
  PLAN_CREATE: '创建计划',
  PLAN_REVISION: '计划修订',
  MEDICATION_RECORD: '用药登记',
  MEDICATION_REVOKE: '撤销登记',
  FOLLOWUP_CREATE: '随访记录',
  DEVICE_BIND: '绑定装置',
  DEVICE_MODEL_CREATE: '新增型号',
  TASK_CREATE: '生成核查任务',
}

export function categoryOf(action: string): AuditCategory {
  if (REVIEW.has(action)) return 'review'
  if (PUBLISH.has(action)) return 'publish'
  if (MODEL.has(action)) return 'model'
  if (ACCOUNT.has(action)) return 'account'
  return 'other'
}

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action
}

export function dayList(startDay: string, endDay: string): string[] {
  const days: string[] = []
  let cursor = startDay
  while (cursor <= endDay) {
    days.push(cursor)
    if (days.length > 400) break
    cursor = addDays(cursor, 1)
  }
  return days
}

function windowBounds(startDay: string, endDay: string) {
  return {
    startMs: Date.parse(`${startDay}T00:00:00+08:00`),
    endMs: Date.parse(`${addDays(endDay, 1)}T00:00:00+08:00`),
  }
}

export function eventInstant(iso: string): number | null {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

export function foldAuditPages(
  pages: AuditPage[],
  startDay: string,
  endDay: string,
  flags?: { truncated?: boolean; failed?: boolean },
): FoldResult {
  const { startMs, endMs } = windowBounds(startDay, endDay)
  const seen = new Set<string>()
  const events: AuditEvent[] = []
  let unstable = false
  let orderOk = true
  let stoppedEarly = false
  let total = pages[0]?.total ?? 0
  let previousMs: number | null = null

  for (const page of pages) {
    if (page.total !== total) unstable = true
    total = page.total
    let pageAllBefore = page.items.length > 0
    for (const event of page.items) {
      const ms = eventInstant(event.created_at)
      if (ms != null && previousMs != null && ms > previousMs) orderOk = false
      if (ms != null) previousMs = ms
      if (ms == null || ms >= startMs) pageAllBefore = false
      if (seen.has(event.id)) {
        unstable = true
        continue
      }
      seen.add(event.id)
      if (ms == null || (ms >= startMs && ms < endMs)) events.push(event)
    }
    if (pageAllBefore && orderOk) {
      stoppedEarly = true
      break
    }
  }

  const reachedEnd = pages.length > 0 && (total === 0 || seen.size >= total || pages[pages.length - 1].items.length === 0)
  const done = stoppedEarly || reachedEnd
  if (flags?.failed) {
    return { events, complete: false, reason: 'failed', done: true, unstable }
  }
  if (!orderOk || unstable) {
    return { events, complete: false, reason: 'unstable', done, unstable: true }
  }
  if (done && !flags?.truncated) {
    return { events, complete: true, done: true, unstable: false }
  }
  return { events, complete: false, reason: 'incomplete', done: false, unstable: false }
}

export function summarizeAudit(
  events: AuditEvent[],
  startDay: string,
  endDay: string,
  type: AuditCategory | 'all',
): AuditSummary {
  const { startMs, endMs } = windowBounds(startDay, endDay)
  const anomalies: AuditEvent[] = []
  const inWindow: AuditEvent[] = []
  for (const event of events) {
    const ms = eventInstant(event.created_at)
    if (ms == null) {
      anomalies.push(event)
      continue
    }
    if (ms < startMs || ms >= endMs) continue
    inWindow.push(event)
  }
  const filtered = type === 'all' ? inWindow : inWindow.filter((event) => categoryOf(event.action) === type)
  const filteredAnomalies = type === 'all' ? anomalies : anomalies.filter((event) => categoryOf(event.action) === type)
  const counts = new Map<string, number>()
  for (const day of dayList(startDay, endDay)) counts.set(day, 0)
  const categoryCounts = new Map<AuditCategory, number>()
  for (const category of CATEGORY_ORDER) categoryCounts.set(category, 0)
  for (const event of filtered) {
    const ms = eventInstant(event.created_at)
    if (ms == null) continue
    const day = shanghaiParts(ms)?.date
    if (!day || !counts.has(day)) continue
    counts.set(day, (counts.get(day) ?? 0) + 1)
    const category = categoryOf(event.action)
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
  }
  const groups = CATEGORY_ORDER
    .map((category) => ({ category, count: categoryCounts.get(category) ?? 0 }))
    .filter((group) => group.count > 0)
  const visibleEvents = [...filtered].sort((a, b) => (eventInstant(b.created_at) ?? 0) - (eventInstant(a.created_at) ?? 0))
  return {
    days: [...counts.entries()].map(([day, count]) => ({ day, count })),
    groups,
    total: filtered.length,
    visibleEvents,
    anomalies: filteredAnomalies,
  }
}

export interface AuditWindowResult {
  events: AuditEvent[]
  complete: boolean
  reason?: AuditReason
  readAt: string
}

export async function loadAuditWindow(
  startDay: string,
  endDay: string,
  fetchPage: (page: number, signal: AbortSignal) => Promise<AuditPage>,
  signal: AbortSignal,
  now = Date.now(),
): Promise<AuditWindowResult> {
  const readAt = shanghaiNowIso(now)
  const once = async () => {
    const pages: AuditPage[] = []
    try {
      for (let page = 1; page <= AUDIT_MAX_PAGES; page += 1) {
        if (signal.aborted) throw new DOMException('aborted', 'AbortError')
        const slice = await fetchPage(page, signal)
        pages.push(slice)
        const folded = foldAuditPages(pages, startDay, endDay)
        if (folded.done || folded.reason === 'unstable') return folded
        if (slice.items.length === 0) return foldAuditPages(pages, startDay, endDay)
      }
      return foldAuditPages(pages, startDay, endDay, { truncated: true })
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error
      return foldAuditPages(pages, startDay, endDay, { failed: true })
    }
  }

  let folded = await once()
  if (folded.reason === 'unstable') folded = await once()
  return {
    events: folded.events,
    complete: folded.complete,
    reason: folded.complete ? undefined : folded.reason,
    readAt,
  }
}
