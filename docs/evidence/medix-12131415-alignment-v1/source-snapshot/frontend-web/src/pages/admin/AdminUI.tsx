import { type ReactNode } from 'react'
import { Button, Pagination } from 'antd'
import { safeHttp } from './adminState'
export function ReviewStatus({ value }: { value: string }) {
  const label: Record<string, string> = { DRAFT: '草稿', REVIEWED: '已审核', PUBLISHED: '已发布' }
  return <span className={`ml-review-status is-${value.toLowerCase()}`}>{label[value] ?? value}</span>
}
export function AdminPager({ page, total, onChange, disabled }: { page: number; total: number; onChange: (page: number) => void; disabled?: boolean }) {
  return total > 20 ? <div className="ml-table-footer"><span>共 {total} 条</span><Pagination current={page} total={total} pageSize={20} showSizeChanger={false} disabled={disabled} onChange={onChange} /></div> : null
}
export function SourceLink({ value, title }: { value?: string | null; title?: string | null }) {
  if (!value && !title) return null
  const href = safeHttp(value)
  return <p className="ml-admin-source">{title && <span>{title} </span>}{href ? <a href={href} target="_blank" rel="noopener noreferrer">查看来源</a> : value ? <span>来源链接不可用</span> : null}</p>
}
export function ActionError({ error, blocked, verify, busy }: { error: string; blocked: boolean; verify?: () => void; busy: boolean }) {
  return error ? <div className="ml-admin-error" role="alert">{error}{blocked && verify && <Button type="link" disabled={busy} onClick={verify}>读取核对</Button>}</div> : null
}
export function ReadMeta({ children }: { children: ReactNode }) { return <div className="ml-content-meta">{children}</div> }

