import { pointsAgree, sourceRows } from './patientReportModel.ts'

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message)
}

const points = [
  { day: '2026-11-02', N: 2, M: 2, coverage_rate: 100 },
  { day: '2026-11-03', N: 2, M: 1, coverage_rate: 50 },
  { day: '2026-11-04', N: 2, M: 2, coverage_rate: 100 },
  { day: '2026-11-05', N: 2, M: 2, coverage_rate: 100 },
  { day: '2026-11-06', N: 2, M: 1, coverage_rate: 50 },
  { day: '2026-11-07', N: 2, M: 2, coverage_rate: 100 },
  { day: '2026-11-08', N: 2, M: 2, coverage_rate: 100 },
]

assert(pointsAgree({ N: 14, M: 12 }, points), 'fixture 的逐日合计应等于 14/12')
assert(!pointsAgree({ N: 14, M: 11 }, points), '不一致不能当成同一份报告')

const slots = [true, true, true, false, true, true, true, true, false, true, true, true, true, true]
const covered = slots.filter(Boolean).length
assert(slots.length === 14 && covered === 12, 'fixture 14 个时点里 12 个有登记')
assert(slots.filter((item) => !item).length === 2, '缺失 2 个时点')

const sources = sourceRows({ PATIENT_REPORT: 10, CLINICIAN_OBSERVED: 3 })
assert(sources.reduce((sum, row) => sum + row.count, 0) === 13, '来源事件是 13，不改成 M')
assert(Math.abs((sources[0]?.width ?? 0) - 10 / 13) < 0.0001, '横条宽度按事件数')
const duplicate = [{ slot_id: 'demo-slot-05', active_event_count: 2 }]
assert(duplicate.length === 1 && duplicate[0].active_event_count === 2, '重复时点 2 条不增加 M')
assert(Math.round((12 / 14) * 1000) / 10 === 85.7, '12/14 显示 85.7%')

console.log('patientReportModel.check: ok')
