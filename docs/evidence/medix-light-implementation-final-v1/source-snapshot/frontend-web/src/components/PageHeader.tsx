import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  /** 页面用途的一行说明（灰色副标题，位于大标题下方） */
  subtitle?: string
  meta?: ReactNode
  extra?: ReactNode
}

// 页标题：24px 墨色 + 灰色副标题；右侧放日期或页面级操作
export default function PageHeader({ title, subtitle, meta, extra }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {(meta || extra) && (
        <div className="page-header-side">
          {meta && <span className="page-meta">{meta}</span>}
          {extra}
        </div>
      )}
    </div>
  )
}
