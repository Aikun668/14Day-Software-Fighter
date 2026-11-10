import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import { rateText } from './medix/clinical'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])
export interface TrendPoint { day: string; N: number; M: number; coverage_rate: number | null }
export default function CoverageTrendChart({ trend }: { trend: TrendPoint[] }) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = container.current
    if (!el) return
    const chart = echarts.init(el)
    const style = getComputedStyle(el), fontSize = parseFloat(style.fontSize)
    const option: EChartsOption = {
      animation: !matchMedia('(prefers-reduced-motion: reduce)').matches, animationDuration: 200,
      textStyle: { fontFamily: style.fontFamily, fontSize, color: '#424650' },
      grid: { left: fontSize * 3.1, right: fontSize * 1.4, top: fontSize * 2.2, bottom: fontSize * 2.5 },
      tooltip: { trigger: 'axis', formatter: params => {
        const hit = Array.isArray(params) ? params[0] : params
        const point = hit ? trend[hit.dataIndex] : undefined
        return point ? `${point.day}<br/>已登记 ${point.M} / 应记录 ${point.N}<br/>登记覆盖率 ${point.N === 0 ? '无到期时点' : rateText(point.coverage_rate)}` : ''
      } },
      xAxis: { type: 'category', data: trend.map(p => p.day.slice(5).replace('-', '/')), boundaryGap: true, axisTick: { show: false }, axisLine: { lineStyle: { color: '#B2B7C3' } }, axisLabel: { color: '#697180', fontSize, interval: trend.length <= 7 ? 0 : 'auto', hideOverlap: true } },
      yAxis: { type: 'value', min: 0, max: 100, interval: 50, axisLabel: { color: '#697180', fontSize, formatter: '{value}%' }, splitLine: { lineStyle: { color: '#E7EAF0', type: 'dashed' } } },
      series: [{ name: '登记覆盖率', type: 'line', data: trend.map(p => p.N === 0 ? null : p.coverage_rate), connectNulls: false, smooth: false, symbol: 'circle', symbolSize: fontSize * .55, itemStyle: { color: 'white', borderColor: '#4195FF', borderWidth: 2 }, lineStyle: { color: '#4195FF', width: 2 }, label: { show: trend.length <= 7 && el.clientWidth >= fontSize * 34, position: 'top', distance: 8, color: '#424650', fontSize, formatter: p => `${p.value}%` } }],
    }
    chart.setOption(option)
    const resize = () => { chart.resize(); chart.setOption({ series: [{ label: { show: trend.length <= 7 && el.clientWidth >= fontSize * 34 } }] }) }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    let live = true
    void document.fonts.ready.then(() => { if (live) { chart.setOption(option, true); resize() } })
    return () => { live = false; observer.disconnect(); chart.dispose() }
  }, [trend])
  return <div className="ml-trend-block"><div ref={container} className="ml-trend-chart" role="img" aria-label="每日登记覆盖率折线图，完整数值见数据表" />
    {trend.length === 0 && <p className="ml-empty">暂无趋势数据</p>}
    {trend.length > 0 && trend.every(p => p.N === 0) && <p className="ml-chart-empty">无到期时点</p>}
    <details className="ml-chart-data"><summary>数据表</summary><div className="ml-table-wrap"><table className="ml-table"><thead><tr><th>日期</th><th>已登记</th><th>应记录</th><th>登记覆盖率</th></tr></thead><tbody>{trend.map(p => <tr key={p.day}><td>{p.day}</td><td>{p.M}</td><td>{p.N}</td><td>{p.N === 0 ? '无到期时点' : rateText(p.coverage_rate)}</td></tr>)}</tbody></table></div></details>
  </div>
}
