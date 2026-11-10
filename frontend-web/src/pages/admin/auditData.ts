import { apiFetch } from '../../api/client'
import { addDays, midnight, type PageResult } from '../../components/medix/clinical'
export interface AuditEvent { id: string; actor_id: string | null; action: string; resource_type: string; resource_id: string; detail: Record<string, unknown> | null; created_at: string }
export const auditKinds = [
  { key: 'review', label: '内容审核', color: '#AE91E9' },
  { key: 'publish', label: '内容发布', color: '#58BFA6' },
  { key: 'model', label: '型号维护', color: '#F0B475' },
  { key: 'other', label: '其他', color: '#8EA0B8' },
]
export function eventKind(action: string) {
  if (['GUIDE_REVIEW', 'KNOWLEDGE_REVIEW'].includes(action)) return 'review'
  if (['GUIDE_PUBLISH', 'KNOWLEDGE_PUBLISH'].includes(action)) return 'publish'
  return action === 'DEVICE_MODEL_CREATE' ? 'model' : 'other'
}
export function actionLabel(action: string) {
  const labels: Record<string, string> = { GUIDE_REVIEW: '审核指导', KNOWLEDGE_REVIEW: '审核知识', GUIDE_PUBLISH: '发布指导', KNOWLEDGE_PUBLISH: '发布知识', DEVICE_MODEL_CREATE: '新增型号', GUIDE_CREATE: '创建指导', KNOWLEDGE_CREATE: '创建知识', PATIENT_CREATE: '患者建档', PATIENT_ACCOUNT_BIND: '绑定患者账号', PLAN_CREATE: '创建计划', PLAN_REVISION: '修订计划', MEDICATION_RECORD: '用药登记', MEDICATION_REVOKE: '撤销登记', FOLLOWUP_CREATE: '记录随访', TASK_CREATE: '生成核查任务', DEVICE_BIND: '绑定装置' }
  return labels[action] ?? action
}
export interface AuditResult { events: AuditEvent[]; complete: boolean; reason: string; asOf: string; requests: number }
export async function readAuditRange(start: string, end: string, signal: AbortSignal): Promise<AuditResult> {
  const from = Date.parse(midnight(start)), to = Date.parse(midnight(addDays(end, 1)))
  const inRange = (e: AuditEvent) => !Number.isFinite(Date.parse(e.created_at)) || (Date.parse(e.created_at) >= from && Date.parse(e.created_at) < to)
  for (let attempt = 0; attempt < 2; attempt++) {
    const asOf = new Date().toISOString(), map = new Map<string, AuditEvent>()
    let total = -1, previous = Infinity, unstable = false, invalidTime = false, complete = false, requests = 0
    let first: PageResult<AuditEvent> | undefined, last: PageResult<AuditEvent> | undefined, lastPage = 0
    const get = async (page: number) => { signal.throwIfAborted(); requests++; return apiFetch<PageResult<AuditEvent>>(`/api/admin/audit-logs?page=${page}&page_size=100`, { signal }) }
    const result = (reason: string): AuditResult => ({ events: [...map.values()].filter(inRange), complete: complete && !unstable && !invalidTime && !reason, reason, asOf, requests })
    try {
      // At most 50 requests/round: reserve two reads for first/last page validation.
      // 4800 unique rows is intentionally below the specified 5000-row ceiling.
      for (let page = 1; page <= 48; page++) {
        const response = await get(page)
        if (!first) { first = response; total = response.total }
        if (total !== response.total) unstable = true
        if (response.items.length !== Math.max(0, Math.min(100, response.total - (page - 1) * 100))) unstable = true
        last = response; lastPage = page
        for (const item of response.items) {
          const time = Date.parse(item.created_at)
          if (!Number.isFinite(time)) invalidTime = true
          else { if (time > previous) unstable = true; previous = time }
          if (map.has(item.id)) unstable = true
          map.set(item.id, item)
        }
        const oldPage = response.items.length > 0 && response.items.every(e => Number.isFinite(Date.parse(e.created_at)) && Date.parse(e.created_at) < from)
        if (page * 100 >= total || oldPage) { complete = true; break }
        if (!response.items.length) { unstable = true; break }
      }
      if (!complete) return result('区间数据未完整读取，请缩小日期范围')
      const fingerprint = (r: PageResult<AuditEvent>) => JSON.stringify({ total: r.total, items: r.items.map(e => [e.id, e.created_at]) })
      const head = await get(1), tail = lastPage === 1 ? head : await get(lastPage)
      if (fingerprint(head) !== fingerprint(first!) || fingerprint(tail) !== fingerprint(last!)) unstable = true
      if (invalidTime) return result('存在时间异常，区间统计不可用')
      if (unstable) { if (attempt === 0) continue; return result('数据更新中，请刷新') }
      return result('')
    } catch (e) {
      if (signal.aborted) throw e
      return result('区间数据未完整读取，请重试或缩小日期范围')
    }
  }
  throw new Error('区间数据不可用')
}
const auditDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
export function auditDay(e: AuditEvent) { return Number.isFinite(Date.parse(e.created_at)) ? auditDayFormatter.format(new Date(e.created_at)) : '时间异常' }
const sensitive = /password|passwd|token|secret|authorization|cookie|密码|密钥/i
export function redactDetail(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactDetail)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sensitive.test(k) ? '已隐藏' : redactDetail(v)]))
  return value
}

