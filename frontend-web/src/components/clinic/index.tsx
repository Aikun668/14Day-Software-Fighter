// Clinic Comfort 共享层：全站医护 Web 的视觉积木（DESIGN.md）。
// 这里只定「结构」——几列、间距、等高；「内容」由各页面自己决定。
// 用法：工作台、患者详情、统计、随访都可以直接用同一套积木，不会各写各的。
import { Button, Dropdown } from 'antd'
import { useEffect, useState, type ReactNode } from 'react'

// 窄屏判定：与 CSS 里的 @media (max-width: 640px) 保持一致
function useIsNarrow(breakpoint = 640) {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${breakpoint}px)`).matches,
  )
  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const sync = () => setNarrow(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [breakpoint])
  return narrow
}

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
  /** 卡头标题；不放标题就不渲染卡头（如页签容器卡） */
  title?: ReactNode
  /** 卡头右侧的辅助说明 */
  hint?: ReactNode
  /** 卡片 id，便于锚点跳转 */
  id?: string
  children: ReactNode
}

export function Card({ title, hint, id, children }: CardProps) {
  return (
    <section className="cc-card" id={id}>
      {title ? (
        <div className="cc-card-h">
          <h2>{title}</h2>
          {hint ? <span className="hint">{hint}</span> : null}
        </div>
      ) : null}
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
      {/* 每栏各自包一层：一栏里可以放多张卡，卡与卡之间自动留 16px */}
      <div className="cc-split-col">{children}</div>
      <div className="cc-split-col">{aside}</div>
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

/* ── 行尾动作：所有行动行共用 ── */

export interface QueueRowAction {
  key: string
  label: string
  onClick: () => void
}

/* ── 筛选条：卡内一行的搜索 + 筛选 + 右侧操作 ── */

interface FilterBarProps {
  /** 左侧搜索框 */
  search?: ReactNode
  /** 中间的筛选项 */
  filters?: ReactNode
  /** 右侧操作 */
  actions?: ReactNode
}

export function FilterBar({ search, filters, actions }: FilterBarProps) {
  return (
    <div className="cc-filter-bar">
      {search ? <div className="cc-filter-search">{search}</div> : null}
      {filters ? <div className="cc-filter-items">{filters}</div> : null}
      {actions ? <div className="cc-filter-actions">{actions}</div> : null}
    </div>
  )
}

/* ── 患者行：列表里的一行病人，含编号、诊断标签与账号状态 ── */

export interface PatientRowItem {
  key: string
  /** 姓名/别名 */
  name: string
  /** 编号 */
  code: string
  /** 诊断标签 */
  diagnosis?: string | null
  /** 账号绑定状态 */
  account?: { bound: boolean; label: string }
  /** 行尾动作 */
  actions?: QueueRowAction[]
  /** 进详情 */
  onClick?: () => void
}

export function PatientRow({ item }: { item: PatientRowItem }) {
  const narrow = useIsNarrow()
  const condense = narrow && (item.actions?.length ?? 0) > 1
  const actionButtons = condense ? null : item.actions?.map((action) => (
    <Button
      key={action.key}
      size="small"
      className="cc-queue-action"
      onClick={(e) => { e.stopPropagation(); action.onClick() }}
    >
      {action.label}
    </Button>
  ))
  const moreMenu = condense ? (
    <Dropdown
      trigger={['click']}
      menu={{ items: item.actions!.map((a) => ({ key: a.key, label: a.label, onClick: a.onClick })) }}
    >
      <Button size="small" className="cc-queue-action cc-queue-more" aria-label="更多操作">⋯</Button>
    </Dropdown>
  ) : null

  const nameBlock = (
    <>
      <span className="cc-row-name">{item.name}</span>
      <span className="cc-row-meta">{item.code}</span>
    </>
  )

  return (
    <div className="cc-queue-row cc-patient-row">
      {item.onClick ? (
        <button type="button" className="cc-row-link" onClick={item.onClick}>{nameBlock}</button>
      ) : (
        <span className="cc-row-link cc-row-link-static">{nameBlock}</span>
      )}
      {item.diagnosis ? <span className="cc-patient-diag">{item.diagnosis}</span> : null}
      {item.account ? (
        <span className={`cc-chip ${item.account.bound ? 'blue' : 'warn'}`}>{item.account.label}</span>
      ) : null}
      {actionButtons}
      {moreMenu}
    </div>
  )
}

/* ── 可折叠列表：窄屏收住长列表，点「展开全部」再放开 ──
   桌面端默认全展开（空间够），窄屏默认只露前几条。 */

interface CollapsibleListProps {
  items: ReactNode[]
  /** 窄屏默认显示几条 */
  collapseAt?: number
  /** 展开后的按钮文字 */
  expandLabel?: (total: number) => string
}

export function CollapsibleList({ items, collapseAt = 3, expandLabel }: CollapsibleListProps) {
  const [expanded, setExpanded] = useState(false)
  const narrow = useIsNarrow()
  // 宽屏空间够，默认全展开；窄屏才折叠
  const collapsible = narrow && items.length > collapseAt
  if (!collapsible) return <>{items}</>
  const shown = expanded ? items : items.slice(0, collapseAt)
  return (
    <>
      {shown}
      <button
        type="button"
        className="cc-expand-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded
          ? '收起'
          : (expandLabel ? expandLabel(items.length) : `展开全部 ${items.length} 条`)}
      </button>
    </>
  )
}

/* ── 队列行：白卡里的行动行，点行进详情，行尾内联动作 ── */

interface QueueRowProps {
  /** 左侧状态点：warn = 待处理，ok = 已完成 */
  tone?: 'warn' | 'ok'
  /** 主标题（患者名等） */
  name: string
  /** 标题后的次要信息（编号等） */
  meta?: ReactNode
  /** 行中信息（时间等） */
  extra?: ReactNode
  /** 行尾动作 */
  actions?: QueueRowAction[]
  /** 整行点击（进详情） */
  onClick?: () => void
}

export function QueueRow({ tone = 'warn', name, meta, extra, actions, onClick }: QueueRowProps) {
  const narrow = useIsNarrow()
  // 窄屏把行尾动作收进「⋯」浮层，避免每条任务占两行把页面拉长
  const condenseActions = narrow && (actions?.length ?? 0) > 1
  const actionButtons = condenseActions ? null : actions?.map((action) => (
    <Button
      key={action.key}
      size="small"
      className="cc-queue-action"
      onClick={(e) => {
        e.stopPropagation()
        action.onClick()
      }}
    >
      {action.label}
    </Button>
  ))
  const moreMenu = condenseActions ? (
    <Dropdown
      trigger={['click']}
      menu={{
        items: actions!.map((action) => ({ key: action.key, label: action.label, onClick: action.onClick })),
      }}
    >
      <Button size="small" className="cc-queue-action cc-queue-more" aria-label="更多操作">⋯</Button>
    </Dropdown>
  ) : null

  const inner = (
    <>
      <span className={`cc-row-dot tone-${tone}`} aria-hidden />
      <span className="cc-row-name">
        {name}
        {meta ? <span className="cc-row-meta">{meta}</span> : null}
      </span>
      {extra ? <span className="cc-row-extra">{extra}</span> : null}
      {actionButtons}
      {moreMenu}
    </>
  )
  // 行本身不是 button（行内还有动作按钮，button 里套 button 是无障碍问题）。
  // 只有「名字」这一块可点进详情，用 button 元素保证键盘可达与语义正确。
  if (!onClick) return <div className="cc-queue-row">{inner}</div>
  return (
    <div className="cc-queue-row">
      <button type="button" className="cc-row-link" onClick={onClick}>
        <span className={`cc-row-dot tone-${tone}`} aria-hidden />
        <span className="cc-row-name">
          {name}
          {meta ? <span className="cc-row-meta">{meta}</span> : null}
        </span>
      </button>
      {extra ? <span className="cc-row-extra">{extra}</span> : null}
      {actionButtons}
      {moreMenu}
    </div>
  )
}

/* ── 单行团队刻度：一行格子，列=日期（工作台「近 7 日团队覆盖」） ── */

interface TeamScaleProps {
  days: ScaleDay[]
  /** 与 days 一一对应：已登记数 / 已到期数 */
  cells: { registered: number; due: number }[]
}

export function TeamScale({ days, cells }: TeamScaleProps) {
  return (
    <>
      <div className="cc-scale-wrap">
        {/* 两行网格：第一行日期表头，第二行格子。没有左侧时点列，所以不需要占位格 */}
        <div className="cc-scale cc-team-scale" aria-label="近七日团队登记覆盖">
          {days.map((day) => (
            <div key={`h-${day.key}`} className="cc-scale-day">
              <strong>{day.date}</strong>
              {day.weekday}
            </div>
          ))}
          {cells.map((cell, index) => {
            const day = days[index]
            const rate = cell && cell.due > 0 ? Math.round((cell.registered / cell.due) * 1000) / 10 : null
            const kind: ScaleCellKind = !cell || cell.due === 0
              ? 'none'
              : cell.registered >= cell.due ? 'ok' : cell.registered > 0 ? 'pending' : 'miss'
            const label = !cell || cell.due === 0
              ? `${day?.date ?? ''} 无到期时点`
              : `${day?.date ?? ''} 已登记 ${cell.registered} / 已到期 ${cell.due}${rate === null ? '' : `（${rate}%）`}`
            return (
              <div
                key={day?.key ?? index}
                className={kind === 'none' ? 'cc-cell' : `cc-cell ${kind}`}
                title={label}
                aria-label={label}
              />
            )
          })}
        </div>
      </div>
      <ul className="cc-legend">
        <li><i className="ok" aria-hidden="true" />全部登记</li>
        <li><i className="pending" aria-hidden="true" />部分登记</li>
        <li><i className="miss" aria-hidden="true" />未发现登记</li>
      </ul>
    </>
  )
}

