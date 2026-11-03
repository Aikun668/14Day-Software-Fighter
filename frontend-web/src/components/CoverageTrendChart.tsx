import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'

// 按需引入：只注册用到的图表类型与组件，控制包体
echarts.use([LineChart, ScatterChart, GridComponent, TooltipComponent, CanvasRenderer])

export interface TrendPoint {
  day: string
  N: number
  M: number
  coverage_rate: number | null
}

/** Clinic Comfort 诊所蓝。趋势线只换颜色，计算仍用服务端 coverage_rate。 */
const LINE = '#5B7CFF'

/** N=0（当天无到期时点）的日子：coverage_rate 为 null，断开连线，并以空心点标在基线上 */
function buildOption(trend: TrendPoint[]): EChartsOption {
  const days = trend.map((t) => t.day.slice(5))
  const values = trend.map((t) => t.coverage_rate)
  const emptyPoints = trend
    .map((t, i) => (t.N === 0 ? [i, 0] : null))
    .filter((p): p is [number, number] => p !== null)

  return {
    grid: { left: 40, right: 16, top: 24, bottom: 28 },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const hit = Array.isArray(params) ? params[0] : params
        const t = hit ? trend[hit.dataIndex] : undefined
        if (!t) return ''
        const rate = t.coverage_rate === null ? '无到期时点' : `${t.coverage_rate}%`
        return `${t.day}<br/>应记录 ${t.N}，已登记 ${t.M}<br/>覆盖率 ${rate}`
      },
    },
    xAxis: {
      type: 'category',
      data: days,
      boundaryGap: false,
      axisLabel: { color: '#8B93A7', fontSize: 12 },
      axisLine: { lineStyle: { color: '#E5EAF1' } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      interval: 50,
      axisLabel: { color: '#8B93A7', fontSize: 12, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#EEF2F7' } },
    },
    series: [
      {
        name: '覆盖率',
        type: 'line',
        data: values,
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: LINE },
        lineStyle: { color: LINE, width: 2.5 },
        label: { show: false },
      },
      {
        name: '无到期时点',
        type: 'scatter',
        data: emptyPoints,
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: { color: '#fff', borderColor: '#C8CEDA', borderWidth: 1.5 },
        tooltip: { show: false },
      },
    ],
  }
}

interface Props {
  trend: TrendPoint[]
}

/** 逐日覆盖率趋势（ECharts，按需引入）。替换原手写 SVG 折线。 */
export default function CoverageTrendChart({ trend }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  // 初始化与销毁：容器始终挂载，effect 只跑一次；StrictMode 下 cleanup 会 dispose 后重新 init
  useEffect(() => {
    const el = containerRef.current
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

  // 数据变化时整体替换 option（notMerge=true，避免残留旧系列）
  useEffect(() => {
    chartRef.current?.setOption(buildOption(trend), { notMerge: true })
  }, [trend])

  const n = trend.length

  return (
    <div>
      {/* 容器始终挂载：图表实例依赖它在首次渲染时初始化；空数据时只隐藏 */}
      <div
        ref={containerRef}
        role="img"
        aria-label="逐日覆盖率趋势（数据与下方说明一致）"
        style={{ width: '100%', height: 220, display: n === 0 ? 'none' : undefined }}
      />
      {n === 0 && <p className="cc-empty-line">暂无趋势数据</p>}
      {trend.some((t) => t.N === 0) && trend.some((t) => t.N > 0) && (
        <p className="cc-empty-line" style={{ marginTop: 8 }}>空心点表示当天没有到期的固定时点（不参与连线）。</p>
      )}
      {n > 0 && trend.every((t) => t.N === 0) && (
        <p className="cc-empty-line" style={{ marginTop: 8 }}>该区间内无固定计划时点（按需用药不计入覆盖率）。</p>
      )}
    </div>
  )
}
