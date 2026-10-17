import { useEffect, useState } from 'react'
import { Button, Card, message, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../api/client'
import PageHeader from '../../components/PageHeader'

interface Task {
  id: string; patient_id: string; task_type: string; status: string;
  assigned_to: string | null; created_at: string; closed_at: string | null
}
interface Patient { id: string; patient_code: string; display_name: string }
interface Followup { id: string; patient_id: string; followed_at: string; feedback: string | null }

// M01 工作台（J036）
export default function WorkbenchPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [recentFollowups, setRecentFollowups] = useState<Followup[]>([])
  const [selected, setSelected] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [today] = useState(() => new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }))

  useEffect(() => {
    const load = async () => {
      try {
        const t = await apiFetch<{ items: Task[] }>('/api/tasks?status=OPEN&page_size=50')
        setTasks(t.items)
        const p = await apiFetch<{ items: Patient[] }>('/api/patients?page_size=100')
        setPatients(p.items)
        // 聚合所有负责患者的随访，按时间倒序取最近 5 条
        const all = await Promise.all(
          p.items.map((pt) =>
            apiFetch<{ items: Followup[] }>(`/api/patients/${pt.id}/followups?page_size=20`)
              .then((r) => r.items)
              .catch(() => [] as Followup[]),
          ),
        )
        const merged = all.flat().sort(
          (a, b) => new Date(b.followed_at).getTime() - new Date(a.followed_at).getTime(),
        )
        setRecentFollowups(merged.slice(0, 5))
      } catch (e) { message.error((e as Error).message) } finally { setLoading(false) }
    }
    load()
  }, [])

  const patientName = (pid: string) => patients.find(p => p.id === pid)?.display_name || pid.slice(0, 8)
  const patientCode = (pid: string) => patients.find(p => p.id === pid)?.patient_code || ''
  const count = (n: number) => (loading ? '—' : n)

  return (
    <div>
      <PageHeader title="工作台" meta={today} />

      {/* 概览：一条白底横条，三格之间用竖线分开；加载中不显示未完成的数字 */}
      <section className="overview" aria-label="工作台概览">
        <div className="overview-cell">
          <span className="overview-label">负责患者</span>
          <span className="overview-value">{count(patients.length)}</span>
        </div>
        <div className="overview-cell">
          <span className="overview-label">待核查任务</span>
          <span className="overview-value">{count(tasks.length)}</span>
        </div>
        <div className="overview-cell">
          <span className="overview-label">近期随访</span>
          <span className="overview-value">{count(recentFollowups.length)}</span>
        </div>
      </section>

      {/* 主区：列表；选中任务后右侧出现详情 */}
      <div className={`workbench-main${selected ? ' has-detail' : ''}`}>
        <Card title="待核查任务" loading={loading} styles={{ body: { padding: loading ? undefined : '4px 0' } }}>
          {tasks.length === 0 ? (
            <p className="card-empty">暂无待核查任务（连续 3 个时点无登记才会生成）</p>
          ) : (
            <ul className="task-list">
              {tasks.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`task-row${selected?.id === t.id ? ' is-selected' : ''}`}
                    aria-current={selected?.id === t.id ? 'true' : undefined}
                    onClick={() => setSelected(t)}
                  >
                    <span className="task-main">
                      <span className="task-head">
                        <span className="task-name">
                          {patientName(t.patient_id)}
                          <span className="task-code">{patientCode(t.patient_id)}</span>
                        </span>
                        {t.status === 'OPEN'
                          ? <Tag className="tag-brand">待核查</Tag>
                          : <Tag color="cyan">处理中</Tag>}
                      </span>
                      <span className="task-basis">依据：连续多次固定时点未发现登记</span>
                      <span className="task-time">生成于 {new Date(t.created_at).toLocaleString('zh-CN')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected && (
          <Card title="任务详情">
            <dl className="detail-list">
              <div>
                <dt>患者</dt>
                <dd>{patientName(selected.patient_id)}</dd>
              </div>
              <div>
                <dt>依据</dt>
                <dd>连续 3 个已到期固定时点无有效登记</dd>
              </div>
            </dl>
            <p className="basis-block">
              提示：该患者时点未发现登记，<span className="nowrap">不推定漏用药。</span>
            </p>
            <Button type="primary" block onClick={() => navigate('/followups')}>
              记录随访
            </Button>
            <Button type="link" block onClick={() => navigate(`/patients/${selected.patient_id}`)}>
              查看患者详情
            </Button>
          </Card>
        )}
      </div>

      {/* 近期随访 */}
      <Card title="近期随访" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={recentFollowups}
          locale={{ emptyText: '暂无随访记录' }}
          columns={[
            {
              title: '随访时间',
              dataIndex: 'followed_at',
              width: 200,
              render: (v: string) => <span className="tabular">{new Date(v).toLocaleString('zh-CN')}</span>,
            },
            { title: '患者', dataIndex: 'patient_id', width: 180, render: (v: string) => patientName(v) },
            { title: '反馈', dataIndex: 'feedback', render: (v: string | null) => v || '—' },
          ]}
        />
      </Card>
    </div>
  )
}
