import { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import { CATEGORY_LABEL, type AuditSummary } from './auditModel'

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const BLUE = '#4C91ED'
const BLUE_DEEP = '#2C6FBF'
const INK = '#424650'
const MUTED = '#697180'
const GRID = '#EEF0F3'

const CATEGORY_COLOR: Record<string, string> = {
  account: '#4C91ED',
  review: '#9B8FD6',
  publish: '#43B7A0',
  model: '#E8B77E',
  other: '#8AA0B8',
}

function chartFont() {
  if (typeof document === 'undefined') return 13
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const base = Number.isFinite(root) && root > 0 ? root : 16
  return Math.round(base * 0.8125)
}

function useChart(option: EChartsOption) {
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
  }, [option])
  return ref
}

export default function AuditCharts({ summary }: { summary: AuditSummary }) {
  const [tableOpen, setTableOpen] = useState(false)
  const [fontSize, setFontSize] = useState(() => chartFont())
  useEffect(() => {
    const onResize = () => setFontSize(chartFont())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const trend = useMemo<EChartsOption>(() => {
    const last = summary.days.length - 1
    return {
      animationDuration: 280,
      grid: { left: 36, right: 12, top: 16, bottom: 28 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: summary.days.map((day) => day.day.slice(5).replace('-', '/')),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: GRID } },
        axisLabel: { color: MUTED, fontSize },
      },
      yAxis: {
        type: 'value',
        min: 0,
        minInterval: 1,
        axisLabel: { color: MUTED, fontSize },
        splitLine: { lineStyle: { color: GRID } },
      },
      series: [{
        type: 'bar',
        data: summary.days.map((day, index) => ({
          value: day.count,
          itemStyle: { color: index === last ? BLUE_DEEP : BLUE },
        })),
        barMaxWidth: 28,
      }],
    }
  }, [summary.days, fontSize])

  const types = useMemo<EChartsOption>(() => ({
    animationDuration: 280,
    grid: { left: 72, right: 28, top: 8, bottom: 24 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'value',
      min: 0,
      minInterval: 1,
      axisLabel: { color: MUTED, fontSize },
      splitLine: { lineStyle: { color: GRID } },
    },
    yAxis: {
      type: 'category',
      data: summary.groups.map((group) => CATEGORY_LABEL[group.category]),
      inverse: true,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: INK, fontSize },
    },
    series: [{
      type: 'bar',
      data: summary.groups.map((group) => ({
        value: group.count,
        itemStyle: { color: CATEGORY_COLOR[group.category] ?? '#8AA0B8' },
      })),
      barMaxWidth: 14,
      label: { show: true, position: 'right', color: INK, fontSize },
    }],
  }), [summary.groups, fontSize])

  const trendRef = useChart(trend)
  const typeRef = useChart(types)

  return (
    <div>
      <div className="ml-audit-charts">
        <section>
          <h2>操作趋势 <span>合计 {summary.total} 次</span></h2>
          <div ref={trendRef} className="ml-audit-plot" role="img" aria-label={`操作趋势，合计 ${summary.total} 次`} />
        </section>
        <section>
          <h2>操作类型</h2>
          {summary.groups.length === 0 ? <p className="ml-empty">暂无分类</p> : null}
          <div ref={typeRef} className="ml-audit-plot" role="img" aria-label="操作类型" hidden={summary.groups.length === 0} />
        </section>
      </div>
      <button type="button" className="ml-text-btn" aria-expanded={tableOpen} onClick={() => setTableOpen((open) => !open)}>
        {tableOpen ? '收起数据表' : '数据表'}
      </button>
      {tableOpen ? (
        <div className="ml-table-wrap">
          <table className="ml-table">
            <caption className="ml-sr">审计区间计数</caption>
            <thead>
              <tr><th scope="col">日期</th><th scope="col">次数</th></tr>
            </thead>
            <tbody>
              {summary.days.map((day) => (
                <tr key={day.day}><th scope="row">{day.day}</th><td>{day.count}</td></tr>
              ))}
              {summary.groups.map((group) => (
                <tr key={group.category}><th scope="row">{CATEGORY_LABEL[group.category]}</th><td>{group.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
