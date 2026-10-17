import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  meta?: ReactNode
  extra?: ReactNode
}

// 页标题（UI_DESIGN §5）：24px 墨色标题；右侧放日期或页面级操作
export default function PageHeader({ title, meta, extra }: PageHeaderProps) {
  return (
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
      {(meta || extra) && (
        <div className="page-header-side">
          {meta && <span className="page-meta">{meta}</span>}
          {extra}
        </div>
      )}
    </div>
  )
}
