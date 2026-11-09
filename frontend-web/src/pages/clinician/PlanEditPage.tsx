import { useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, DatePicker, Input, Radio, Select } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { ApiError, apiFetch } from '../../api/client'
import DailyTimesEditor from '../../components/medix/DailyTimesEditor'
import { MedixPageHeading, PatientAvatar } from '../../components/medix'
import Surface from '../../components/medix/Surface'
import { collectPages } from './medixPaging'
import {
  civilDate,
  derivePlanPhase,
  formatPlanBound,
  inclusiveEndToExclusiveIso,
  looksLikeDemo,
  normalizeDailyTimes,
  numbersToCivil,
  shanghaiDayStartIso,
  withDisambiguation,
  type PlanPhase,
} from './medixClinicalModel'
import '../../styles/medix-clinical.css'

interface Patient {
  id: string
  patient_code: string
  display_name: string
  diagnosis_label?: string | null
  note?: string | null
}

interface DeviceModel {
  id: string
  model_name: string
}

interface DailyTime {
  id: string
  local_time: string
  label: string | null
  is_enabled: boolean
}

interface Plan {
  id: string
  plan_group_id: string
  version: number
  drug_label: string
  plan_type: string
  timezone: string
  starts_at: string
  ends_at: string | null
  daily_times: DailyTime[]
}

interface PageResult<T> {
  items: T[]
  total: number
}

type ListStatus = 'idle' | 'loading' | 'error' | 'success'

const PHASE_LABEL: Record<PlanPhase, string> = {
  pending: '待生效',
  active: '生效中',
  ended: '已结束',
  invalid: '状态不可用',
}

const VISIBLE_STEP = 5

function cleanDemo(value: string) {
  return value.replace(/\s*[(（]DEMO[)）]/gi, '').trim()
}

function errorText(reason: unknown) {
  return reason instanceof Error && reason.message ? reason.message : '请求失败'
}

function asDay(value: Dayjs | null): string | null {
  if (!value) return null
  return numbersToCivil(value.year(), value.month(), value.date())
}

