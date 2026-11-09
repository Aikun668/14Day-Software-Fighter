import type { ReactNode } from 'react'

export interface SurfaceProps {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

// 一层白底。调用方不要在 children 里再套 Surface。
export default function Surface({ title, actions, children }: SurfaceProps) {
  const headed = title != null || actions != null
  return (
    <section className="ml-surface">
      {headed && (
        <header className="ml-surface-head">
          {title != null && <h2 className="ml-surface-title">{title}</h2>}
          {actions != null && <div className="ml-surface-actions">{actions}</div>}
        </header>
      )}
      <div className="ml-surface-body">{children}</div>
    </section>
  )
}
