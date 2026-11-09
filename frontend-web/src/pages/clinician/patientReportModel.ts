export interface ReportPoint {
  day: string
  N: number
  M: number
  coverage_rate: number | null
}

export function pointsAgree(stats: { N: number; M: number }, points: ReportPoint[]) {
  const totalN = points.reduce((sum, point) => sum + point.N, 0)
  const totalM = points.reduce((sum, point) => sum + point.M, 0)
  return totalN === stats.N && totalM === stats.M
}

export function sourceRows(breakdown: Record<string, number>) {
  const entries = Object.entries(breakdown).filter(([, count]) => Number.isFinite(count) && count >= 0)
  const sum = entries.reduce((total, [, count]) => total + count, 0)
  return entries.map(([source, count]) => ({
    source,
    count,
    width: sum === 0 ? 0 : count / sum,
  }))
}

export function sourceName(source: string) {
  if (source === 'PATIENT_REPORT') return '患者自述'
  if (source === 'CLINICIAN_OBSERVED') return '医护观察'
  return source
}

export function sourceTone(source: string) {
  if (source === 'PATIENT_REPORT') return 'patient'
  if (source === 'CLINICIAN_OBSERVED') return 'clinician'
  return 'other'
}
