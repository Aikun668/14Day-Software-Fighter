export interface MatrixCell {
  day: string
  N: number
  M: number
  missing: number
  coverage_rate: number | null
}

export interface MatrixRow {
  patient_id: string
  cells: MatrixCell[]
}

export interface MatrixResponse {
  days: string[]
  rows: MatrixRow[]
}

export interface DaySummary {
  N: number
  M: number
  missing: number
  rate: number | null
}

/** N=0 是无到期时点，不能并进「未发现登记」。 */
export type ScaleStatus = 'full' | 'partial' | 'miss' | 'none'

export const SCALE_STATUS_LABEL: Record<ScaleStatus, string> = {
  full: '全部登记',
  partial: '部分登记',
  miss: '未发现登记',
  none: '无到期时点',
}

export interface ScaleCell {
  day: string
  N: number
  M: number
  status: ScaleStatus
}

export type MatrixRead<T> = { ok: true; value: T } | { ok: false }

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function readRows(matrix: unknown): MatrixRow[] | null {
  if (!matrix || typeof matrix !== 'object') return null
  const rows = (matrix as { rows?: unknown }).rows
  if (!Array.isArray(rows)) return null
  for (const row of rows) {
    if (!row || typeof row !== 'object') return null
    const cells = (row as { cells?: unknown }).cells
    if (!Array.isArray(cells)) return null
    for (const cell of cells) {
      if (!cell || typeof cell !== 'object') return null
      const day = (cell as { day?: unknown }).day
      if (typeof day !== 'string' || !isCount((cell as { N?: unknown }).N) || !isCount((cell as { M?: unknown }).M)) {
        return null
      }
    }
  }
  return rows as MatrixRow[]
}

export function scaleStatus(N: number, M: number): ScaleStatus {
  if (N === 0) return 'none'
  if (M <= 0) return 'miss'
  if (M >= N) return 'full'
  return 'partial'
}

function summaryFrom(N: number, M: number): DaySummary {
  return {
    N,
    M,
    missing: N - M,
    rate: N > 0 ? Math.round((M / N) * 1000) / 10 : null,
  }
}

/**
 * 读取某一天的团队合计。
 * 形状不完整时返回 ok:false，调用方显示「不可用」，不能当成 N=0。
 * 合法但没有任何已到期时点时 N=0、rate=null，这是无到期，不是失败。
 */
export function readDaySummary(matrix: unknown, day: string): MatrixRead<DaySummary> {
  const rows = readRows(matrix)
  if (!rows) return { ok: false }
  let N = 0
  let M = 0
  for (const row of rows) {
    const cell = row.cells.find((item) => item.day === day)
    if (cell) {
      N += cell.N
      M += cell.M
    }
  }
  return { ok: true, value: summaryFrom(N, M) }
}

/** 按矩阵 days 的顺序汇总团队刻度。days 缺失或 rows 不可遍历时视为统计不可用。 */
export function readTeamScale(matrix: unknown): MatrixRead<ScaleCell[]> {
  const rows = readRows(matrix)
  if (!rows || !matrix || typeof matrix !== 'object') return { ok: false }
  const days = (matrix as { days?: unknown }).days
  if (!Array.isArray(days) || days.some((day) => typeof day !== 'string')) return { ok: false }
  const cells = days.map((day) => {
    let N = 0
    let M = 0
    for (const row of rows) {
      const cell = row.cells.find((item) => item.day === day)
      if (cell) {
        N += cell.N
        M += cell.M
      }
    }
    return { day, N, M, status: scaleStatus(N, M) }
  })
  return { ok: true, value: cells }
}

// 后端矩阵的 N 只含已到期时点（scheduled_at <= now），此处直接累加，不再二次过滤。
// 日期窗口不在这里计算。形状坏掉时抛出明确错误，避免调用方拿到一组假的 0。
export function summarizeDay(matrix: MatrixResponse, day: string): DaySummary {
  const read = readDaySummary(matrix, day)
  if (!read.ok) throw new TypeError('统计矩阵不可用')
  return read.value
}
