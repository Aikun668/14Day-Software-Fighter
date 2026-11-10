import { Card, Progress } from 'antd'
import type { DaySummary } from './todayCoverage'

interface Props {
  loading: boolean
  summary: DaySummary | null
  asOf: string
}

/** 与 CoverageTrendChart、矩阵刻度同一诊所蓝。 */
const RING = '#5B7CFF'

function statusText(summary: DaySummary | null): string {
  if (!summary || summary.N === 0) return '今日暂无已到期时点'
  if (summary.missing > 0) return `还有 ${summary.missing} 个已到期时点未登记`
  return '今日已到期时点已全部登记'
}

export default function TodayProgressCard({ loading, summary, asOf }: Props) {
  const rate = summary?.rate ?? null
  return (
    <Card
      title="今日处理"
      loading={loading}
      extra={<span style={{ fontSize: 12, color: '#6B6E7F' }}>截至 {asOf}</span>}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <Progress
          type="circle"
          size={96}
          percent={rate ?? 0}
          strokeColor={RING}
          format={() => <span className="num">{rate === null ? '—' : `${rate}%`}</span>}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 14, color: '#24243E', fontWeight: 500 }}>{statusText(summary)}</span>
          <span style={{ fontSize: 13, color: '#6B6E7F' }}>
            已登记 <b style={{ color: '#24243E' }}>{summary?.M ?? 0}</b> / 已到期 <b style={{ color: '#24243E' }}>{summary?.N ?? 0}</b>
          </span>
          <span style={{ fontSize: 12, color: '#6B6E7F' }}>未到期的时点不计入分母</span>
        </div>
      </div>
    </Card>
  )
}
