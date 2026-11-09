import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { App, Button, Checkbox, DatePicker, Input, Select } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { ApiError, apiFetch } from '../../api/client'
import TaskCloseModal from '../../components/TaskCloseModal'
import { MedixPageHeading, PatientAvatar, PatientIdentity } from '../../components/medix'
import Surface from '../../components/medix/Surface'
import { collectPages } from './medixPaging'
import {
  formatShanghaiClock,
  looksLikeDemo,
  shanghaiParts,
  shanghaiWallIso,
  withDisambiguation,
} from './medixClinicalModel'
import '../../styles/medix-clinical.css'

interface Patient {
  id: string
  patient_code: string
  display_name: string
  diagnosis_label?: string | null
}

interface Task {
  id: string
  patient_id: string
  task_type?: string
  status: string
  created_at: string
}

interface Followup {
  id: string
  patient_id: string
  followed_at: string
  feedback: string | null
  action_taken: string | null
  next_plan: string | null
}

interface PageResult<T> {
  items: T[]
  total: number
}

interface Slice<T> {
  status: 'loading' | 'error' | 'success'
  items: T[]
  total: number
  page: number
  shown: number
  message?: string
}

const STEP = 5
const PAGE_SIZE = 50

const emptySlice = <T,>(): Slice<T> => ({ status: 'loading', items: [], total: 0, page: 0, shown: STEP })

function errorText(reason: unknown) {
  return reason instanceof Error && reason.message ? reason.message : '请求失败'
}

function shanghaiNowPicker() {
  const parts = shanghaiParts(Date.now())
  if (!parts) return dayjs()
  return dayjs(new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second))
}

function wallIso(value: Dayjs) {
  return shanghaiWallIso(value.year(), value.month() + 1, value.date(), value.hour(), value.minute(), value.second())
}

function taskLabel(task: Task) {
  const kind = task.task_type === 'MISSED_MEDICATION' ? '未发现登记' : '待核查'
  return `${kind} · ${formatShanghaiClock(task.created_at)}`
}

function ClampText({ text, tone }: { text: string | null; tone: 'plain' | 'action' | 'next' }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [overflow, setOverflow] = useState(false)
  const value = text?.trim() ?? ''
  useEffect(() => {
    const el = ref.current
    if (!el || open || !value) return
    setOverflow(el.scrollHeight > el.clientHeight + 1)
  }, [value, open])
  if (!value) return <span>—</span>
  const className = tone === 'action' ? 'ml-tag ml-tag-action' : tone === 'next' ? 'ml-tag ml-tag-next' : 'ml-feedback'
  return (
    <span className="ml-clamp-wrap">
      <span ref={ref} className={`${className} ${open ? 'is-open' : 'is-clamped'}`}>{value}</span>
      {(overflow || open) ? (
        <button type="button" className="ml-text-btn" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          {open ? '收起' : '展开'}
        </button>
      ) : null}
    </span>
  )
}

