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

// 后端矩阵的 N 只含已到期时点（scheduled_at <= now），此处直接累加，不再二次过滤。
export function summarizeDay(matrix: MatrixResponse, day: string): DaySummary {
  let N = 0
  let M = 0
  for (const row of matrix.rows) {
    const cell = row.cells.find((c) => c.day === day)
    if (cell) {
      N += cell.N
      M += cell.M
    }
  }
  return {
    N,
    M,
    missing: N - M,
    rate: N > 0 ? Math.round((M / N) * 1000) / 10 : null,
  }
}
