import { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts/core'
import { LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import { formatCoverage, type DailyCoverage } from '../../pages/clinician/medixClinicalModel.ts'

echarts.use([LineChart, PieChart, GridComponent, TooltipComponent, CanvasRenderer])

const BLUE = '#4C91ED'
const TEAL = '#43B7A0'
const APRICOT = '#E8B77E'
const INK = '#424650'
const MUTED = '#697180'
const GRID = '#EEF0F3'
const EMPTY = '#E6E8EE'

function chartFont() {
  if (typeof document === 'undefined') return 13
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const base = Number.isFinite(root) && root > 0 ? root : 16
  return Math.round(base * 0.8125)
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(media.matches)
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  return reduced
}

function useEChart(option: EChartsOption, visible: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const chart = echarts.init(el)
    chartRef.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(el)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true })
    if (visible) chartRef.current?.resize()
  }, [option, visible])

  return ref
}

function rateText(point: DailyCoverage) {
  if (point.anomaly) return '数据异常'
  if (point.N === 0 || point.coverage_rate == null) return '无到期时点'
  return formatCoverage(point.coverage_rate)
}

export function TrendChart({ points, visible = true }: { points: DailyCoverage[]; visible?: boolean }) {
  const reduced = useReducedMotion()
  const [tableOpen, setTableOpen] = useState(false)
  const [fontSize, setFontSize] = useState(() => chartFont())

  useEffect(() => {
    const onResize = () => setFontSize(chartFont())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const option = useMemo<EChartsOption>(() => {
    const values = points.map((point) => (point.anomaly || point.coverage_rate == null ? null : point.coverage_rate))
    return {
      animation: !reduced,
      animationDuration: reduced ? 0 : 280,
      grid: { left: 48, right: 16, top: 28, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const hit = Array.isArray(params) ? params[0] : params
          const point = hit ? points[hit.dataIndex] : undefined
          if (!point) return ''
          return `${point.day}<br/>已登记 ${point.M} / 应记录 ${point.N}<br/>登记覆盖率 ${rateText(point)}`
        },
      },
      xAxis: {
        type: 'category',
        data: points.map((point) => point.day),
        boundaryGap: false,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: GRID } },
        axisLabel: {
          color: MUTED,
          fontSize,
          hideOverlap: true,
          interval: points.length <= 8 ? 0 : Math.ceil(points.length / 8) - 1,
          formatter: (value: string) => value.slice(5).replace('-', '/'),
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 50,
        axisLabel: { color: MUTED, fontSize, formatter: '{value}%' },
        splitLine: { lineStyle: { color: GRID } },
      },
      series: [
        {
          name: '登记覆盖率',
          type: 'line',
          data: values,
          connectNulls: false,
          smooth: false,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: BLUE },
          lineStyle: { color: BLUE, width: 2 },
          label: {
            show: points.length > 0 && points.length <= 10,
            color: INK,
            fontSize,
            formatter: (params) => {
              const point = points[params.dataIndex]
              if (!point || point.coverage_rate == null || point.anomaly) return ''
              return formatCoverage(point.coverage_rate)
            },
          },
        },
      ],
    }
  }, [points, reduced, fontSize])

  const ref = useEChart(option, visible)
  const empty = points.length === 0

  return (
    <div className="ml-trend">
      <div
        ref={ref}
        className="ml-chart-canvas"
        role="img"
        aria-label="逐日登记覆盖率。具体数字在数据表中。"
        style={{ display: empty ? 'none' : undefined }}
      />
      {empty ? <p className="ml-empty">暂无趋势数据</p> : null}
      {points.length > 0 && points.every((point) => point.N === 0) ? (
        <p className="ml-hint">该区间无到期时点</p>
      ) : null}
      <button
        type="button"
        className="ml-text-btn"
        aria-expanded={tableOpen}
        onClick={() => setTableOpen((open) => !open)}
      >
        {tableOpen ? '收起数据表' : '数据表'}
      </button>
      {tableOpen ? <CoverageDataTable points={points} /> : null}
    </div>
  )
}

