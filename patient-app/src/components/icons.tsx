// 统一图标库：线性 SVG，stroke 跟随 currentColor（尺寸默认 24）
// 用途：替换界面中的 emoji 图标，保证配色一致、缩放清晰、语义可访问。

interface IconProps {
  size?: number
  color?: string
  strokeWidth?: number
}

const base = (size: number, color: string | undefined, strokeWidth: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color || 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

/** 今日（首页） */
export function IconHome({ size = 24, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  )
}

/** 指导（书） */
export function IconBook({ size = 24, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z" />
      <path d="M8.5 7.5h6" />
    </svg>
  )
}

/** 记录（药） */
export function IconPill({ size = 24, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <rect x="2.5" y="8.5" width="19" height="7" rx="3.5" />
      <path d="M12 8.5v7" />
    </svg>
  )
}

/** 自检（勾选框） */
export function IconCheck({ size = 24, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="m8 12 2.8 2.8L16.5 9" />
    </svg>
  )
}

/** AI 助手（对话） */
export function IconChat({ size = 24, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <path d="M20.5 12a7.5 7.5 0 0 1-7.5 7.5H8.6L4 21.5l1.2-4.1A7.5 7.5 0 1 1 20.5 12z" />
      <path d="M9 11.5h6M9 14.5h3.5" />
    </svg>
  )
}

/** 提醒（铃） */
export function IconBell({ size = 24, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M10.3 20a2 2 0 0 0 3.4 0" />
    </svg>
  )
}

/** 复训（循环箭头） */
export function IconRetrain({ size = 24, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <path d="M20 11a8 8 0 0 0-14-4.5" />
      <path d="M4 13a8 8 0 0 0 14 4.5" />
      <path d="M6 3v4h4M18 21v-4h-4" />
    </svg>
  )
}

/** 随访（清单） */
export function IconClipboard({ size = 24, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <rect x="5" y="4.5" width="14" height="16" rx="2.5" />
      <path d="M9 4.5V3.5h6v1" />
      <path d="M9 10h6M9 14h4" />
    </svg>
  )
}

/** 提示（三角感叹号） */
export function IconAlert({ size = 24, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  )
}

/** 右箭头（列表项） */
export function IconChevronRight({ size = 24, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  )
}

/** 左箭头（返回） */
export function IconChevronLeft({ size = 24, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  )
}
