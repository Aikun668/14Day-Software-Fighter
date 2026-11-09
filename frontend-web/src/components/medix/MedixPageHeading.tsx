import type { ReactNode } from 'react'

export interface MedixPageHeadingProps {
  title: string
  actions?: ReactNode
  date?: ReactNode
}

export default function MedixPageHeading({ title, actions, date }: MedixPageHeadingProps) {
  return (
    <div className="ml-heading">
      <div className="ml-heading-main">
        <h1>{title}</h1>
        {date != null && <span className="ml-heading-date">{date}</span>}
      </div>
      {actions != null && <div className="ml-heading-actions">{actions}</div>}
    </div>
  )
}
