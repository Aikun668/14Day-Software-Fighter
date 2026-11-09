// 05/06/08/09 的日期、计划阶段和覆盖率换算。
// 只做纯转换，不发请求。业务日一律按 Asia/Shanghai，不读电脑时区。

export const SHANGHAI = 'Asia/Shanghai'
export const STATS_MAX_DAYS = 92

export type PlanPhase = 'pending' | 'active' | 'ended' | 'invalid'

export interface PlanBounds {
  starts_at: string
  ends_at: string | null
}

export interface MatrixCellLike {
  day: string
  N: number
  M: number
}

export interface MatrixLike {
  days: string[]
  rows: { cells: MatrixCellLike[] }[]
}

export interface DailyCoverage {
  day: string
  N: number
  M: number
  coverage_rate: number | null
  anomaly?: string
}

export interface ShanghaiParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  date: string
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export class StatsWindowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StatsWindowError'
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function isRealDay(day: string): boolean {
  const match = DAY_RE.exec(day)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const date = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, date))
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === date
}

export function addDays(day: string, amount: number): string {
  if (!isRealDay(day)) throw new StatsWindowError('日期无效')
  const [year, month, date] = day.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, date + amount))
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`
}

export function daysBetween(start: string, end: string): number {
  if (!isRealDay(start) || !isRealDay(end)) throw new StatsWindowError('日期无效')
  const [ys, ms, ds] = start.split('-').map(Number)
  const [ye, me, de] = end.split('-').map(Number)
  const a = Date.UTC(ys, ms - 1, ds)
  const b = Date.UTC(ye, me - 1, de)
  return Math.round((b - a) / 86400000)
}

export function shanghaiParts(now: number): ShanghaiParts | null {
  if (!Number.isFinite(now)) return null
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: SHANGHAI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const bag: Record<string, string> = {}
  for (const part of fmt.formatToParts(new Date(now))) bag[part.type] = part.value
  let hour = Number(bag.hour)
  if (hour === 24) hour = 0
  const year = Number(bag.year)
  const month = Number(bag.month)
  const day = Number(bag.day)
  if (!year || !month || !day) return null
  return {
    year,
    month,
    day,
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
    date: `${year}-${pad(month)}-${pad(day)}`,
  }
}

export function shanghaiToday(now = Date.now()): string {
  const parts = shanghaiParts(now)
  if (!parts) throw new StatsWindowError('时间无效')
  return parts.date
}

/** 近 7 日：截至上海昨日的完整七日，两端都包含。 */
export function recentInclusiveWindow(now = Date.now()): { start: string; end: string } {
  const today = shanghaiToday(now)
  const end = addDays(today, -1)
  const start = addDays(end, -6)
  return { start, end }
}

export function shanghaiDayStartIso(day: string): string {
  if (!isRealDay(day)) throw new StatsWindowError('日期无效')
  return `${day}T00:00:00+08:00`
}

/** 界面结束日包含当天，请求用次日零点的排他边界。 */
export function inclusiveEndToExclusiveIso(day: string): string {
  return `${addDays(day, 1)}T00:00:00+08:00`
}

export function shanghaiWallIso(year: number, month: number, day: number, hour: number, minute: number, second: number): string {
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+08:00`
}

export function shanghaiNowIso(now = Date.now()): string {
  const parts = shanghaiParts(now)
  if (!parts) throw new StatsWindowError('时间无效')
  return shanghaiWallIso(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second)
}

export function makeStatsWindow(startDay: string, inclusiveEndDay: string): { from: string; to: string } {
  if (!isRealDay(startDay) || !isRealDay(inclusiveEndDay)) throw new StatsWindowError('日期无效')
  if (inclusiveEndDay < startDay) throw new StatsWindowError('结束日期不能早于开始日期')
  const to = addDays(inclusiveEndDay, 1)
  const span = daysBetween(startDay, to)
  if (span < 1) throw new StatsWindowError('区间至少 1 日')
  if (span > STATS_MAX_DAYS) throw new StatsWindowError(`区间最多 ${STATS_MAX_DAYS} 日`)
  return { from: startDay, to }
}

export function derivePlanPhase(plan: PlanBounds, now: number): PlanPhase {
  const start = Date.parse(plan.starts_at)
  const end = plan.ends_at == null ? null : Date.parse(plan.ends_at)
  if (!Number.isFinite(now) || !Number.isFinite(start)) return 'invalid'
  if (end != null && !Number.isFinite(end)) return 'invalid'
  if (end != null && end <= start) return 'invalid'
  if (now < start) return 'pending'
  if (end == null || now < end) return 'active'
  return 'ended'
}