export function CoverageDataTable({ points }: { points: DailyCoverage[] }) {
  return (
    <div className="ml-table-wrap">
      <table className="ml-table ml-data-table">
        <caption className="ml-sr">逐日登记覆盖率</caption>
        <thead>
          <tr>
            <th scope="col">日期</th>
            <th scope="col">已登记</th>
            <th scope="col">应记录</th>
            <th scope="col">登记覆盖率</th>
          </tr>
        </thead>
        <tbody>
          {points.length === 0 ? (
            <tr>
              <td colSpan={4}>暂无趋势数据</td>
            </tr>
          ) : points.map((point) => (
            <tr key={point.day}>
              <th scope="row">{point.day}</th>
              <td>{point.M}</td>
              <td>{point.N}</td>
              <td>{rateText(point)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CoverageDonut({
  registered,
  expected,
  rate,
  anomaly = false,
  visible = true,
}: {
  registered: number | null
  expected: number | null
  rate: number | null
  anomaly?: boolean
  visible?: boolean
}) {
  const reduced = useReducedMotion()
  const expectedN = expected ?? 0
  const registeredM = registered ?? 0
  const broken = anomaly || (expected != null && registered != null && (registeredM > expectedN || registeredM < 0 || expectedN < 0))
  const empty = !broken && (expected == null || expectedN <= 0)
  const missing = !broken && !empty ? Math.max(expectedN - registeredM, 0) : 0

  const option = useMemo<EChartsOption>(() => {
    const data = broken || empty
      ? [{ value: 1, name: '无到期时点', itemStyle: { color: EMPTY } }]
      : [
          { value: registeredM, name: '已登记', itemStyle: { color: TEAL } },
          { value: missing, name: '未发现登记', itemStyle: { color: APRICOT } },
        ]
    return {
      animation: !reduced,
      animationDuration: reduced ? 0 : 280,
      series: [
        {
          type: 'pie',
          radius: ['68%', '86%'],
          center: ['50%', '50%'],
          silent: true,
          label: { show: false },
          data,
        },
      ],
    }
  }, [broken, empty, registeredM, missing, reduced])

  const ref = useEChart(option, visible)
  const center = broken || empty || rate == null ? '—' : formatCoverage(rate)
  const registeredShare = !broken && !empty ? formatCoverage((registeredM / expectedN) * 100) : '—'
  const missingShare = !broken && !empty ? formatCoverage((missing / expectedN) * 100) : '—'

  return (
    <div className="ml-donut">
      <div className="ml-donut-plot">
        <div ref={ref} className="ml-chart-canvas ml-donut-canvas" role="img" aria-label={`登记分布 ${center}`} />
        <div className="ml-donut-center" aria-hidden="true">{center}</div>
      </div>
      <ul className="ml-donut-legend">
        <li>
          <i className="is-registered" aria-hidden="true" />
          <span>已登记</span>
          <b>{broken || registered == null ? '—' : registeredM}</b>
          <span>{registeredShare}</span>
        </li>
        <li>
          <i className="is-missing" aria-hidden="true" />
          <span>未发现登记</span>
          <b>{broken || expected == null ? '—' : missing}</b>
          <span>{missingShare}</span>
        </li>
      </ul>
      {broken ? <p className="ml-hint">数据异常</p> : null}
      <table className="ml-sr">
        <caption>登记分布</caption>
        <tbody>
          <tr>
            <th scope="row">已登记</th>
            <td>{broken || registered == null ? '—' : registeredM}</td>
          </tr>
          <tr>
            <th scope="row">未发现登记</th>
            <td>{broken || expected == null ? '—' : missing}</td>
          </tr>
          <tr>
            <th scope="row">登记覆盖率</th>
            <td>{center}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
