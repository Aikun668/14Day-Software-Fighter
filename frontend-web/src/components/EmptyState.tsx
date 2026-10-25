import type { ReactNode } from 'react'

/**
 * 呼吸波纹：品牌母题（吸入治疗 = 呼吸节律），空状态的唯一装饰。
 * 三段缓波 + 波谷刻度点，中段用品牌紫点睛。
 */
function BreathWave() {
  return (
    <svg
      className="breath-wave"
      width={168}
      height={44}
      viewBox="0 0 168 44"
      aria-hidden="true"
      focusable="false"
    >
      {/* 波形：呼——吸——呼 */}
      <path
        d="M12 30 Q 30 8, 48 30 T 84 30 T 120 30 T 156 30"
        fill="none"
        stroke="var(--line)"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* 波谷刻度点：中间一枚品牌紫，呼应「刻度」品牌标记 */}
      <circle cx={48} cy={30} r={2.4} fill="var(--line)" />
      <circle cx={84} cy={30} r={3} fill="var(--brand)" />
      <circle cx={120} cy={30} r={2.4} fill="var(--line)" />
      {/* 底部基线：呼吸机的平稳节律 */}
      <path d="M12 40h144" stroke="var(--line-soft)" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

interface Props {
  /** 一句话说明“现在是什么状态” */
  title: string
  /** 指引下一步动作（给方向，不渲染情绪） */
  hint?: string
  /** 可选的操作区（按钮等） */
  action?: ReactNode
}

/** 空状态：呼吸波纹 + 状态说明 + 方向指引，替代干瘪的一行灰字 */
export default function EmptyState({ title, hint, action }: Props) {
  return (
    <div className="empty-state">
      <BreathWave />
      <p className="empty-state-title">{title}</p>
      {hint && <p className="empty-state-hint">{hint}</p>}
      {action}
    </div>
  )
}
