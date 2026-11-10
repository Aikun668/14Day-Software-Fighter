import dayjs from 'dayjs'
import { apiFetch } from '../../api/client'

export interface PageResult<T> { items: T[]; total: number; page?: number; page_size?: number }
export interface MedixPatient { id: string; patient_code: string; display_name: string; diagnosis_label?: string | null; note?: string | null; avatar_url?: string | null }
export interface MedicationPlan {
  id: string; device_model_id: string; drug_label: string; plan_type: string;
  starts_at: string; ends_at: string | null; version: number;
  daily_times: { id?: string; local_time: string; is_enabled?: boolean }[]
}
export const cleanDemo = (s: string) => s.replace(/\s*[(（]DEMO[)）]/gi, '').trim()
export const isDemoPatient = (p?: MedixPatient | null) => /DEMO/i.test(`${p?.diagnosis_label ?? ''} ${p?.note ?? ''}`)
export const shanghaiDay = (date: Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
export const addDays = (date: string, days: number) => dayjs(date).add(days, 'day').format('YYYY-MM-DD')
export const midnight = (date: string) => `${date}T00:00:00+08:00`
export function shanghaiParts(iso: string) {
  const date = new Date(iso)
  return { day: shanghaiDay(date), time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date) }
}
export const shortTime = (iso: string) => { const p = shanghaiParts(iso); return `${p.day.slice(5).replace('-', '/')} ${p.time}` }
export const rateText = (value: number | null) => value === null ? '—' : `${value}%`
export const coverageRate = (M: number, N: number) => N === 0 ? null : Math.round(M / N * 1000) / 10
export function validCounts(M: number, N: number) { return Number.isInteger(M) && Number.isInteger(N) && M >= 0 && N >= M }
export function validTimes(times: string[]) { return times.length > 0 && times.every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) && new Set(times).size === times.length }
export function derivePlanPhase(plan: Pick<MedicationPlan, 'starts_at' | 'ends_at'>, now: number) {
  const start = Date.parse(plan.starts_at), end = plan.ends_at ? Date.parse(plan.ends_at) : Infinity
  if (!Number.isFinite(start) || Number.isNaN(end) || end <= start) return 'invalid'
  return now < start ? 'pending' : now < end ? 'active' : 'ended'
}
export const phaseLabel = { active: '生效中', pending: '待生效', ended: '已结束', invalid: '状态不可用' }
export function planDateRange(plan: MedicationPlan) {
  const start = shanghaiParts(plan.starts_at)
  if (!plan.ends_at) return `${start.day}${start.time === '00:00' ? '' : ` ${start.time}`} 起`
  const end = shanghaiParts(plan.ends_at)
  return `${start.day}${start.time === '00:00' ? '' : ` ${start.time}`} — ${end.time === '00:00' ? addDays(end.day, -1) : `${end.day} ${end.time}`}`
}
// Pagination is deliberate: the first 100 records are not the whole directory.
export async function fetchAll<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page++) {
    const result = await apiFetch<PageResult<T>>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&page_size=100`, { signal })
    items.push(...result.items)
    if (items.length >= (result.total ?? items.length) || result.items.length === 0) return items
  }
}
export function errorText(error: unknown) { return error instanceof Error ? error.message : '加载失败' }