/** 结束时间恰为上海零点时，界面显示前一日；其他时刻保留真实时间。 */
export function formatPlanBound(iso: string, kind: 'start' | 'end'): string {
  const parsed = Date.parse(iso)
  const parts = shanghaiParts(parsed)
  if (!parts) return '日期异常'
  const midnight = parts.hour === 0 && parts.minute === 0 && parts.second === 0
  if (kind === 'end' && midnight) return addDays(parts.date, -1)
  if (midnight) return parts.date
  return `${parts.date} ${pad(parts.hour)}:${pad(parts.minute)}`
}

export function formatShanghaiClock(iso: string): string {
  const parts = shanghaiParts(Date.parse(iso))
  if (!parts) return '—'
  return `${pad(parts.month)}/${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`
}

export function formatShanghaiDayKey(iso: string): string {
  const parts = shanghaiParts(Date.parse(iso))
  if (!parts) return ''
  return parts.date
}

export function formatCoverage(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return '—'
  const rounded = Math.round(rate * 10) / 10
  if (Object.is(rounded, -0)) return '0%'
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`
}

export function roundCoverage(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

export function aggregateDailyCoverage(matrix: MatrixLike): DailyCoverage[] {
  return matrix.days.map((day) => {
    let totalN = 0
    let totalM = 0
    let anomaly = false
    let seen = 0
    for (const row of matrix.rows) {
      const cell = row.cells.find((item) => item.day === day)
      if (!cell || !Number.isFinite(cell.N) || !Number.isFinite(cell.M) || cell.N < 0 || cell.M < 0 || cell.M > cell.N) {
        anomaly = true
        if (cell && Number.isFinite(cell.N) && Number.isFinite(cell.M)) {
          totalN += cell.N
          totalM += cell.M
        }
        continue
      }
      seen += 1
      totalN += cell.N
      totalM += cell.M
    }
    if (matrix.rows.length > 0 && seen !== matrix.rows.length) anomaly = true
    if (anomaly) return { day, N: totalN, M: totalM, coverage_rate: null, anomaly: '数据异常' }
    if (totalN === 0) return { day, N: 0, M: 0, coverage_rate: null }
    return { day, N: totalN, M: totalM, coverage_rate: roundCoverage(totalM, totalN) }
  })
}

export function totalsMatch(
  overview: { total_M: number; total_N: number },
  matrix: { total_M: number; total_N: number },
): boolean {
  return overview.total_M === matrix.total_M && overview.total_N === matrix.total_N
}

export function isValidHm(value: string): boolean {
  return HM_RE.test(value)
}

export function normalizeDailyTimes(times: string[]): { ok: true; times: string[] } | { ok: false; error: string } {
  if (times.length === 0) return { ok: false, error: '请添加至少一个时点' }
  const seen = new Set<string>()
  for (const time of times) {
    if (!isValidHm(time)) return { ok: false, error: '时点需为 00:00–23:59' }
    if (seen.has(time)) return { ok: false, error: '时点不能重复' }
    seen.add(time)
  }
  return { ok: true, times: [...times].sort((a, b) => a.localeCompare(b)) }
}

export function taskTriggerText(taskType: string | null | undefined): string {
  if (taskType === 'MISSED_MEDICATION') return '连续3个到期时点未发现登记'
  return '待核查任务'
}

export function withDisambiguation<T extends { display_name: string; patient_code: string }>(
  patients: T[],
): (T & { label: string })[] {
  const counts = new Map<string, number>()
  for (const patient of patients) counts.set(patient.display_name, (counts.get(patient.display_name) ?? 0) + 1)
  return patients.map((patient) => ({
    ...patient,
    label: (counts.get(patient.display_name) ?? 0) > 1
      ? `${patient.display_name}（${patient.patient_code}）`
      : patient.display_name,
  }))
}

export function looksLikeDemo(values: Array<string | null | undefined>): boolean {
  return values.some((value) => value?.includes('DEMO'))
}

export function civilDate(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date, 12, 0, 0)
}

export function numbersToCivil(year: number, monthIndex: number, date: number): string {
  return `${year}-${pad(monthIndex + 1)}-${pad(date)}`
}

export function inShanghaiWindow(iso: string, fromDay: string, exclusiveToDay: string): boolean {
  const at = Date.parse(iso)
  const start = Date.parse(`${fromDay}T00:00:00+08:00`)
  const end = Date.parse(`${exclusiveToDay}T00:00:00+08:00`)
  return Number.isFinite(at) && at >= start && at < end
}