export default function PlanEditPage() {
  const { modal, message } = App.useApp()
  const alive = useRef(true)
  const planSeq = useRef(0)
  const submitLock = useRef(false)
  const [now, setNow] = useState(() => Date.now())
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientTotal, setPatientTotal] = useState(0)
  const [patientsComplete, setPatientsComplete] = useState(true)
  const [patientsStatus, setPatientsStatus] = useState<ListStatus>('loading')
  const [patientsError, setPatientsError] = useState<string | null>(null)
  const [models, setModels] = useState<DeviceModel[]>([])
  const [modelsComplete, setModelsComplete] = useState(true)
  const [modelsStatus, setModelsStatus] = useState<ListStatus>('loading')
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [patientId, setPatientId] = useState<string | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [planTotal, setPlanTotal] = useState(0)
  const [planPage, setPlanPage] = useState(0)
  const [planStatus, setPlanStatus] = useState<ListStatus>('idle')
  const [planError, setPlanError] = useState<string | null>(null)
  const [visiblePlans, setVisiblePlans] = useState(VISIBLE_STEP)
  const [loadingMore, setLoadingMore] = useState(false)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [drug, setDrug] = useState('')
  const [planType, setPlanType] = useState<'REGULAR' | 'PRN'>('REGULAR')
  const [startDay, setStartDay] = useState<string | null>(null)
  const [endDay, setEndDay] = useState<string | null>(null)
  const [times, setTimes] = useState<string[]>([])
  const [fieldError, setFieldError] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [refreshError, setRefreshError] = useState(false)

  useEffect(() => {
    alive.current = true
    const bump = () => {
      if (document.visibilityState === 'hidden') return
      setNow(Date.now())
    }
    window.addEventListener('focus', bump)
    document.addEventListener('visibilitychange', bump)
    return () => {
      alive.current = false
      planSeq.current += 1
      window.removeEventListener('focus', bump)
      document.removeEventListener('visibilitychange', bump)
    }
  }, [])

  const loadPatients = async () => {
    setPatientsStatus('loading')
    setPatientsError(null)
    try {
      const result = await collectPages<Patient>(
        (page, pageSize) => apiFetch<PageResult<Patient>>(`/api/patients?page=${page}&page_size=${pageSize}`),
        { alive: () => alive.current },
      )
      if (!alive.current) return
      setPatients(result.items)
      setPatientTotal(result.total)
      setPatientsComplete(result.complete)
      setPatientsStatus('success')
    } catch (error) {
      if (!alive.current) return
      setPatientsStatus('error')
      setPatientsError(errorText(error))
    }
  }

  const loadModels = async () => {
    setModelsStatus('loading')
    setModelsError(null)
    try {
      const result = await collectPages<DeviceModel>(
        (page, pageSize) => apiFetch<PageResult<DeviceModel>>(`/api/device-models?page=${page}&page_size=${pageSize}`),
        { alive: () => alive.current },
      )
      if (!alive.current) return
      setModels(result.items)
      setModelsComplete(result.complete)
      setModelsStatus('success')
    } catch (error) {
      if (!alive.current) return
      setModelsStatus('error')
      setModelsError(errorText(error))
    }
  }

  useEffect(() => {
    void loadPatients()
    void loadModels()
    // 只在进入页面时拉目录
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetForm = () => {
    setDeviceId(null)
    setDrug('')
    setPlanType('REGULAR')
    setStartDay(null)
    setEndDay(null)
    setTimes([])
    setFieldError({})
    setFormError(null)
    setUncertain(false)
    setDirty(false)
    setRefreshError(false)
  }

  const loadPlans = async (pid: string, page: number, replace: boolean): Promise<boolean> => {
    const seq = ++planSeq.current
    if (replace) {
      setPlanStatus('loading')
      setPlanError(null)
      setPlans([])
      setPlanTotal(0)
      setVisiblePlans(VISIBLE_STEP)
    } else {
      setLoadingMore(true)
    }
    try {
      const result = await apiFetch<PageResult<Plan>>(
        `/api/patients/${pid}/medication-plans?include_history=true&page=${page}&page_size=100`,
      )
      if (!alive.current || seq !== planSeq.current) return true
      if (!result || !Array.isArray(result.items) || typeof result.total !== 'number') {
        throw new Error('计划列表不可用')
      }
      setPlans((prev) => (replace ? result.items : [...prev, ...result.items]))
      setPlanTotal(result.total)
      setPlanPage(page)
      setPlanStatus('success')
      setPlanError(null)
      setNow(Date.now())
      setRefreshError(false)
      return true
    } catch (error) {
      if (!alive.current || seq !== planSeq.current) return false
      if (replace) {
        setPlanStatus('error')
        setPlanError(errorText(error))
        setPlans([])
      } else {
        message.error(errorText(error))
      }
      return false
    } finally {
      if (alive.current && seq === planSeq.current) setLoadingMore(false)
    }
  }

  useEffect(() => {
    resetForm()
    if (!patientId) {
      planSeq.current += 1
      setPlans([])
      setPlanTotal(0)
      setPlanStatus('idle')
      setPlanError(null)
      return
    }
    void loadPlans(patientId, 1, true)
    // loadPlans 读取当次 patientId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  const patientOptions = useMemo(() => withDisambiguation(patients), [patients])
  const selected = patients.find((patient) => patient.id === patientId) ?? null
  const demo = looksLikeDemo([
    selected?.display_name,
    selected?.diagnosis_label,
    selected?.note,
    ...plans.map((plan) => plan.drug_label),
  ])

  const markDirty = () => setDirty(true)

  const applyPatient = (nextId: string) => {
    if (submitting || nextId === patientId) return
    const apply = () => setPatientId(nextId)
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
  }

  const showMore = async () => {
    if (!patientId || loadingMore) return
    if (visiblePlans < plans.length) {
      setVisiblePlans((count) => Math.min(plans.length, count + VISIBLE_STEP))
      return
    }
    if (plans.length < planTotal) {
      const ok = await loadPlans(patientId, planPage + 1, false)
      if (ok) setVisiblePlans((count) => count + VISIBLE_STEP)
    }
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (!deviceId) next.device = '请选择装置型号'
    if (!drug.trim()) next.drug = '请输入药物名称'
    if (!startDay) next.start = '请选择开始日期'
    if (startDay && endDay && endDay < startDay) next.end = '结束日期不能早于开始日期'
    if (planType === 'REGULAR') {
      const timesResult = normalizeDailyTimes(times)
      if (!timesResult.ok) next.times = timesResult.error
    }
    setFieldError(next)
    return Object.keys(next).length === 0
  }

  const onCreate = async () => {
    if (!patientId || submitLock.current) return
    setFormError(null)
    setUncertain(false)
    if (!validate() || !startDay) return
    const normalized = planType === 'REGULAR' ? normalizeDailyTimes(times) : { ok: true as const, times: [] as string[] }
    if (!normalized.ok) return
    submitLock.current = true
    setSubmitting(true)
    try {
      await apiFetch(`/api/patients/${patientId}/medication-plans`, {
        method: 'POST',
        body: JSON.stringify({
          device_model_id: deviceId,
          drug_label: drug.trim(),
          plan_type: planType,
          timezone: 'Asia/Shanghai',
          starts_at: shanghaiDayStartIso(startDay),
          ends_at: endDay ? inclusiveEndToExclusiveIso(endDay) : null,
          daily_times: planType === 'REGULAR'
            ? normalized.times.map((localTime, index) => ({ local_time: localTime, label: `时点${index + 1}` }))
            : [],
        }),
      })
      if (!alive.current) return
      message.success('计划已创建')
      resetForm()
      const refreshed = await loadPlans(patientId, 1, true)
      if (!refreshed) {
        setRefreshError(true)
        message.warning('已保存，列表刷新失败')
      }
    } catch (error) {
      if (!alive.current) return
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

  const formDisabled = !patientId || submitting
  const remain = Math.max(planTotal - Math.min(visiblePlans, plans.length), 0)

  return (
    <div className="ml-plans">
      <MedixPageHeading
        title="用药计划"
        actions={
          <div className="ml-patient-picker">
            {selected ? <PatientAvatar name={selected.display_name} patientId={selected.id} size="sm" /> : null}
            <Select
              className="ml-patient-select"
              aria-label="选择患者"
              placeholder={patientsStatus === 'error' ? '患者加载失败' : '选择患者'}
              disabled={submitting || patientsStatus !== 'success'}
              value={patientId ?? undefined}
              showSearch
              options={patientOptions.map((patient) => ({
                value: patient.id,
                label: patient.label,
                code: patient.patient_code,
              }))}
              filterOption={(input, option) => {
                const query = input.trim().toLowerCase()
                const label = String(option?.label ?? '').toLowerCase()
                const code = String(option?.code ?? '').toLowerCase()
                return label.includes(query) || code.includes(query)
              }}
              onChange={applyPatient}
            />
            {demo ? <span className="ml-demo-pill">演示数据</span> : null}
          </div>
        }
      />

      {patientsStatus === 'error' ? (
        <p className="ml-inline-error ml-block-error">
          加载失败
          <button type="button" className="ml-text-btn" onClick={() => void loadPatients()}>重试</button>
          <span>{patientsError}</span>
        </p>
      ) : null}
      {patientsStatus === 'success' && !patientsComplete ? (
        <p className="ml-hint">患者目录仅已加载 {patients.length} / {patientTotal} 位</p>
      ) : null}

      <div className="ml-plans-grid">
        <Surface title="新建计划">
          <div className="ml-field">
            <label className="ml-field-label" htmlFor="plan-device">装置型号</label>
            {modelsStatus === 'error' ? (
              <p className="ml-inline-error">
                <span className="ml-field-error">加载失败</span>
                <button type="button" className="ml-text-btn" onClick={() => void loadModels()}>重试</button>
              </p>
            ) : (
              <Select
                id="plan-device"
                aria-label="装置型号"
                placeholder={modelsStatus === 'loading' ? '加载中…' : '请选择装置型号'}
                disabled={formDisabled || modelsStatus !== 'success'}
                value={deviceId ?? undefined}
                options={models.map((model) => ({ value: model.id, label: model.model_name }))}
                onChange={(value) => {
                  markDirty()
                  setDeviceId(value)
                }}
              />
            )}
            {modelsStatus === 'success' && models.length === 0 ? <span className="ml-hint">暂无装置型号</span> : null}
            {modelsStatus === 'success' && !modelsComplete ? <span className="ml-hint">装置目录尚未全部加载</span> : null}
            {fieldError.device ? <span className="ml-field-error">{fieldError.device}</span> : null}
            {modelsError && modelsStatus === 'error' ? <span className="ml-field-error">{modelsError}</span> : null}
          </div>

          <div className="ml-field">
            <label className="ml-field-label" htmlFor="plan-drug">药物名称</label>
            <Input
              id="plan-drug"
              placeholder="请输入药物名称"
              disabled={formDisabled}
              value={drug}
              onChange={(event) => {
                markDirty()
                setDrug(event.target.value)
              }}
            />
            {fieldError.drug ? <span className="ml-field-error">{fieldError.drug}</span> : null}
          </div>

          <div className="ml-field">
            <span className="ml-field-label">计划类型</span>
            <Radio.Group
              className="ml-radio-row"
              disabled={formDisabled}
              value={planType}
              onChange={(event) => {
                markDirty()
                setPlanType(event.target.value)
              }}
            >
              <Radio value="REGULAR">固定</Radio>
              <Radio value="PRN">按需</Radio>
            </Radio.Group>
          </div>

          <div className="ml-date-grid">
            <div className="ml-field">
              <label className="ml-field-label" htmlFor="plan-start">开始日期</label>
              <DatePicker
                id="plan-start"
                style={{ width: '100%' }}
                disabled={formDisabled}
                value={startDay ? dayjs(civilDate(startDay)) : null}
                placeholder="请选择日期"
                onChange={(value) => {
                  markDirty()
                  setStartDay(asDay(value))
                }}
              />
              {fieldError.start ? <span className="ml-field-error">{fieldError.start}</span> : null}
            </div>
            <div className="ml-field">
              <label className="ml-field-label" htmlFor="plan-end">结束日期（选填）</label>
              <DatePicker
                id="plan-end"
                style={{ width: '100%' }}
                disabled={formDisabled}
                value={endDay ? dayjs(civilDate(endDay)) : null}
                placeholder="请选择日期"
                onChange={(value) => {
                  markDirty()
                  setEndDay(asDay(value))
                }}
              />
              {fieldError.end ? <span className="ml-field-error">{fieldError.end}</span> : null}
            </div>
          </div>

          {planType === 'REGULAR' ? (
            <div className="ml-field">
              <span className="ml-field-label">每日时点</span>
              <DailyTimesEditor
                value={times}
                disabled={formDisabled}
                error={fieldError.times}
                onChange={(next) => {
                  markDirty()
                  setTimes(next)
                }}
              />
            </div>
          ) : null}

          <Button className="ml-submit" type="primary" disabled={!patientId} loading={submitting} onClick={() => void onCreate()}>
            创建计划
          </Button>
          {formError ? (
            <p className="ml-inline-error" role="alert">
              <span className="ml-field-error">{formError}</span>
              {uncertain && patientId ? (
                <button type="button" className="ml-text-btn" onClick={() => void loadPlans(patientId, 1, true)}>刷新核对</button>
              ) : null}
            </p>
          ) : null}
          {refreshError && patientId ? (
            <p className="ml-inline-error">
              <span className="ml-field-error">已保存，列表刷新失败</span>
              <button type="button" className="ml-text-btn" onClick={() => void loadPlans(patientId, 1, true)}>重试</button>
            </p>
          ) : null}
        </Surface>

        <Surface title="历史计划">
          {!patientId ? <p className="ml-empty">请选择患者</p> : null}
          {patientId && planStatus === 'loading' ? <div className="ml-skeleton" aria-busy="true" aria-label="加载中" /> : null}
          {patientId && planStatus === 'error' ? (
            <p className="ml-inline-error">
              <span className="ml-field-error">加载失败</span>
              <button type="button" className="ml-text-btn" onClick={() => void loadPlans(patientId, 1, true)}>重试</button>
              <span>{planError}</span>
            </p>
          ) : null}
          {patientId && planStatus === 'success' && plans.length === 0 ? <p className="ml-empty">暂无计划</p> : null}
          {patientId && planStatus === 'success' && plans.length > 0 ? (
            <>
              <ul className="ml-plan-list">
                {plans.slice(0, visiblePlans).map((plan) => {
                  const phase = derivePlanPhase(plan, now)
                  const enabled = (plan.daily_times ?? []).filter((item) => item.is_enabled)
                  const clocks = enabled
                    .map((item) => String(item.local_time).slice(0, 5))
                    .filter((item) => /^\d{2}:\d{2}$/.test(item))
                    .sort((a, b) => a.localeCompare(b))
                  const range = plan.ends_at
                    ? `${formatPlanBound(plan.starts_at, 'start')}—${formatPlanBound(plan.ends_at, 'end')}`
                    : `${formatPlanBound(plan.starts_at, 'start')} 起`
                  return (
                    <li key={plan.id} className="ml-plan-item">
                      <div className="ml-plan-line">
                        <span className="ml-plan-drug">{cleanDemo(plan.drug_label)}</span>
                        <span className={`ml-phase ml-phase-${phase}`}>{PHASE_LABEL[phase]}</span>
                      </div>
                      <div className="ml-plan-meta">
                        <span>{range}</span>
                        <span>{plan.plan_type === 'REGULAR' ? (clocks.join(' · ') || '—') : '按需'}</span>
                      </div>
                      {phase === 'invalid' ? <span className="ml-field-error">数据异常</span> : null}
                    </li>
                  )
                })}
              </ul>
              {remain > 0 ? (
                <div className="ml-fold-row">
                  <button type="button" className="ml-fold" disabled={loadingMore} onClick={() => void showMore()}>
                    {loadingMore ? '加载中…' : `加载更多（还有 ${remain}）`}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </Surface>
      </div>
    </div>
  )
}
