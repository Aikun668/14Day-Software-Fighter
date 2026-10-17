import { useEffect, useState } from 'react'
import { Button, Card, DatePicker, message, Select, Space, Statistic, Table, Typography } from 'antd'
import dayjs from 'dayjs'
import { apiFetch } from '../../api/client'
import PageHeader from '../../components/PageHeader'

const { Text } = Typography

interface Patient { id: string; patient_code: string; display_name: string }
interface Stats {
  from_: string; to: string; timezone: string; N: number; M: number; coverage_rate: number | null;
  missing_slots: { slot_id: string; scheduled_at: string }[];
  source_breakdown: Record<string, number>;
  source_breakdown_basis: string;
  disclaimer: string;
}

/** 覆盖率进度环（纯 SVG，跟随主题色） */
function CoverageRing({ rate, M, N }: { rate: number | null; M: number; N: number }) {
  const size = 132
  const stroke = 12
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = rate === null ? 0 : Math.min(rate, 100) / 100
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EFECFE" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="#573BF4" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - ratio)}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 24, fontWeight: 600, color: '#573BF4' }}>
          {rate === null ? '—' : `${rate}%`}
        </span>
        <span style={{ fontSize: 13, color: '#6B6E7F' }}>{M} / {N}</span>
      </div>
    </div>
  )
}

/** 逐日覆盖率趋势：折线 + 每日刻度格（有数据的日期着色，深浅按覆盖率） */
function TrendChart({ trend }: { trend: { day: string; rate: number | null; N: number; M: number }[] }) {
  if (trend.length === 0) {
    return <p className="muted" style={{ margin: 0 }}>暂无趋势数据</p>
  }
  const W = 720
  const H = 180
  const padL = 34
  const padB = 26
  const n = trend.length
  const x = (i: number) => padL + (n === 1 ? (W - padL) / 2 : (i * (W - padL)) / (n - 1))
  const y = (v: number) => 12 + (1 - v / 100) * (H - padB - 12)
  const pts = trend.map((t, i) => (t.rate === null ? null : `${x(i)},${y(t.rate)}`)).filter(Boolean) as string[]
  const valid = trend.filter((t) => t.rate !== null)
  const first = valid[0]?.rate ?? null
  const last = valid[valid.length - 1]?.rate ?? null
  const delta = first !== null && last !== null ? Math.round((last - first) * 10) / 10 : null

  return (
    <div>
      {delta !== null && n > 1 && (
        <p className="muted" style={{ margin: '0 0 8px' }}>
          区间变化：<b style={{ color: delta > 0 ? '#14938E' : delta < 0 ? '#B02A2A' : undefined }}>
            {delta > 0 ? `+${delta}` : delta}
          </b>{' '}
          个百分点（{valid[0]?.day} → {valid[valid.length - 1]?.day}）｜ 仅统计已到期时点
        </p>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 180 }} role="img" aria-label="逐日覆盖率趋势">
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={padL} y1={y(g)} x2={W} y2={y(g)} stroke="#F0F2F7" strokeWidth={1} />
            <text x={4} y={y(g) + 4} fontSize={11} fill="#6B6E7F">{g}%</text>
          </g>
        ))}
        {pts.length > 1 && <polyline points={pts.join(' ')} fill="none" stroke="#573BF4" strokeWidth={2.5} strokeLinejoin="round" />}
        {trend.map((t, i) => (
          <g key={t.day}>
            {t.rate !== null && <circle cx={x(i)} cy={y(t.rate)} r={4} fill="#573BF4" />}
            {t.rate !== null && (
              <text x={x(i)} y={y(t.rate) - 9} fontSize={11} fill="#24243E" textAnchor="middle">{t.rate}%</text>
            )}
            <text x={x(i)} y={H - 8} fontSize={11} fill="#6B6E7F" textAnchor="middle">
              {t.day.slice(5)}
            </text>
          </g>
        ))}
      </svg>
      {trend.every((t) => t.N === 0) && (
        <p className="muted" style={{ margin: '8px 0 0' }}>该区间内无固定计划时点（按需用药不计入覆盖率）。</p>
      )}
    </div>
  )
}

