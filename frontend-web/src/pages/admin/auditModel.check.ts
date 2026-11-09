import {
  categoryOf,
  foldAuditPages,
  loadAuditWindow,
  summarizeAudit,
  type AuditEvent,
  type AuditPage,
} from './auditModel.ts'

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message)
}

function event(id: string, created_at: string, action = 'GUIDE_CREATE'): AuditEvent {
  return {
    id,
    created_at,
    action,
    resource_type: 'device_guide',
    resource_id: id,
    actor_id: 'actor',
    detail: { version: '1.0' },
  }
}

function page(items: AuditEvent[], total: number): AuditPage {
  return { items, total }
}

const start = '2026-11-02'
const end = '2026-11-08'

const ordered = Array.from({ length: 101 }, (_, index) => {
  const day = 8 - Math.floor(index / 20)
  const hour = 20 - (index % 20)
  return event(
    `e${index}`,
    `2026-11-0${day}T${String(hour).padStart(2, '0')}:00:00+08:00`,
    index % 5 === 0 ? 'GUIDE_REVIEW' : index % 5 === 1 ? 'GUIDE_PUBLISH' : index % 5 === 2 ? 'DEVICE_MODEL_CREATE' : 'GUIDE_CREATE',
  )
})

const first = foldAuditPages([page(ordered.slice(0, 100), 101)], start, end)
assert(first.complete === false && first.done === false, '只读到 100/101 不能算完整')
const both = foldAuditPages([page(ordered.slice(0, 100), 101), page(ordered.slice(100), 101)], start, end)
assert(both.complete && both.events.length === 101, '两页 101 条应完整且不丢')

const boundary = foldAuditPages([
  page([
    event('new', '2026-11-09T00:00:00+08:00'),
    event('edge', '2026-11-02T00:00:00+08:00'),
    event('old', '2026-11-01T23:59:00+08:00'),
  ], 3),
], start, end)
assert(boundary.complete, '边界页应完整')
assert(boundary.events.map((item) => item.id).join(',') === 'edge', '只保留起点，不含次日零点与更早')

const sameStamp = foldAuditPages([
  page([event('a', '2026-11-05T08:00:00+08:00'), event('b', '2026-11-05T08:00:00+08:00')], 4),
  page([event('c', '2026-11-05T08:00:00+08:00'), event('d', '2026-11-01T08:00:00+08:00')], 4),
], start, end)
assert(sameStamp.complete, '同时间戳跨页不能提前停')
assert(sameStamp.events.map((item) => item.id).join(',') === 'a,b,c', '同刻三条都保留，窗口外丢掉')

const early = foldAuditPages([
  page([event('in', '2026-11-04T08:00:00+08:00')], 80),
  page([event('before', '2026-11-01T08:00:00+08:00'), event('before2', '2026-11-01T07:00:00+08:00')], 80),
], start, end)
assert(early.complete && early.done && early.events.length === 1, '整页早于起点可以停止，且不计入')

const messy = foldAuditPages([
  page([
    event('late', '2026-11-03T08:00:00+08:00'),
    event('sooner', '2026-11-06T08:00:00+08:00'),
  ], 2),
], start, end)
assert(!messy.complete && messy.reason === 'unstable', '倒序被打乱不能当完整')

const dup = foldAuditPages([
  page([event('x', '2026-11-04T08:00:00+08:00')], 2),
  page([event('x', '2026-11-04T08:00:00+08:00')], 2),
], start, end)
assert(!dup.complete && dup.reason === 'unstable', '重复 id 视为不稳定')

const empty = foldAuditPages([page([], 0)], start, end)
assert(empty.complete && empty.events.length === 0, '零事件是完整空区间')

const capPages = Array.from({ length: 50 }, (_, pageNo) => page(
  Array.from({ length: 100 }, (__, index) => event(`p${pageNo}-${index}`, '2026-11-08T12:00:00+08:00')),
  6000,
))
const capped = foldAuditPages(capPages, start, end, { truncated: true })
assert(!capped.complete && capped.reason === 'incomplete', '触达 5000 上限不能画全量')

const failed = foldAuditPages([page([event('kept', '2026-11-04T08:00:00+08:00')], 10)], start, end, { failed: true })
assert(!failed.complete && failed.reason === 'failed' && failed.events.length === 1, '中途失败保留已读但不完整')

assert(categoryOf('GUIDE_REVIEW') === 'review', '审核类别')
assert(categoryOf('KNOWLEDGE_PUBLISH') === 'publish', '发布类别')
assert(categoryOf('DEVICE_MODEL_CREATE') === 'model', '型号类别')
assert(categoryOf('USER_DISABLE') === 'other', '未核实的账号动作不能算账号管理')
assert(categoryOf('PATIENT_ACCOUNT_BIND') === 'other', '患者绑定归其他')

const summary = summarizeAudit(both.events, start, end, 'all')
const daySum = summary.days.reduce((sum, day) => sum + day.count, 0)
const groupSum = summary.groups.reduce((sum, group) => sum + group.count, 0)
assert(summary.total === 101 && daySum === 101 && groupSum === 101, '合计、逐日、分类必须相等')
assert(summary.groups.every((group) => group.category !== 'account'), '没有账号审计时不显示账号分类')
assert(summary.days[0].day === start && summary.days[summary.days.length - 1].day === end, '区间两端都在')
assert(summary.days.find((day) => day.day === '2026-11-02')?.count === 0, '没有事件的日子在完整区间记 0')

const onlyReview = summarizeAudit(both.events, start, end, 'review')
assert(onlyReview.visibleEvents.every((item) => item.action === 'GUIDE_REVIEW'), '筛选只留审核')
assert(onlyReview.total === onlyReview.days.reduce((sum, day) => sum + day.count, 0), '筛选后仍守恒')

const badTime = summarizeAudit([
  event('ok', '2026-11-04T08:00:00+08:00'),
  event('bad', 'not-a-time'),
], start, end, 'all')
assert(badTime.total === 1 && badTime.anomalies.length === 1, '时间异常不进某一天')

const cross = summarizeAudit([
  event('late-sh', '2026-11-08T23:30:00+08:00'),
  event('utc-next', '2026-11-08T16:30:00Z'),
], start, end, 'all')
assert(cross.visibleEvents.map((item) => item.id).join(',') === 'late-sh', '上海次日零点之后不计入 11-08')

const pages101: AuditPage[] = [page(ordered.slice(0, 100), 101), page(ordered.slice(100), 101)]
let calls = 0
const loaded = await loadAuditWindow(start, end, async (pageNo) => {
  calls += 1
  return pages101[pageNo - 1] ?? page([], 101)
}, new AbortController().signal, Date.parse('2026-11-09T08:00:00+08:00'))
assert(loaded.complete && loaded.events.length === 101 && calls === 2, '加载器按页读完')
assert(loaded.readAt.startsWith('2026-11-09T08:00:00+08:00'), '读取时间按上海时刻')

let unstableCalls = 0
const unstable = await loadAuditWindow(start, end, async () => {
  unstableCalls += 1
  return page([event('x', '2026-11-04T08:00:00+08:00'), event('x', '2026-11-04T08:00:00+08:00')], 2)
}, new AbortController().signal)
assert(!unstable.complete && unstable.reason === 'unstable' && unstableCalls === 2, '不稳定只重取一轮')

console.log('auditModel.check: ok')
