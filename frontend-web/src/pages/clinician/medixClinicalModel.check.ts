import {
  aggregateDailyCoverage,
  derivePlanPhase,
  formatPlanBound,
  inclusiveEndToExclusiveIso,
  isValidHm,
  makeStatsWindow,
  normalizeDailyTimes,
  recentInclusiveWindow,
  shanghaiDayStartIso,
  StatsWindowError,
  taskTriggerText,
} from './medixClinicalModel.ts'

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message)
}

function throws(fn: () => unknown) {
  try {
    fn()
    return false
  } catch (error) {
    return error instanceof StatsWindowError
  }
}

const start = '2026-11-10T00:00:00+08:00'
const futureEnd = '2026-11-20T00:00:00+08:00'
const nowMid = Date.parse('2026-11-15T08:00:00+08:00')

assert(derivePlanPhase({ starts_at: start, ends_at: futureEnd }, nowMid) === 'active', '未来结束仍应生效')
assert(derivePlanPhase({ starts_at: start, ends_at: null }, nowMid) === 'active', '无结束日应生效')
assert(derivePlanPhase({ starts_at: start, ends_at: futureEnd }, Date.parse('2026-11-09T23:00:00+08:00')) === 'pending', '未开始应为待生效')
assert(derivePlanPhase({ starts_at: start, ends_at: futureEnd }, Date.parse(futureEnd)) === 'ended', 'now=end 应为已结束')
assert(derivePlanPhase({ starts_at: start, ends_at: futureEnd }, Date.parse(futureEnd) - 1) === 'active', '结束前 1ms 仍生效')
assert(derivePlanPhase({ starts_at: futureEnd, ends_at: start }, nowMid) === 'invalid', '结束早于开始为异常')
assert(derivePlanPhase({ starts_at: 'bad', ends_at: null }, nowMid) === 'invalid', '非法日期为异常')

assert(formatPlanBound('2026-11-02T00:00:00+08:00', 'end') === '2026-11-01', '上海零点结束显示前一日')
assert(formatPlanBound('2026-11-02T08:30:00+08:00', 'end') === '2026-11-02 08:30', '非整点结束保留时刻')
assert(formatPlanBound('2026-11-10T00:00:00+08:00', 'start') === '2026-11-10', '开始日显示当天')
assert(shanghaiDayStartIso('2026-11-10') === '2026-11-10T00:00:00+08:00', '开始日为零点')
assert(inclusiveEndToExclusiveIso('2026-11-10') === '2026-11-11T00:00:00+08:00', '同日结束转成 24 小时')

const week = makeStatsWindow('2026-11-02', '2026-11-08')
assert(week.from === '2026-11-02' && week.to === '2026-11-09', '11/02—11/08 排他次日')
assert(makeStatsWindow('2026-11-02', '2026-11-02').to === '2026-11-03', '1 日可查')
const day92Start = '2026-01-01'
const day92End = '2026-04-02'
assert(makeStatsWindow(day92Start, day92End).to === '2026-04-03', '92 日可查')
assert(throws(() => makeStatsWindow('2026-01-01', '2026-04-03')), '93 日拒绝')
assert(throws(() => makeStatsWindow('2026-11-08', '2026-11-02')), '结束早于开始拒绝')
assert(throws(() => makeStatsWindow('2026-02-31', '2026-03-01')), '非法日期拒绝')

const shanghaiNoonBefore = Date.parse('2026-11-08T15:30:00Z')
const before = recentInclusiveWindow(shanghaiNoonBefore)
assert(before.start === '2026-11-01' && before.end === '2026-11-07', '上海 11/08 23:30 的近 7 日')
const shanghaiMorning = Date.parse('2026-11-08T16:30:00Z')
const after = recentInclusiveWindow(shanghaiMorning)
assert(after.start === '2026-11-02' && after.end === '2026-11-08', '上海 11/09 00:30 的近 7 日')

const mixed = aggregateDailyCoverage({
  days: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'],
  rows: [
    {
      cells: [
        { day: '2026-11-02', N: 1, M: 1 },
        { day: '2026-11-03', N: 0, M: 0 },
        { day: '2026-11-04', N: 2, M: 0 },
        { day: '2026-11-05', N: 2, M: 3 },
      ],
    },
    {
      cells: [
        { day: '2026-11-02', N: 9, M: 1 },
        { day: '2026-11-03', N: 0, M: 0 },
        { day: '2026-11-04', N: 0, M: 0 },
        { day: '2026-11-05', N: 0, M: 0 },
      ],
    },
  ],
})
assert(mixed[0].N === 10 && mixed[0].M === 2 && mixed[0].coverage_rate === 20, '1/1 与 1/9 合计 20%')
assert(mixed[1].coverage_rate === null && !mixed[1].anomaly, 'N=0 为 null')
assert(mixed[2].N === 2 && mixed[2].M === 0 && mixed[2].coverage_rate === 0, 'M=0 且 N>0 为 0%')
assert(mixed[3].anomaly === '数据异常' && mixed[3].coverage_rate === null, 'M>N 为数据异常')

assert(isValidHm('08:00') && isValidHm('23:59') && isValidHm('00:00'), '合法时点')
assert(!isValidHm('25:70') && !isValidHm('24:00') && !isValidHm('8:00'), '非法时点')
assert(normalizeDailyTimes([]).ok === false, '空时点拒绝')
assert(normalizeDailyTimes(['08:00', '08:00']).ok === false, '重复时点拒绝')
const sorted = normalizeDailyTimes(['20:00', '08:00'])
assert(sorted.ok && sorted.times.join(',') === '08:00,20:00', '时点排序')

assert(taskTriggerText('MISSED_MEDICATION') === '连续3个到期时点未发现登记', '已知类型说明')
assert(taskTriggerText(undefined) === '待核查任务', '未知类型不套用 3 次')
assert(taskTriggerText('OTHER') === '待核查任务', '其他类型不虚构原因')

console.log('medixClinicalModel.check: ok')
