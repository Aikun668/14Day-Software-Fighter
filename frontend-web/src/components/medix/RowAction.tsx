import type { ReactNode } from 'react'
import { Tooltip } from 'antd'

export interface RowActionProps {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
}

export default function RowAction({ label, icon, onClick, disabled }: RowActionProps) {
  return (
    <Tooltip title={label}>
      <span className="ml-row-action-wrap" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="ml-row-action"
          aria-label={label}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation()
            if (!disabled) onClick()
          }}
        >
          {icon}
        </button>
      </span>
    </Tooltip>
  )
}
