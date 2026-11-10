import { apiFetch } from '../../api/client'
import { addDays, coverageRate, errorText, midnight, validCounts, type PageResult } from './clinical'
import type { TrendPoint } from '../CoverageTrendChart'

export interface WindowKey { from_: string; to: string; timezone: string }
export interface CoverageRow { patient_id: string; patient_code: string; display_name: string; M: number; N: number; coverage_rate: number | null; missing_count: number }
export interface Overview extends WindowKey { total_M: number; total_N: number; coverage_rate: number | null; rows: CoverageRow[] }
export interface Matrix extends WindowKey { days: string[]; total_M: number; total_N: number; rows: (CoverageRow & { cells: TrendPoint[] })[] }
export interface PatientStats extends WindowKey { M: number; N: number; coverage_rate: number | null; missing_slots: { slot_id: string; scheduled_at: string }[]; duplicate_slots: { slot_id: string; scheduled_at: string; active_event_count: number }[]; source_breakdown: Record<string, number> }
export interface Trend extends WindowKey { points: TrendPoint[] }
export interface Followup { id: string; followed_at: string; feedback: string | null; action_taken: string | null; next_plan: string | null }
export interface Result<T> { data?: T; error?: string }
const totals = (points: { M: number; N: number }[]) => points.reduce((r, p) => ({ M: r.M + p.M, N: r.N + p.N }), { M: 0, N: 0 })
function assertCounts(p: { M: number; N: number; coverage_rate?: number | null }) {
  // The API uses Python round; JavaScript ties round differently (1/16 -> 6.25%).
  // Accept the server's one-decimal rounding, without replacing its reported rate.
  if (!validCounts(p.M, p.N) || (p.coverage_rate !== undefined && (
    p.N === 0 ? p.coverage_rate !== null : typeof p.coverage_rate !== 'number' || !Number.isFinite(p.coverage_rate) || p.coverage_rate < 0 || p.coverage_rate > 100 || Math.abs(p.coverage_rate - p.M / p.N * 100) > .050001
  ))) throw new Error('统计数据异常，请刷新')
}
function assertWindow(data: WindowKey, from: string, to: string) {
  if (data.from_ !== from || data.to !== to || data.timezone !== 'Asia/Shanghai') throw new Error('统计区间不一致，请刷新')
}
function windowDays(from: string, to: string) { const days: string[] = []; for (let d = from; d < to; d = addDays(d, 1)) days.push(d); return days }
export function aggregateDailyCoverage(matrix: Matrix): TrendPoint[] {
  if (new Set(matrix.days).size !== matrix.days.length) throw new Error('日期重复，统计数据异常')
  for (const row of matrix.rows) {
    if (row.cells.length !== matrix.days.length || new Set(row.cells.map(c => c.day)).size !== row.cells.length || row.cells.some(c => !matrix.days.includes(c.day))) throw new Error('日期缺失，统计数据异常')
    row.cells.forEach(assertCounts)
    const sum = totals(row.cells)
    if (sum.M !== row.M || sum.N !== row.N) throw new Error('患者统计数据不一致')
  }
  return matrix.days.map(day => {
    const sum = totals(matrix.rows.map(row => row.cells.find(c => c.day === day)!))
    return { day, ...sum, coverage_rate: coverageRate(sum.M, sum.N) }
  })
}
async function result<T>(read: () => Promise<T>): Promise<Result<T>> { try { return { data: await read() } } catch (e) { return { error: errorText(e) } } }
export async function readTeam(from: string, to: string, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    const [overview, matrix] = await Promise.all([
      result(async () => { const r = await apiFetch<Overview>(`/api/stats/overview?from=${from}&to=${to}`, { signal }); assertWindow(r, from, to); assertCounts({ M: r.total_M, N: r.total_N, coverage_rate: r.coverage_rate }); r.rows.forEach(assertCounts); const sum = totals(r.rows); if (sum.M !== r.total_M || sum.N !== r.total_N) throw new Error('团队汇总与患者数据不一致'); return r }),
      result(async () => { const r = await apiFetch<Matrix>(`/api/stats/matrix?from=${from}&to=${to}`, { signal }); assertWindow(r, from, to); if (r.days.join() !== windowDays(from, to).join()) throw new Error('趋势日期不完整'); const points = aggregateDailyCoverage(r); const sum = totals(points); if (sum.M !== r.total_M || sum.N !== r.total_N) throw new Error('趋势汇总数据异常'); return { matrix: r, points } }),
    ])
    const mismatch = overview.data && matrix.data && (overview.data.total_M !== matrix.data.matrix.total_M || overview.data.total_N !== matrix.data.matrix.total_N)
    if (mismatch && attempt === 0 && !signal.aborted) continue
    return { overview, matrix, mismatch: mismatch ? '数据更新中，请刷新' : undefined }
  }
}
export async function readReport(id: string, from: string, to: string, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    const [stats, trend] = await Promise.all([
      result(async () => { const r = await apiFetch<PatientStats>(`/api/patients/${id}/stats?from=${from}&to=${to}`, { signal }); assertWindow(r, from, to); assertCounts(r); if (r.missing_slots.length !== r.N - r.M || Object.values(r.source_breakdown).some(n => !Number.isInteger(n) || n < 0)) throw new Error('报告数据异常'); return r }),
      result(async () => { const r = await apiFetch<Trend>(`/api/patients/${id}/stats/trend?from=${from}&to=${to}`, { signal }); assertWindow(r, from, to); r.points.forEach(assertCounts); if (r.points.map(p => p.day).join() !== windowDays(from, to).join()) throw new Error('趋势日期不完整'); return r }),
    ])
    const sum = trend.data ? totals(trend.data.points) : undefined
    const mismatch = stats.data && sum && (stats.data.M !== sum.M || stats.data.N !== sum.N)
    if (mismatch && attempt === 0 && !signal.aborted) continue
    return { stats, trend, mismatch: mismatch ? '数据更新中，请刷新' : undefined }
  }
}
export async function readFollowups(id: string, from: string, to: string, signal: AbortSignal) {
  const rows: Followup[] = [], start = Date.parse(midnight(from)), end = Date.parse(midnight(to))
  for (let page = 1; ; page++) {
    const r = await apiFetch<PageResult<Followup>>(`/api/patients/${id}/followups?page=${page}&page_size=100`, { signal })
    rows.push(...r.items.filter(f => Date.parse(f.followed_at) >= start && Date.parse(f.followed_at) < end))
    if (rows.length >= 4 || r.items.some(f => Date.parse(f.followed_at) < start) || page * 100 >= r.total || !r.items.length) return rows.sort((a, b) => b.followed_at.localeCompare(a.followed_at))
  }
}