/** 缺失时点按日分布柱状图（纯 SVG） */
function MissingBars({ missing }: { missing: { scheduled_at: string }[] }) {
  if (missing.length === 0) {
    return <Text type="secondary">该区间内无缺失时点</Text>
  }
  // 按日聚合并保持日期升序
  const byDay = new Map<string, number>()
  for (const m of missing) {
    const day = new Date(m.scheduled_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    byDay.set(day, (byDay.get(day) || 0) + 1)
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  const max = Math.max(...days.map(([, n]) => n))
  const W = 100 / days.length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '0 4px' }}>
        {days.map(([day, n]) => (
          <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 13, color: 'var(--missed)', fontWeight: 500 }}>{n}</span>
            <div style={{
              width: `min(${W}%, 48px)`, height: `${(n / max) * 82}%`,
              background: '#573BF4', borderRadius: '6px 6px 2px 2px', minHeight: 6, opacity: 0.85,
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 4px', borderTop: '1px solid #F0F2F7', marginTop: 6 }}>
        {days.map(([day]) => (
          <div key={day} style={{ flex: 1, textAlign: 'center', fontSize: 13, color: '#6B6E7F', padding: '6px 0' }}>{day}</div>
        ))}
      </div>
    </div>
  )
}

// M04 统计与核查（J032）
export default function StatsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  // 默认查询区间与演示数据计划周期一致（可复现 PRD T06 的 N=14/M=10/71.4%）
  const [from, setFrom] = useState('2026-10-08')
  const [to, setTo] = useState('2026-10-15')
  const [stats, setStats] = useState<Stats | null>(null)
  const [trend, setTrend] = useState<{ day: string; rate: number | null; N: number; M: number }[]>([])
  const [loading, setLoading] = useState(false)

  const fetchPatients = async () => {
    try {
      const r = await apiFetch<{ items: Patient[] }>('/api/patients?page_size=100')
      setPatients(r.items)
    } catch (e) { message.error((e as Error).message) }
  }

  useEffect(() => { fetchPatients() }, [])

  const fetchStats = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const r = await apiFetch<Stats>(`/api/patients/${selected}/stats?from=${from}&to=${to}`)
      setStats(r)
      // 逐日趋势：把 [from, to) 按天切片并行查询（每天一个左闭右开窗口）
      const days: string[] = []
      let cur = dayjs(from)
      const end = dayjs(to)
      while (cur.isBefore(end) && days.length < 31) {
        days.push(cur.format('YYYY-MM-DD'))
        cur = cur.add(1, 'day')
      }
      const daily = await Promise.all(
        days.map((d) =>
          apiFetch<Stats>(`/api/patients/${selected}/stats?from=${d}&to=${dayjs(d).add(1, 'day').format('YYYY-MM-DD')}`)
            .then((s) => ({ day: d, rate: s.coverage_rate, N: s.N, M: s.M }))
            .catch(() => ({ day: d, rate: null, N: 0, M: 0 })),
        ),
      )
      setTrend(daily)
    } catch (e) { message.error((e as Error).message) } finally { setLoading(false) }
  }

  return (
    <div>
      <PageHeader title="统计与核查" />
      <Card style={{ marginBottom: 24 }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <Space size={12} wrap>
            <label htmlFor="stats-patient" className="field-label">患者</label>
            <Select
              id="stats-patient"
              style={{ width: 240 }}
              placeholder="选择患者"
              options={patients.map(p => ({ value: p.id, label: `${p.display_name} (${p.patient_code})` }))}
              onChange={setSelected}
              showSearch optionFilterProp="label"
            />
            <span className="field-label">开始</span>
            <DatePicker
              value={dayjs(from)}
              onChange={(d) => d && setFrom(d.format('YYYY-MM-DD'))}
              placeholder="开始日期"
              allowClear={false}
            />
            <span className="field-label">结束</span>
            <DatePicker
              value={dayjs(to)}
              onChange={(d) => d && setTo(d.format('YYYY-MM-DD'))}
              placeholder="结束日期"
              allowClear={false}
            />
            <Button type="primary" onClick={fetchStats} disabled={!selected} loading={loading}>查询</Button>
            <Button
              onClick={() => {
                // 演示区间与种子脚本的 v1 计划区间一致（过去 7 个完整日）
                const start = dayjs().subtract(7, 'day').format('YYYY-MM-DD')
                const end = dayjs().format('YYYY-MM-DD')
                setFrom(start); setTo(end)
              }}
            >
              重置为近 7 日
            </Button>
          </Space>
        </div>
      </Card>

      {!stats && (
        <Card>
          <p className="muted" style={{ margin: 0 }}>选择患者与统计区间后，点击「查询」查看覆盖率与缺失时点。</p>
        </Card>
      )}

      {stats && (
        <div className="stack">
          <Card>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              统计区间：{stats.from_} 至 {stats.to}（左闭右开）｜ 时区：{stats.timezone}
            </p>
            <div className="stats-summary">
              <CoverageRing rate={stats.coverage_rate} M={stats.M} N={stats.N} />
              <div className="stats-numbers">
                <Statistic title="应记录时点 N" value={stats.N} />
                <Statistic title="有效已登记时点 M" value={stats.M} />
                <Statistic
                  title="缺失时点"
                  value={stats.missing_slots.length}
                  styles={{ content: { color: stats.missing_slots.length ? 'var(--missed)' : 'var(--progress)' } }}
                />
              </div>
            </div>
            <p className="muted" style={{ margin: '16px 0 0' }}>{stats.disclaimer}</p>
          </Card>

          <Card title="逐日覆盖率趋势">
            <TrendChart trend={trend} />
          </Card>

          <div className="stats-grid">
            <Card title="缺失时点按日分布">
              <MissingBars missing={stats.missing_slots} />
            </Card>

            <Card title="来源分布">
              <p className="muted" style={{ margin: '0 0 12px' }}>按有效登记事件数统计（非去重时点数）</p>
              <Table
                rowKey="source"
                dataSource={Object.entries(stats.source_breakdown).map(([k, v]) => ({ source: k, count: v }))}
                pagination={false}
                columns={[
                  { title: '来源', dataIndex: 'source', render: (v: string) => v === 'PATIENT_REPORT' ? '患者自述' : v === 'CLINICIAN_OBSERVED' ? '医护观察' : v },
                  { title: '事件数', dataIndex: 'count' },
                ]}
              />
            </Card>
          </div>

          <Card title={`缺失时点（${stats.missing_slots.length} 个）`} styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="slot_id"
              dataSource={stats.missing_slots}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '应记录时间', dataIndex: 'scheduled_at', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
                { title: '状态', render: () => '无有效登记' },
              ]}
            />
          </Card>
        </div>
      )}
    </div>
  )
}
