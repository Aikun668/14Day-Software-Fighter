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

/** 单格状态：空白（无时点）/ 实心（全部已登记）/ 部分登记 / 空心（未发现登记） */
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

/** 跟 Clinic Comfort 刻度同一套：已登记软蓝、部分登记描边、未登记浅灰。不靠青黑或红色填格。 */
const STATE_CLASS: Record<CellState, string> = {
  blank: 'cc-matrix-cell blank',
  solid: 'cc-matrix-cell ok',
  partial: 'cc-matrix-cell pending',
  hollow: 'cc-matrix-cell miss',
}

function cellLabel(row: MatrixRow, cell: MatrixCell): string {
  const state = cellState(cell)
  if (state === 'blank') return `${row.display_name} ${cell.day.slice(5)}：无计划时点`
  return `${row.display_name} ${cell.day.slice(5)}：应记录 ${cell.N} 次，已登记 ${cell.M} 次，${STATE_TEXT[state]}`
}

function Legend() {
  const items: { state: CellState; swatch: string }[] = [
    { state: 'solid', swatch: 'ok' },
    { state: 'partial', swatch: 'pending' },
    { state: 'hollow', swatch: 'miss' },
    { state: 'blank', swatch: 'blank' },
  ]
  return (
    <ul className="cc-legend cc-matrix-legend">
      {items.map(({ state, swatch }) => (
        <li key={state}><i className={swatch} aria-hidden="true" />{STATE_TEXT[state]}</li>
      ))}
    </ul>
  )
}

interface Props {
  days: string[]
  rows: MatrixRow[]
  /** 点患者名进入该患者的报告。不传则名字只是文字。 */
  onPatient?: (patientId: string) => void
}

/** 负责患者 × 日期的覆盖矩阵。每格有文字 aria-label 与 Tooltip，状态不只靠颜色。 */
export default function CoverageHeatmap({ days, rows, onPatient }: Props) {
  if (rows.length === 0) {
    return <p className="cc-empty-line">暂无负责患者</p>
  }
  if (days.length === 0) {
    return <p className="cc-empty-line">请选择统计区间</p>
  }

  return (
    <div className="cc-matrix-wrap">
      <table className="cc-matrix">
        <thead>
          <tr>
            <th scope="col" className="who">患者</th>
            {days.map((d) => (
              <th key={d} scope="col">{d.slice(5)}</th>
            ))}
            <th scope="col" className="rate">覆盖率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.patient_id}>
              <th scope="row" className="who">
                {onPatient ? (
                  <button type="button" className="cc-matrix-who" onClick={() => onPatient(row.patient_id)}>
                    {row.display_name}
                    <span>{row.patient_code}</span>
                  </button>
                ) : (
                  <span className="cc-matrix-who cc-matrix-who-static">
                    {row.display_name}
                    <span>{row.patient_code}</span>
                  </span>
                )}
              </th>
              {row.cells.map((cell) => {
                const state = cellState(cell)
                const label = cellLabel(row, cell)
                return (
                  <td key={cell.day}>
                    <Tooltip title={label} trigger={['hover', 'focus']}>
                      <span
                        role="img"
                        aria-label={label}
                        tabIndex={0}
                        className={STATE_CLASS[state]}
                      />
                    </Tooltip>
                  </td>
                )
              })}
              <td className="rate">
                {row.coverage_rate === null ? '—' : `${row.coverage_rate}%`}
                <span>{row.M}/{row.N}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
