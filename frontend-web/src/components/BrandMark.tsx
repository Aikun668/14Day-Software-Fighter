interface BrandMarkProps {
  size?: number
}

// 品牌标记：一把横放的刻度尺，对应「刻度」方向（UI_DESIGN §1）
export default function BrandMark({ size = 24 }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect width="24" height="24" rx="7" fill="#5B7CFF" />
      <path
        d="M5 15h14M5 15v-4M9.5 15v-2.5M12 15v-6M14.5 15v-2.5M19 15v-4"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}
