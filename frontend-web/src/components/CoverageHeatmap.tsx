import type { CSSProperties } from 'react'
import { Tooltip } from 'antd'

/** 与后端 MatrixCell 对应：某患者某天。N=0 表示当天无已到期时点。 */
export interface MatrixCell {
  day: string
  N: number
  M: number
  missing: number
  coverage_rate: number | null
}

/** 与后端 MatrixRow 对应：一个负责患者。cells 与 days 按位置对齐。 */
export interface MatrixRow {
  patient_id: string
  patient_code: string
  display_name: string
  N: number
  M: number
  coverage_rate: number | null
  cells: MatrixCell[]
}

export type CellState = 'blank' | 'solid' | 'partial' | 'hollow'

/** 单格状态：空白（无时点）/ 实心（全部已登记）/ 半实心（部分登记）/ 空心（未发现登记） */
export function cellState(cell: MatrixCell): CellState {
  if (cell.N === 0) return 'blank'
  if (cell.M === cell.N) return 'solid'
  if (cell.M === 0) return 'hollow'
  return 'partial'
}

const STATE_TEXT: Record<CellState, string> = {
  blank: '无计划时点',
  solid: '已登记',
  partial: '部分登记',
  hollow: '未发现登记',
}

const STATE_GLYPH: Record<CellState, string> = {
  blank: '',
  solid: '●',
  partial: '◐',
  hollow: '○',
}

const PURPLE = '#573BF4'

function cellStyle(state: CellState): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: 6,
    fontSize: 14,
    lineHeight: 1,
    color: PURPLE,
    boxSizing: 'border-box',
  }
  if (state === 'solid') return { ...base, background: PURPLE, color: '#fff' }
  if (state === 'partial') return { ...base, background: '#E6E0FE', border: `2px solid ${PURPLE}` }
  if (state === 'hollow') return { ...base, background: '#fff', border: `2px solid ${PURPLE}` }
  return base
}

function cellLabel(row: MatrixRow, cell: MatrixCell): string {
  const state = cellState(cell)
  if (state === 'blank') return `${row.display_name} ${cell.day.slice(5)}：无计划时点`
  return `${row.display_name} ${cell.day.slice(5)}：应记录 ${cell.N} 次，已登记 ${cell.M} 次，${STATE_TEXT[state]}`
}

function Legend() {
  const items: CellState[] = ['solid', 'partial', 'hollow', 'blank']
  return (
    <ul className="heatmap-legend" style={{ display: 'flex', gap: 16, listStyle: 'none', padding: 0, margin: '12px 0 0', flexWrap: 'wrap', fontSize: 13, color: '#6B6E7F' }}>
      {items.map((s) => (
        <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true" style={cellStyle(s)}>{STATE_GLYPH[s]}</span>
          {STATE_TEXT[s]}
        </li>
      ))}
    </ul>
  )
}

interface Props {
  days: string[]
  rows: MatrixRow[]
}

/** 负责患者 × 日期的覆盖热力图。每格有文字 aria-label 与 Tooltip，状态不只靠颜色。 */
export default function CoverageHeatmap({ days, rows }: Props) {
  if (rows.length === 0) {
    return <p className="muted" style={{ margin: 0 }}>暂无负责患者</p>
  }
  if (days.length === 0) {
    return <p className="muted" style={{ margin: 0 }}>请选择统计区间</p>
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 4 }}>
          <caption style={{ textAlign: 'left', marginBottom: 8, color: '#6B6E7F', fontSize: 13 }}>
            覆盖矩阵：行为负责患者，列为日期（仅统计已到期时点）
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ minWidth: 120, textAlign: 'left', fontWeight: 500 }}>患者</th>
              {days.map((d) => (
                <th key={d} scope="col" style={{ fontWeight: 500, fontSize: 12, color: '#6B6E7F', minWidth: 30 }}>
                  {d.slice(5)}
                </th>
              ))}
              <th scope="col" style={{ fontWeight: 500, paddingLeft: 12 }}>覆盖率</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.patient_id}>
                <th scope="row" style={{ textAlign: 'left', fontWeight: 500, whiteSpace: 'nowrap', paddingRight: 8 }}>
                  {row.display_name}
                  <span style={{ color: '#6B6E7F', marginLeft: 6, fontSize: 12 }}>{row.patient_code}</span>
                </th>
                {row.cells.map((cell) => {
                  const state = cellState(cell)
                  const label = cellLabel(row, cell)
                  return (
                    <td key={cell.day} style={{ textAlign: 'center', padding: 0 }}>
                      <Tooltip title={label} trigger={['hover', 'focus']}>
                        <span
                          role="img"
                          aria-label={label}
                          tabIndex={0}
                          style={cellStyle(state)}
                        >
                          {STATE_GLYPH[state]}
                        </span>
                      </Tooltip>
                    </td>
                  )
                })}
                <td style={{ paddingLeft: 12, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {row.coverage_rate === null ? '—' : `${row.coverage_rate}%`}
                  <span style={{ color: '#6B6E7F', marginLeft: 6, fontSize: 12 }}>{row.M}/{row.N}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Legend />
    </div>
  )
}

/** 与后端 MatrixResponse 对应（GET /api/stats/matrix）。 */
export interface MatrixResponse {
  from_: string
  to: string
  timezone: string
  days: string[]
  total_N: number
  total_M: number
  coverage_rate: number | null
  rows: MatrixRow[]
}
