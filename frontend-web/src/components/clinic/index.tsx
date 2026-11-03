// Clinic Comfort 共享层：全站医护 Web 的视觉积木（DESIGN.md）。
// 这里只定「结构」——几列、间距、等高；「内容」由各页面自己决定。
// 用法：工作台、患者详情、统计、随访都可以直接用同一套积木，不会各写各的。
import type { ReactNode } from 'react'

/* ── Hero：留白问候区。故意只放一句说明 + 一个主操作 ── */

export interface HeroAction {
  key: string
  label: string
  onClick: () => void
}

interface HeroBarProps {
  /** 日期眉题，如 "Tuesday · Nov 3 · 系统正常" */
  eyebrow: ReactNode
  /** 大标题问候语 */
  title: ReactNode
  /** 一行说明，不堆编号与方案标签 */
  sub?: ReactNode
  /** 右侧操作区：每屏最多一颗实心主按钮，其余走「更多」 */
  actions?: ReactNode
}

export function HeroBar({ eyebrow, title, sub, actions }: HeroBarProps) {
  return (
    <header className="cc-hero">
      <div>
        <p className="cc-eyebrow">{eyebrow}</p>
        <h1 className="cc-title">{title}</h1>
        {sub ? <p className="cc-sub">{sub}</p> : null}
      </div>
      {actions ? <div className="cc-hero-actions">{actions}</div> : null}
    </header>
  )
}

/* ── 摘要卡带：第一层，最多四张 ── */

export interface StatItem {
  key: string
  label: string
  value: ReactNode
  /** 底部小字说明 */
  meta?: ReactNode
  /** 暖色提示（非惩罚色），如「需处理」 */
  warn?: boolean
  /** 值为文字而非数字时用稍小的字号 */
  words?: boolean
}

interface StatBandProps {
  items: StatItem[]
  /** 无障碍标签 */
  label?: string
}

export function StatBand({ items, label }: StatBandProps) {
  if (items.length === 0) return null
  return (
    <section className="cc-stats" aria-label={label}>
      {items.map((item) => (
        <article className="cc-stat" key={item.key}>
          <p className="cc-stat-label">{item.label}</p>
          <p className={item.words ? 'cc-stat-value words' : 'cc-stat-value'}>{item.value}</p>
          {item.meta ? (
            <p className={item.warn ? 'cc-stat-meta warn' : 'cc-stat-meta'}>{item.meta}</p>
          ) : null}
        </article>
      ))}
    </section>
  )
}

/* ── 内容卡：白底圆卡，卡头左标题右提示 ── */

interface CardProps {
  title: ReactNode
  /** 卡头右侧的辅助说明 */
  hint?: ReactNode
  /** 卡片 id，便于锚点跳转 */
  id?: string
  children: ReactNode
}

export function Card({ title, hint, id, children }: CardProps) {
  return (
    <section className="cc-card" id={id}>
      <div className="cc-card-h">
        <h2>{title}</h2>
        {hint ? <span className="hint">{hint}</span> : null}
      </div>
      {children}
    </section>
  )
}

/* ── 双栏：第二层只有这一种布局，左主右次，同排等高 ── */

interface TwoColumnProps {
  /** 左栏（主） */
  children: ReactNode
  /** 右栏（次） */
  aside: ReactNode
}

export function TwoColumn({ children, aside }: TwoColumnProps) {
  return (
    <div className="cc-split">
      {children}
      {aside}
    </div>
  )
}

/* ── 需关注：少而准（默认两条级），淡底行 + 芯片 ── */

export interface AttentionItem {
  key: string
  /** 方形图标里的一个字，如「绑」「覆」 */
  mark: string
  /** 图标与整体色调：warn = 待处理，info = 中性提示 */
  tone: 'warn' | 'info'
  title: string
  detail: string
  /** 右侧芯片文字 */
  chip: string
  chipTone: 'warn' | 'blue'
  /** 给了就渲染成可点按钮 */
  onClick?: () => void
}

interface AttentionPanelProps {
  items: AttentionItem[]
  /** 卡头右侧显示的条数 */
  count?: number
}

export function AttentionPanel({ items, count }: AttentionPanelProps) {
  return (
    <Card title="需关注" hint={`${count ?? items.length} 项`}>
      <div className="cc-attn">
        {items.map((item) => {
          const body = (
            <>
              <div className={`cc-attn-ico ${item.tone}`} aria-hidden="true">{item.mark}</div>
              <div className="cc-attn-body">
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
              <span className={`cc-chip ${item.chipTone}`}>{item.chip}</span>
            </>
          )
          return item.onClick ? (
            <button key={item.key} type="button" className="cc-attn-row" onClick={item.onClick}>
              {body}
            </button>
          ) : (
            <div key={item.key} className="cc-attn-row">{body}</div>
          )
        })}
      </div>
    </Card>
  )
}

/* ── 刻度：产品签名件。软蓝已登记 / 浅灰未发现登记 / 未到时点描边 ── */

export type ScaleCellKind = 'ok' | 'miss' | 'pending' | 'none'

export interface ScaleDay {
  key: string
  /** 顶部大数字，如 3 */
  date: string
  /** 星期字，如 二 */
  weekday: string
}

export interface ScaleSlot {
  key: string
  /** 行首时点文字，如 08:00 */
  label: string
  /** 与 days 一一对应的格子状态 */
  cells: { kind: ScaleCellKind; label: string }[]
}

interface TimeScaleProps {
  days: ScaleDay[]
  slots: ScaleSlot[]
  /** 无障碍描述 */
  ariaLabel?: string
}

export function TimeScale({ days, slots, ariaLabel }: TimeScaleProps) {
  return (
    <>
      <div className="cc-scale-wrap">
        <div className="cc-scale" aria-label={ariaLabel}>
          <div />
          {days.map((day) => (
            <div key={day.key} className="cc-scale-day">
              <strong>{day.date}</strong>
              {day.weekday}
            </div>
          ))}
          {slots.map((slot) => (
            <ScaleRow key={slot.key} slot={slot} />
          ))}
        </div>
      </div>
      <ul className="cc-legend">
        <li><i className="ok" aria-hidden="true" />已登记</li>
        <li><i className="miss" aria-hidden="true" />未发现登记</li>
      </ul>
    </>
  )
}

function ScaleRow({ slot }: { slot: ScaleSlot }) {
  return (
    <>
      <div className="cc-scale-slot">{slot.label}</div>
      {slot.cells.map((cell, index) => (
        <div
          key={`${slot.key}-${index}`}
          className={cell.kind === 'none' ? 'cc-cell' : `cc-cell ${cell.kind}`}
          title={cell.label}
          aria-label={cell.label}
        />
      ))}
    </>
  )
}
