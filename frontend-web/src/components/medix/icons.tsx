import type { ReactNode } from 'react'

interface IconProps {
  className?: string
}

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  )
}

export function IconPerson(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c.7-3.4 3.2-5.2 6.5-5.2s5.8 1.8 6.5 5.2" />
    </Svg>
  )
}

export function IconClipboard(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="4.5" width="12" height="15" rx="2" />
      <path d="M9 4.5h6v2.2H9z" />
      <path d="M9 11h6M9 14.5h4" />
    </Svg>
  )
}

export function IconPencil(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13.5 6.5 17.5 10.5 8 20H4v-4z" />
      <path d="M12 8 16 12" />
    </Svg>
  )
}

export function IconCheckSquare(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="2" />
      <path d="M8 12.2 10.8 15 16 9.2" />
    </Svg>
  )
}

export function IconDetail(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="3.5" width="12" height="17" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </Svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12.5 10 17.5 19 7.5" strokeWidth="2.4" />
    </Svg>
  )
}

export function IconDash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 12h12" strokeWidth="2.4" />
    </Svg>
  )
}

export function IconPartial(props: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={props.className}>
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 5a7 7 0 0 1 0 14z" fill="currentColor" />
    </svg>
  )
}

export function IconCaret(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 10l5 5 5-5" />
    </Svg>
  )
}