export default function FollowupPage() {
  const { modal, message } = App.useApp()
  const [params] = useSearchParams()
  const alive = useRef(true)
  const taskSeq = useRef(0)
  const recordSeq = useRef(0)
  const optionSeq = useRef(0)
  const submitLock = useRef(false)
  const returnFocus = useRef<string | null>(null)
  const modalDirty = useRef(false)
  const fetchedPatients = useRef(new Set<string>())
  const taskIdRef = useRef<string | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientsStatus, setPatientsStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [patientsNote, setPatientsNote] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Slice<Task>>(emptySlice)
  const [records, setRecords] = useState<Slice<Followup>>(emptySlice)
  const [historyPatient, setHistoryPatient] = useState<string | null>(params.get('patientId'))
  const [composing, setComposing] = useState(false)
  const [formPatient, setFormPatient] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [followedAt, setFollowedAt] = useState<Dayjs>(() => shanghaiNowPicker())
  const [feedback, setFeedback] = useState('')
  const [actionTaken, setActionTaken] = useState('')
  const [nextPlan, setNextPlan] = useState('')
  const [closeTask, setCloseTask] = useState(false)
  const [retrain, setRetrain] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [taskFieldError, setTaskFieldError] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [saveBlocked, setSaveBlocked] = useState(false)
  const [refreshError, setRefreshError] = useState(false)
  const [patientTasks, setPatientTasks] = useState<Task[]>([])
  const [patientTasksStatus, setPatientTasksStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle')
  const [closing, setClosing] = useState<{ id: string; patientId: string; patientName: string; taskType?: string } | null>(null)
  taskIdRef.current = taskId

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      taskSeq.current += 1
      recordSeq.current += 1
      optionSeq.current += 1
    }
  }, [])

  const loadPatients = async () => {
    setPatientsStatus('loading')
    try {
      const result = await collectPages<Patient>(
        (page, pageSize) => apiFetch<PageResult<Patient>>(`/api/patients?page=${page}&page_size=${pageSize}`),
        { alive: () => alive.current },
      )
      if (!alive.current) return
      setPatients(result.items)
      setPatientsStatus('success')
      setPatientsNote(result.complete ? null : `患者目录仅已加载 ${result.items.length} / ${result.total} 位`)
    } catch (error) {
      if (!alive.current) return
      setPatientsStatus('error')
      setPatientsNote(errorText(error))
    }
  }

  const loadTasks = async (page: number, replace: boolean): Promise<boolean> => {
    const seq = ++taskSeq.current
    if (replace) setTasks((prev) => ({ ...emptySlice(), status: 'loading', shown: prev.shown }))
    try {
      const result = await apiFetch<PageResult<Task>>(`/api/tasks?status=OPEN&page=${page}&page_size=${PAGE_SIZE}`)
      if (!alive.current || seq !== taskSeq.current) return true
      if (!result || !Array.isArray(result.items) || typeof result.total !== 'number') throw new Error('待核查列表不可用')
      setTasks((prev) => ({
        status: 'success',
        items: replace ? result.items : [...prev.items, ...result.items],
        total: result.total,
        page,
        shown: replace ? STEP : prev.shown,
      }))
      return true
    } catch (error) {
      if (!alive.current || seq !== taskSeq.current) return false
      if (replace) setTasks({ ...emptySlice(), status: 'error', message: errorText(error), shown: 0 })
      else message.error(errorText(error))
      return false
    }
  }

  const loadRecords = async (patient: string | null, page: number, replace: boolean): Promise<boolean> => {
    const seq = ++recordSeq.current
    if (replace) setRecords((prev) => ({ ...emptySlice(), status: 'loading', shown: STEP || prev.shown }))
    const path = patient
      ? `/api/patients/${patient}/followups?page=${page}&page_size=${PAGE_SIZE}`
      : `/api/followups?page=${page}&page_size=${PAGE_SIZE}`
    try {
      const result = await apiFetch<PageResult<Followup>>(path)
      if (!alive.current || seq !== recordSeq.current) return true
      if (!result || !Array.isArray(result.items) || typeof result.total !== 'number') throw new Error('随访记录不可用')
      setRecords((prev) => ({
        status: 'success',
        items: replace ? result.items : [...prev.items, ...result.items],
        total: result.total,
        page,
        shown: replace ? STEP : prev.shown,
      }))
      return true
    } catch (error) {
      if (!alive.current || seq !== recordSeq.current) return false
      if (replace) setRecords({ ...emptySlice(), status: 'error', message: errorText(error), shown: 0 })
      else message.error(errorText(error))
      return false
    }
  }

  useEffect(() => {
    void loadPatients()
    void loadTasks(1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadRecords(historyPatient, 1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyPatient])

  useEffect(() => {
    const preset = params.get('patientId')
    if (preset) setHistoryPatient(preset)
  }, [params])

  useEffect(() => {
    if (!formPatient) {
      setPatientTasks([])
      setPatientTasksStatus('idle')
      return
    }
    const seq = ++optionSeq.current
    const pid = formPatient
    setPatientTasksStatus('loading')
    collectPages<Task>(
      (page, pageSize) => apiFetch<PageResult<Task>>(`/api/tasks?status=OPEN&patient_id=${pid}&page=${page}&page_size=${pageSize}`),
      { alive: () => alive.current && seq === optionSeq.current },
    ).then((result) => {
      if (!alive.current || seq !== optionSeq.current) return
      const items = result.items.filter((task) => task.patient_id === pid)
      setPatientTasks(items)
      setPatientTasksStatus(result.complete ? 'success' : 'error')
      if (!result.complete) {
        setTaskId(null)
        setCloseTask(false)
        setTaskFieldError('任务列表尚未全部加载，已取消无法核实的关联')
        return
      }
      const currentTask = taskIdRef.current
      if (!(currentTask && items.some((task) => task.id === currentTask))) {
        setTaskId(null)
        setCloseTask(false)
      }
    }).catch((error: unknown) => {
      if (!alive.current || seq !== optionSeq.current) return
      setPatientTasks([])
      setPatientTasksStatus('error')
      setTaskId(null)
      setCloseTask(false)
      setTaskFieldError(errorText(error))
    })
  }, [formPatient])

  const ensurePatient = async (id: string) => {
    if (patients.some((patient) => patient.id === id) || fetchedPatients.current.has(id)) return
    fetchedPatients.current.add(id)
    try {
      const patient = await apiFetch<Patient>(`/api/patients/${id}`)
      if (!alive.current || !patient?.id || !patient.display_name) return
      setPatients((prev) => (prev.some((item) => item.id === patient.id) ? prev : [...prev, patient]))
    } catch {
      if (!alive.current) return
      setPatientsNote('有患者信息加载失败')
    }
  }

  useEffect(() => {
    const ids = new Set<string>()
    if (historyPatient) ids.add(historyPatient)
    tasks.items.forEach((task) => ids.add(task.patient_id))
    records.items.forEach((item) => ids.add(item.patient_id))
    ids.forEach((id) => { void ensurePatient(id) })
    // 缺名字时补取，不把编号当姓名
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyPatient, tasks.items, records.items, patients.length])

  const patientById = (id: string) => patients.find((patient) => patient.id === id)
  const nameOf = (id: string) => {
    const patient = patientById(id)
    if (patient?.display_name) return patient.display_name
    if (patientsStatus === 'error') return '患者信息未加载'
    return '患者信息加载中'
  }
  const nameReady = (id: string) => Boolean(patientById(id)?.display_name)
  const options = useMemo(() => withDisambiguation(patients), [patients])
  const demo = looksLikeDemo(patients.map((patient) => `${patient.display_name} ${patient.diagnosis_label ?? ''}`))

  const resetFields = () => {
    setFormPatient(null)
    setTaskId(null)
    setFollowedAt(shanghaiNowPicker())
    setFeedback('')
    setActionTaken('')
    setNextPlan('')
    setCloseTask(false)
    setRetrain(false)
    setDirty(false)
    setFormError(null)
    setTaskFieldError(null)
    setUncertain(false)
    setSaveBlocked(false)
  }

  const confirmDiscard = (next: () => void) => {
    if (submitting) return
    const busy = (composing && dirty) || (closing && modalDirty.current)
    if (!busy) {
      next()
      return
    }
    modal.confirm({
      title: '未保存的内容将被清空',
      okText: '继续',
      cancelText: '取消',
      onOk: next,
    })
  }

  const openForm = (triggerId: string, patientId?: string, linkedTask?: string) => {
    confirmDiscard(() => {
      setClosing(null)
      modalDirty.current = false
      resetFields()
      setComposing(true)
      setFormPatient(patientId ?? null)
      setTaskId(linkedTask ?? null)
      setFollowedAt(shanghaiNowPicker())
      if (patientId) setHistoryPatient(patientId)
      returnFocus.current = triggerId
      requestAnimationFrame(() => {
        document.getElementById('ml-follow-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        const node = document.getElementById(patientId ? 'ml-follow-feedback' : 'ml-follow-patient')
        node?.focus()
      })
    })
  }

  const cancelForm = () => {
    if (submitting) return
    setComposing(false)
    resetFields()
    const trigger = returnFocus.current
    if (trigger) document.getElementById(trigger)?.focus()
  }

  const openQuick = (task: Task, triggerId: string) => {
    if (!nameReady(task.patient_id) || submitting) return
    confirmDiscard(() => {
      setComposing(false)
      resetFields()
      modalDirty.current = false
      returnFocus.current = triggerId
      setClosing({
        id: task.id,
        patientId: task.patient_id,
        patientName: nameOf(task.patient_id),
        taskType: task.task_type,
      })
    })
  }

  const refreshAll = async () => {
    const [taskOk, recordOk] = await Promise.all([
      loadTasks(1, true),
      loadRecords(historyPatient, 1, true),
    ])
    if (!taskOk || !recordOk) {
      setRefreshError(true)
      message.warning('已保存，列表刷新失败')
      return false
    }
    setRefreshError(false)
    return true
  }

  const onSubmit = async () => {
    if (submitLock.current || saveBlocked) return
    if (!formPatient) {
      setFormError('请先选择患者')
      return
    }
    if (!followedAt) {
      setFormError('请选择随访时间')
      return
    }
    if (taskId) {
      const owned = patientTasks.some((task) => task.id === taskId && task.patient_id === formPatient)
      if (!owned || patientTasksStatus !== 'success') {
        setTaskFieldError('任务与患者不匹配')
        return
      }
    }
    submitLock.current = true
    setSubmitting(true)
    setFormError(null)
    setUncertain(false)
    try {
      await apiFetch('/api/followups', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: formPatient,
          task_id: taskId,
          followed_at: wallIso(followedAt),
          feedback: feedback.trim() || null,
          action_taken: actionTaken.trim() || null,
          next_plan: nextPlan.trim() || null,
          close_task: Boolean(taskId) && closeTask,
          create_retraining_reminder: retrain,
        }),
      })
      if (!alive.current) return
      message.success('随访已保存')
      setComposing(false)
      resetFields()
      await refreshAll()
      const trigger = returnFocus.current
      if (trigger) document.getElementById(trigger)?.focus()
    } catch (error) {
      if (!alive.current) return
      if (error instanceof ApiError && error.status === 409) {
        setFormError('任务已关闭')
        void loadTasks(1, true)
        return
      }
      if (error instanceof ApiError && error.status === 422) {
        setTaskFieldError('任务与患者不匹配')
        return
      }
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        setSaveBlocked(true)
        setFormError('不可访问')
        return
      }
      if (error instanceof ApiError) setFormError(error.message)
      else {
        setUncertain(true)
        setFormError('结果未确认，请刷新核对')
      }
    } finally {
      submitLock.current = false
      if (alive.current) setSubmitting(false)
    }
  }

  const showMore = async (kind: 'tasks' | 'records') => {
    const slice = kind === 'tasks' ? tasks : records
    if (slice.status !== 'success') return
    if (slice.shown < slice.items.length) {
      const next = Math.min(slice.items.length, slice.shown + STEP)
      if (kind === 'tasks') setTasks((prev) => ({ ...prev, shown: next }))
      else setRecords((prev) => ({ ...prev, shown: next }))
      return
    }
    if (slice.items.length >= slice.total) return
    const ok = kind === 'tasks'
      ? await loadTasks(slice.page + 1, false)
      : await loadRecords(historyPatient, slice.page + 1, false)
    if (!ok) return
    if (kind === 'tasks') setTasks((prev) => ({ ...prev, shown: prev.shown + STEP }))
    else setRecords((prev) => ({ ...prev, shown: prev.shown + STEP }))
  }

  const taskRemain = tasks.status === 'success' ? Math.max(tasks.total - Math.min(tasks.shown, tasks.items.length), 0) : 0
  const recordRemain = records.status === 'success' ? Math.max(records.total - Math.min(records.shown, records.items.length), 0) : 0

  return (
    <div className="ml-followups">
      <MedixPageHeading
        title="随访中心"
        date={demo ? <span className="ml-demo-pill">演示数据</span> : undefined}
        actions={
          <Button id="follow-new" type="primary" disabled={submitting} onClick={() => openForm('follow-new')}>
            新建随访
          </Button>
        }
      />
      {patientsStatus === 'error' ? (
        <p className="ml-inline-error">
          <span className="ml-field-error">加载失败</span>
          <button type="button" className="ml-text-btn" onClick={() => void loadPatients()}>重试</button>
          <span>{patientsNote}</span>
        </p>
      ) : null}
      {patientsStatus === 'success' && patientsNote ? <p className="ml-hint">{patientsNote}</p> : null}

      {composing ? (
        <div id="ml-follow-form">
          <Surface title="记录随访">
            <div className="ml-form-grid">
              <div className="ml-field">
                <label className="ml-field-label" htmlFor="ml-follow-patient">患者</label>
                <Select
                  id="ml-follow-patient"
                  aria-label="选择患者"
                  placeholder="选择患者"
                  disabled={submitting || patientsStatus !== 'success'}
                  value={formPatient ?? undefined}
                  showSearch
                  options={options.map((patient) => ({ value: patient.id, label: patient.label, code: patient.patient_code }))}
                  filterOption={(input, option) => {
                    const query = input.trim().toLowerCase()
                    return String(option?.label ?? '').toLowerCase().includes(query)
                      || String(option?.code ?? '').toLowerCase().includes(query)
                  }}
                  onChange={(id: string) => {
                    if (id === formPatient) return
                    const apply = () => {
                      setFormPatient(id)
                      setTaskId(null)
                      setCloseTask(false)
                      setDirty(true)
                    }
                    if (dirty) {
                      modal.confirm({
                        title: '切换患者将清空未保存内容',
                        okText: '切换',
                        cancelText: '取消',
                        onOk: apply,
                      })
                      return
                    }
                    apply()
                  }}
                />
              </div>
              <div className="ml-field">
                <label className="ml-field-label" htmlFor="ml-follow-task">关联任务</label>
                <Select
                  id="ml-follow-task"
                  allowClear
                  placeholder="不关联任务"
                  disabled={submitting || !formPatient || patientTasksStatus !== 'success'}
                  value={taskId ?? undefined}
                  options={patientTasks.map((task) => ({ value: task.id, label: taskLabel(task) }))}
                  onChange={(value: string | undefined) => {
                    setDirty(true)
                    setTaskId(value ?? null)
                    if (!value) setCloseTask(false)
                    setTaskFieldError(null)
                  }}
                />
                {taskFieldError ? <span className="ml-field-error">{taskFieldError}</span> : null}
              </div>
              <div className="ml-field is-wide">
                <label className="ml-field-label" htmlFor="ml-follow-time">随访时间</label>
                <DatePicker
                  id="ml-follow-time"
                  showTime
                  style={{ width: '100%' }}
                  disabled={submitting}
                  value={followedAt}
                  onChange={(value) => {
                    if (!value) return
                    setDirty(true)
                    setFollowedAt(value)
                  }}
                />
              </div>
              <div className="ml-field is-wide">
                <label className="ml-field-label" htmlFor="ml-follow-feedback">反馈</label>
                <Input.TextArea id="ml-follow-feedback" rows={3} disabled={submitting} value={feedback} onChange={(event) => { setDirty(true); setFeedback(event.target.value) }} />
              </div>
              <div className="ml-field is-wide">
                <label className="ml-field-label" htmlFor="ml-follow-action">措施</label>
                <Input.TextArea id="ml-follow-action" rows={3} disabled={submitting} value={actionTaken} onChange={(event) => { setDirty(true); setActionTaken(event.target.value) }} />
              </div>
              <div className="ml-field is-wide">
                <label className="ml-field-label" htmlFor="ml-follow-next">后续</label>
                <Input.TextArea id="ml-follow-next" rows={3} disabled={submitting} value={nextPlan} onChange={(event) => { setDirty(true); setNextPlan(event.target.value) }} />
              </div>
            </div>
            <div className="ml-check-row">
              <Checkbox
                checked={closeTask}
                disabled={submitting || !taskId}
                onChange={(event) => {
                  setDirty(true)
                  setCloseTask(event.target.checked)
                }}
              >
                同时关闭关联任务
              </Checkbox>
              <Checkbox checked={retrain} disabled={submitting} onChange={(event) => { setDirty(true); setRetrain(event.target.checked) }}>
                安排操作复训提醒
              </Checkbox>
            </div>
            <div className="ml-form-actions">
              <Button type="primary" loading={submitting} disabled={saveBlocked} onClick={() => void onSubmit()}>保存</Button>
              <Button disabled={submitting} onClick={cancelForm}>取消</Button>
            </div>
            {formError ? (
              <p className="ml-inline-error" role="alert">
                <span className="ml-field-error">{formError}</span>
                {uncertain ? <button type="button" className="ml-text-btn" onClick={() => void refreshAll()}>刷新核对</button> : null}
              </p>
            ) : null}
          </Surface>
        </div>
      ) : null}

      {refreshError ? (
        <p className="ml-inline-error">
          <span className="ml-field-error">已保存，列表刷新失败</span>
          <button type="button" className="ml-text-btn" onClick={() => void refreshAll()}>重试</button>
        </p>
      ) : null}

      <Surface title="待核查" actions={tasks.status === 'success' ? <span className="ml-count">{tasks.total}</span> : null}>
        {tasks.status === 'loading' ? <div className="ml-skeleton" aria-busy="true" aria-label="加载中" /> : null}
        {tasks.status === 'error' ? (
          <p className="ml-inline-error">
            <span className="ml-field-error">加载失败</span>
            <button type="button" className="ml-text-btn" onClick={() => void loadTasks(1, true)}>重试</button>
          </p>
        ) : null}
        {tasks.status === 'success' && tasks.total === 0 ? <p className="ml-empty">暂无待核查任务</p> : null}
        {tasks.status === 'success' && tasks.items.length > 0 ? (
          <div className="ml-table-wrap">
            <table className="ml-table">
              <thead>
                <tr>
                  <th scope="col">患者</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.items.slice(0, tasks.shown).map((task) => {
                  const ready = nameReady(task.patient_id)
                  return (
                    <tr key={task.id}>
                      <th scope="row">
                        <PatientIdentity
                          name={nameOf(task.patient_id)}
                          avatar={<PatientAvatar name={ready ? nameOf(task.patient_id) : ''} patientId={task.patient_id} />}
                        />
                      </th>
                      <td>
                        <div className="ml-follow-actions">
                          <button
                            id={`task-quick-${task.id}`}
                            type="button"
                            className="ml-outline-btn"
                            disabled={!ready || submitting}
                            onClick={() => openQuick(task, `task-quick-${task.id}`)}
                          >
                            快速处理
                          </button>
                          <button
                            id={`task-fill-${task.id}`}
                            type="button"
                            className="ml-outline-btn"
                            disabled={!ready || submitting}
                            onClick={() => openForm(`task-fill-${task.id}`, task.patient_id, task.id)}
                          >
                            填写随访
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {taskRemain > 0 ? (
          <div className="ml-fold-row">
            <button type="button" className="ml-fold" onClick={() => void showMore('tasks')}>加载更多（还有 {taskRemain}）</button>
          </div>
        ) : null}
      </Surface>

      <Surface
        title="随访记录"
        actions={
          <Select
            aria-label="按患者筛选随访记录"
            allowClear
            placeholder="全部患者"
            style={{ minWidth: '12rem' }}
            value={historyPatient ?? undefined}
            disabled={patientsStatus === 'loading'}
            showSearch
            options={options.map((patient) => ({ value: patient.id, label: patient.label, code: patient.patient_code }))}
            filterOption={(input, option) => {
              const query = input.trim().toLowerCase()
              return String(option?.label ?? '').toLowerCase().includes(query)
                || String(option?.code ?? '').toLowerCase().includes(query)
            }}
            onChange={(value: string | undefined) => setHistoryPatient(value ?? null)}
          />
        }
      >
        {records.status === 'loading' ? <div className="ml-skeleton" aria-busy="true" aria-label="加载中" /> : null}
        {records.status === 'error' ? (
          <p className="ml-inline-error">
            <span className="ml-field-error">加载失败</span>
            <button type="button" className="ml-text-btn" onClick={() => void loadRecords(historyPatient, 1, true)}>重试</button>
          </p>
        ) : null}
        {records.status === 'success' && records.total === 0 ? <p className="ml-empty">暂无随访记录</p> : null}
        {records.status === 'success' && records.items.length > 0 ? (
          <div className="ml-follow-table-wrap">
            <table className="ml-table ml-follow-table">
              <thead>
                <tr>
                  <th className="ml-col-time" scope="col">时间</th>
                  <th className="ml-col-who" scope="col">患者</th>
                  <th className="ml-col-feedback" scope="col">反馈</th>
                  <th className="ml-col-action" scope="col">措施</th>
                  <th className="ml-col-next" scope="col">后续</th>
                </tr>
              </thead>
              <tbody>
                {records.items.slice(0, records.shown).map((item) => (
                  <tr key={item.id}>
                    <td>{formatShanghaiClock(item.followed_at)}</td>
                    <td>
                      <PatientIdentity
                        name={nameOf(item.patient_id)}
                        avatar={<PatientAvatar name={nameReady(item.patient_id) ? nameOf(item.patient_id) : ''} patientId={item.patient_id} />}
                      />
                    </td>
                    <td><ClampText text={item.feedback} tone="plain" /></td>
                    <td><ClampText text={item.action_taken} tone="action" /></td>
                    <td><ClampText text={item.next_plan} tone="next" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {recordRemain > 0 ? (
          <div className="ml-fold-row">
            <button type="button" className="ml-fold" onClick={() => void showMore('records')}>加载更多（还有 {recordRemain}）</button>
          </div>
        ) : null}
      </Surface>

      <TaskCloseModal
        appearance="medix"
        open={!!closing}
        task={closing}
        onDirtyChange={(value) => { modalDirty.current = value }}
        onClose={() => {
          const trigger = returnFocus.current
          setClosing(null)
          modalDirty.current = false
          if (trigger) document.getElementById(trigger)?.focus()
        }}
        onInvalidate={() => refreshAll()}
        onSuccess={() => refreshAll()}
      />
    </div>
  )
}
