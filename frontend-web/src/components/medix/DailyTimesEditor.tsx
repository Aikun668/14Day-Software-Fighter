import { useState } from 'react'
import { TimePicker } from 'antd'
import dayjs from 'dayjs'
import { isValidHm } from '../../pages/clinician/medixClinicalModel.ts'

interface Props {
  value: string[]
  onChange: (times: string[]) => void
  disabled?: boolean
  error?: string | null
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" strokeLinecap="round" />
    </svg>
  )
}

export default function DailyTimesEditor({ value, onChange, disabled, error }: Props) {
  const [localError, setLocalError] = useState<string | null>(null)

  const addTime = (raw: string) => {
    const hm = raw.trim()
    if (!hm) return
    if (!isValidHm(hm)) {
      setLocalError('时点需为 00:00–23:59')
      return
    }
    if (value.includes(hm)) {
      setLocalError('时点不能重复')
      return
    }
    setLocalError(null)
    onChange([...value, hm].sort((a, b) => a.localeCompare(b)))
  }

  const shown = error || localError

  return (
    <div className="ml-times">
      <div className="ml-time-row">
        {value.map((time) => (
          <span key={time} className="ml-time-chip">
            <ClockIcon />
            <span>{time}</span>
            <button
              type="button"
              aria-label={`移除 ${time}`}
              disabled={disabled}
              onClick={() => {
                setLocalError(null)
                onChange(value.filter((item) => item !== time))
              }}
            >
              ×
            </button>
          </span>
        ))}
        <TimePicker
          className="ml-time-add"
          format="HH:mm"
          value={null}
          placeholder="添加时点"
          disabled={disabled}
          allowClear={false}
          needConfirm={false}
          showNow={false}
          onChange={(next) => {
            if (!next || !next.isValid()) return
            addTime(next.format('HH:mm'))
          }}
          onBlur={(event) => {
            const raw = (event.target as HTMLInputElement | null)?.value?.trim() ?? ''
            if (!raw || raw === '添加时点') return
            if (!isValidHm(raw)) setLocalError('时点需为 00:00–23:59')
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            const raw = (event.target as HTMLInputElement | null)?.value?.trim() ?? ''
            if (!raw) return
            event.preventDefault()
            event.stopPropagation()
            addTime(raw)
          }}
          disabledTime={() => ({})}
          defaultOpenValue={dayjs('2000-01-01 08:00')}
        />
      </div>
      {shown ? <span className="ml-field-error" role="alert">{shown}</span> : null}
    </div>
  )
}
