/** 侧栏导航线性图标：与 BrandMark 刻度尺同风格（1.6px 描边、圆头、currentColor） */

interface IconProps {
  className?: string
}

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
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

/** 工作台：仪表盘（半圆刻度 + 指针） */
export function IconWorkbench(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 16a8 8 0 1 1 16 0" />
      <path d="M12 16L15.5 9.5" />
      <path d="M4 19.5h16" />
    </Svg>
  )
}

/** 患者管理：人像 */
export function IconPatients(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 19.5c.6-3.6 3.3-5.6 6.5-5.6s5.9 2 6.5 5.6" />
    </Svg>
  )
}

/** 统计与核查：柱状图 */
export function IconStats(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 19.5v-15" />
      <path d="M4.5 19.5h15" />
      <path d="M9 19.5v-6" />
      <path d="M13.5 19.5v-9" />
      <path d="M18 19.5v-4" />
    </Svg>
  )
}

/** 随访中心：对话气泡 */
export function IconFollowups(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-8l-4 3.5V16.5H5A1.5 1.5 0 0 1 3.5 15V8A1.5 1.5 0 0 1 5 6.5z" />
      <path d="M8 10.5h8M8 13h5" />
    </Svg>
  )
}
