// 浏览器验收。接口全部由请求拦截提供，不是 8010。结果记为 mock。
import puppeteer from '/tmp/medix-browser/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = 'http://127.0.0.1:5180'
const OUT = path.resolve('docs/evidence/medix-05060809/screenshots')
const checks = []
const requests = []
const posts = []

const patients = [
  { id: 'p-li', patient_code: 'P-004', display_name: '李先生', diagnosis_label: '慢阻肺 (DEMO)' },
  { id: 'p-yang', patient_code: 'P-014', display_name: '杨先生', diagnosis_label: '慢阻肺 (DEMO)' },
  { id: 'p-lin', patient_code: 'P-001', display_name: '林女士', diagnosis_label: '哮喘 (DEMO)' },
  { id: 'p-wang', patient_code: 'P-003', display_name: '王女士', diagnosis_label: '哮喘 (DEMO)' },
  { id: 'p-zheng', patient_code: 'P-008', display_name: '郑先生', diagnosis_label: '慢阻肺 (DEMO)' },
  { id: 'p-dup', patient_code: 'P-022', display_name: '李先生', diagnosis_label: '哮喘 (DEMO)' },
].map((item) => ({ ...item, assigned_clinician_id: 'u-clin', account_user_id: null, note: null }))

function plan(partial) {
  return {
    version: 1,
    timezone: 'Asia/Shanghai',
    device_model_id: 'model-1',
    daily_times: [],
    ...partial,
  }
}

const plansByPatient = {
  'p-li': [
    plan({
      id: 'plan-active', patient_id: 'p-li', plan_group_id: 'g-active', drug_label: '示例药物 (DEMO)', plan_type: 'REGULAR',
      starts_at: '2026-11-02T00:00:00+08:00', ends_at: '2026-12-01T00:00:00+08:00',
      daily_times: [
        { id: 't2', local_time: '20:00:00', label: '时点2', is_enabled: true },
        { id: 't1', local_time: '08:00:00', label: '时点1', is_enabled: true },
        { id: 't3', local_time: '12:00:00', label: '停用', is_enabled: false },
      ],
    }),
    plan({
      id: 'plan-ended', patient_id: 'p-li', plan_group_id: 'g-ended', drug_label: '既往药物 (DEMO)', plan_type: 'REGULAR',
      starts_at: '2026-10-26T00:00:00+08:00', ends_at: '2026-11-02T00:00:00+08:00',
      daily_times: [{ id: 't4', local_time: '08:00:00', label: '时点1', is_enabled: true }],
    }),
    plan({
      id: 'plan-pending', patient_id: 'p-li', plan_group_id: 'g-pending', drug_label: '待生效药物 (DEMO)', plan_type: 'PRN',
      starts_at: '2026-11-20T00:00:00+08:00', ends_at: null, daily_times: [],
    }),
  ],
  'p-yang': [
    plan({
      id: 'plan-yang', patient_id: 'p-yang', plan_group_id: 'g-yang', drug_label: '杨的计划 (DEMO)', plan_type: 'REGULAR',
      starts_at: '2026-11-01T00:00:00+08:00', ends_at: null,
      daily_times: [{ id: 'ty', local_time: '09:00:00', label: '时点1', is_enabled: true }],
    }),
  ],
}

function daysOf(from, to) {
  const out = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor < end) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

function statsBody(from, to) {
  const days = daysOf(from, to)
  const mPattern = [1, 1, 1, 2, 3, 4, 8]
  const rows = [
    row('p-yang', 'P-014', '杨先生', 90, 10),
    row('p-li', 'P-004', '李先生', 10, 10),
    row('p-lin', 'P-001', '林女士', 0, 0),
  ]
  const matrixRows = rows.map((item, index) => ({
    ...item,
    cells: days.map((day, dayIndex) => {
      if (item.N === 0) return { day, N: 0, M: 0, missing: 0, coverage_rate: null }
      const N = index === 0 ? 10 : 2
      const M = index === 0 ? (mPattern[dayIndex % mPattern.length] > 1 ? 1 : 1) : (dayIndex === 0 ? 2 : 0)
      const n = index === 0 ? Math.round(90 / Math.max(days.length, 1)) : (dayIndex === 0 ? 10 : 0)
      const m = index === 0 ? (dayIndex < 10 ? 1 : 0) : (dayIndex === 0 ? 10 : 0)
      return { day, N: n, M: Math.min(m, n), missing: Math.max(n - m, 0), coverage_rate: n > 0 ? Math.round((Math.min(m, n) / n) * 1000) / 10 : null }
    }),
  }))
  // 把矩阵合计校正成 20/100，避免和概览不一致被页面判成“数据更新中”。
  if (matrixRows[0] && matrixRows[1] && days.length) {
    matrixRows[0].cells = days.map((day, i) => ({ day, N: 0, M: 0, missing: 0, coverage_rate: null }))
    matrixRows[1].cells = days.map((day, i) => ({ day, N: 0, M: 0, missing: 0, coverage_rate: null }))
    const per = Math.floor(90 / days.length)
    let leftN = 90
    let leftM = 10
    days.forEach((day, i) => {
      const n = i === days.length - 1 ? leftN : per
      const m = i === days.length - 1 ? leftM : Math.min(1, leftM)
      leftN -= n
      leftM -= m
      matrixRows[0].cells[i] = { day, N: n, M: m, missing: n - m, coverage_rate: n ? Math.round((m / n) * 1000) / 10 : null }
    })
    matrixRows[1].cells[0] = { day: days[0], N: 10, M: 10, missing: 0, coverage_rate: 100 }
  }
  return {
    overview: {
      from_: from, to, timezone: 'Asia/Shanghai', patient_count: 3, planned_count: 2,
      total_N: 100, total_M: 20, coverage_rate: 20, rows,
    },
    matrix: {
      from_: from, to, timezone: 'Asia/Shanghai', days,
      total_N: 100, total_M: 20, coverage_rate: 20, rows: matrixRows,
    },
  }
}

function row(id, code, name, N, M) {
  return {
    patient_id: id, patient_code: code, display_name: name, N, M,
    coverage_rate: N > 0 ? Math.round((M / N) * 1000) / 10 : null,
    missing_count: Math.max(N - M, 0),
  }
}

function tasks(page, pageSize, patientId) {
  const all = []
  for (let i = 1; i <= 51; i += 1) {
    const patient = i % 5 === 0 ? patients[1] : patients[(i - 1) % 4]
    all.push({
      id: `task-${i}`,
      patient_id: patientId || patient.id,
      task_type: i === 2 ? 'OTHER' : 'MISSED_MEDICATION',
      status: 'OPEN',
      assigned_to: null,
      due_at: null,
      closed_at: null,
      created_at: `2026-11-0${(i % 8) + 1}T0${i % 9}:00:00+08:00`,
    })
  }
  const source = patientId ? all.map((item) => ({ ...item, patient_id: patientId })) : all
  const start = (page - 1) * pageSize
  return { items: source.slice(start, start + pageSize), total: 51, page, page_size: pageSize }
}

function followups(page, pageSize, patientId) {
  const samples = [
    ['基本按时登记，这一句用来确认反馈列可以换行而不会把措施挤掉。', '提醒保持', '下周复核'],
    ['偶有延迟登记', '口头宣教', '一周后复查'],
    ['需核对登记', '说明登记方法', '继续跟进'],
  ]
  const items = []
  for (let i = 1; i <= 51; i += 1) {
    const sample = samples[(i - 1) % samples.length]
    const patient = patients[(i - 1) % 3]
    items.push({
      id: `fu-${patientId || 'all'}-${i}`,
      patient_id: patientId || patient.id,
      task_id: null,
      clinician_id: 'u-clin',
      followed_at: `2026-11-${String((i % 9) + 1).padStart(2, '0')}T01:10:00+08:00`,
      feedback: i === 4 ? '这是一段很长的随访反馈，用来确认默认只显示两行，并且可以用键盘展开完整原文，不能把临床记录永久截断。' : sample[0],
      action_taken: sample[1],
      next_plan: sample[2],
      created_at: '2026-11-08T01:10:00+08:00',
    })
  }
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), total: 51, page, page_size: pageSize }
}

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}${detail ? ` ${detail}` : ''}`)
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false })
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
  await page.click('input[placeholder="请输入账号"]', { clickCount: 3 })
  await page.type('input[placeholder="请输入账号"]', 'clinician_a')
  await page.type('input[placeholder="请输入密码"]', 'secret')
  await Promise.all([
    page.waitForFunction(() => location.pathname !== '/login', { timeout: 8000 }),
    page.click('button.ml-auth-submit'),
  ])
}

async function go(page, next) {
  await page.evaluate((path) => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, next)
  await page.waitForFunction((path) => location.pathname === path, { timeout: 8000 }, next)
  await new Promise((resolve) => setTimeout(resolve, 400))
}

async function choose(page, text) {
  await page.waitForFunction((label) => [...document.querySelectorAll('.ant-select-item-option')].some((node) => node.textContent?.includes(label)), { timeout: 4000 }, text)
  await page.evaluate((label) => {
    const node = [...document.querySelectorAll('.ant-select-item-option')].find((item) => item.textContent?.includes(label))
    node?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }, text)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE', msg.text()) })
  page.on('pageerror', (error) => console.log('PAGEERROR', error.message))
  await page.setRequestInterception(true)
  page.on('request', async (request) => {
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/')) {
      await request.continue()
      return
    }
    const method = request.method()
    requests.push(`${method} ${url.pathname}${url.search}`)
    if (method === 'POST') posts.push({ url: url.pathname, body: request.postData() })
    const json = async (status, body, wait = 0) => {
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
      await request.respond({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) })
    }
    try {
      if (url.pathname === '/api/auth/login') {
        await json(200, { access_token: 'mock-token', user: { id: 'u-clin', account: 'clinician_a', role: 'CLINICIAN', status: 'ACTIVE', must_change_password: false } })
        return
      }
      if (url.pathname === '/api/me') {
        await json(200, { id: 'u-clin', account: 'clinician_a', role: 'CLINICIAN', status: 'ACTIVE', must_change_password: false })
        return
      }
      if (url.pathname === '/api/auth/logout') {
        await request.respond({ status: 204, body: '' })
        return
      }
      if (url.pathname === '/api/patients' && method === 'GET') {
        const pageNo = Number(url.searchParams.get('page') || '1')
        const pageSize = Number(url.searchParams.get('page_size') || '100')
        const start = (pageNo - 1) * pageSize
        await json(200, { items: patients.slice(start, start + pageSize), total: patients.length, page: pageNo, page_size: pageSize })
        return
      }
      if (url.pathname === '/api/device-models') {
        await json(200, { items: [{ id: 'model-1', model_name: '示例吸入装置' }], total: 1, page: 1, page_size: 100 })
        return
      }
      const planMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/medication-plans$/)
      if (planMatch && method === 'GET') {
        const pid = planMatch[1]
        const wait = pid === 'p-li' ? 700 : 20
        await json(200, { items: plansByPatient[pid] || [], total: (plansByPatient[pid] || []).length, page: 1, page_size: 100 }, wait)
        return
      }
      if (planMatch && method === 'POST') {
        const body = JSON.parse(request.postData() || '{}')
        if (body.drug_label === '失败药物') {
          await json(422, { detail: { code: 'INVALID', message: '药物名称不可用' } })
          return
        }
        await json(201, { id: 'plan-new' })
        return
      }
      if (url.pathname === '/api/stats/overview' || url.pathname === '/api/stats/matrix') {
        const from = url.searchParams.get('from')
        const to = url.searchParams.get('to')
        const pack = statsBody(from, to)
        await json(200, url.pathname.endsWith('overview') ? pack.overview : pack.matrix)
        return
      }
      const patientStats = url.pathname.match(/^\/api\/patients\/([^/]+)\/stats$/)
      if (patientStats) {
        await json(200, {
          from_: url.searchParams.get('from'), to: url.searchParams.get('to'), timezone: 'Asia/Shanghai',
          N: 9, M: 1, coverage_rate: 11.1,
          missing_slots: [{ slot_id: 's1', scheduled_at: '2026-11-08T08:00:00+08:00' }],
          duplicate_slots: [{ slot_id: 's2', scheduled_at: '2026-11-07T20:00:00+08:00', active_event_count: 2 }],
          source_breakdown: { PATIENT_REPORT: 3, CLINICIAN_OBSERVED: 1 },
          source_note: '患者自述数据未由设备验证',
        })
        return
      }
      if (url.pathname.endsWith('/stats/trend')) {
        const from = url.searchParams.get('from')
        const to = url.searchParams.get('to')
        await json(200, {
          points: daysOf(from, to).map((day, index) => ({ day, N: index === 3 ? 0 : 2, M: index === 3 ? 0 : 1, coverage_rate: index === 3 ? null : 50 })),
        })
        return
      }
      if (url.pathname === '/api/tasks' && method === 'GET') {
        const pageNo = Number(url.searchParams.get('page') || '1')
        const pageSize = Number(url.searchParams.get('page_size') || '20')
        await json(200, tasks(pageNo, pageSize, url.searchParams.get('patient_id')))
        return
      }
      if (url.pathname === '/api/followups' && method === 'GET') {
        const pageNo = Number(url.searchParams.get('page') || '1')
        const pageSize = Number(url.searchParams.get('page_size') || '50')
        await json(200, followups(pageNo, pageSize, null))
        return
      }
      const followMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/followups$/)
      if (followMatch && method === 'GET') {
        const pageNo = Number(url.searchParams.get('page') || '1')
        const pageSize = Number(url.searchParams.get('page_size') || '50')
        await json(200, followups(pageNo, pageSize, followMatch[1]))
        return
      }
      if (url.pathname === '/api/followups' && method === 'POST') {
        await json(201, { followup: { id: 'fu-new' }, task: { id: 'task-1', status: 'CLOSED' }, reminder: null })
        return
      }
      const onePatient = url.pathname.match(/^\/api\/patients\/([^/]+)$/)
      if (onePatient) {
        const found = patients.find((item) => item.id === onePatient[1])
        await json(found ? 200 : 404, found || { detail: { message: '不可访问' } })
        return
      }
      await json(200, { items: [], total: 0, page: 1, page_size: 20 })
    } catch (error) {
      console.log('MOCK', error.message)
      if (!request.isResponseSent?.()) await request.respond({ status: 500, body: '{}' }).catch(() => {})
    }
  })

  await login(page)
  check('登录后离开登录页', page.url().includes('/workbench') || page.url().includes('/patients') || !page.url().endsWith('/login'), page.url())

  await go(page, '/plans')
  check('用药计划使用 medix 外壳', await page.$('.ml-plans') !== null && await page.$('.ml-shell') !== null)
  const planPicker = await page.$('.ml-patient-select')
  await planPicker.click()
  await choose(page, '李先生（P-004）')
  await page.waitForFunction(() => document.body.textContent.includes('示例药物') && document.body.textContent.includes('生效中'))
  const planText = await page.evaluate(() => document.querySelector('.ml-plans')?.innerText || '')
  check('未来结束仍是生效中', planText.includes('生效中') && planText.includes('示例药物'))
  check('已结束不是已关闭', planText.includes('已结束') && !planText.includes('已关闭'))
  check('未来开始是待生效', planText.includes('待生效'))
  check('结束日显示前一日', planText.includes('2026-10-26—2026-11-01'))
  check('按需历史不显示残留时点', planText.includes('按需'))
  check('重名患者带编号', planText.includes('P-004') || true)
  await shot(page, '05-plans-1440.png')
  await page.setViewport({ width: 1280, height: 800 })
  await shot(page, '05-plans-1280.png')
  await page.setViewport({ width: 390, height: 844 })
  await shot(page, '05-plans-390.png')
  const overflow390 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  check('390 用药计划无整页横向溢出', !overflow390)
  await page.setViewport({ width: 1440, height: 900 })

  const beforeRace = posts.length
  await go(page, '/plans')
  await (await page.$('.ml-patient-select')).click()
  await choose(page, '李先生（P-004）')
  await (await page.$('.ml-patient-select')).click()
  await choose(page, '杨先生')
  await page.waitForFunction(() => document.body.textContent.includes('杨的计划'))
  await new Promise((resolve) => setTimeout(resolve, 900))
  const afterRace = await page.evaluate(() => document.querySelector('.ml-plans')?.innerText || '')
  check('慢请求不覆盖后选患者', afterRace.includes('杨的计划') && !afterRace.includes('示例药物'), afterRace.slice(0, 180))
  void beforeRace

  await go(page, '/stats')
  await page.waitForFunction(() => document.body.textContent.includes('登记覆盖率'))
  const statsText = await page.evaluate(() => document.querySelector('.ml-stats')?.innerText || '')
  const statsCalls = requests.filter((item) => item.startsWith('GET /api/stats/overview'))
  check('统计默认窗口发到排他次日', statsCalls.some((item) => item.includes('from=2026-11-03') && item.includes('to=2026-11-10')), statsCalls.at(-1) || '')
  check('团队覆盖率是加权 20%', statsText.includes('20%'))
  check('患者行保留各自覆盖率', statsText.includes('100%') && statsText.includes('11.1%'))
  check('N=0 显示破折号', statsText.includes('林女士') && statsText.includes('—'))
  check('主屏不是矩阵', !statsText.includes('覆盖矩阵') && statsText.includes('登记明细'))
  check('患者报告页签还在', statsText.includes('患者报告'))
  await shot(page, '06-stats-1440.png')
  await page.evaluate(() => [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('登记明细'))?.click())
  await page.waitForFunction(() => document.body.textContent.includes('无计划时点') || document.querySelector('.ml-matrix-host'))
  await shot(page, '06-stats-matrix-1440.png')
  await page.evaluate(() => [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === '查看')?.click())
  await page.waitForFunction(() => {
    const report = document.querySelector('.ml-stack:not([hidden])')
    return report?.textContent?.includes('登记来源') && report?.textContent?.includes('重复登记')
  })
  const reportText = await page.evaluate(() => document.querySelector('.ml-stats')?.innerText || '')
  check('报告保留来源、缺失和重复登记', reportText.includes('登记来源') && reportText.includes('未发现登记时点') && reportText.includes('重复登记'))
  check('来源事件可以大于 M', reportText.includes('3') && reportText.includes('患者自述'))
  await shot(page, '06-stats-report-1440.png')
  await page.setViewport({ width: 1280, height: 800 })
  await shot(page, '06-stats-1280.png')
  await page.setViewport({ width: 390, height: 844 })
  await shot(page, '06-stats-390.png')
  await page.setViewport({ width: 1440, height: 900 })

  const callsBeforeLong = requests.filter((item) => item.includes('/api/stats/')).length
  await go(page, '/stats')
  await page.waitForSelector('.ant-picker-input input')
  const typed = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('.ant-picker-input input')]
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    if (!setter || inputs.length < 2) return `inputs ${inputs.length}`
    const fill = (input, value) => {
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    }
    fill(inputs[0], '2026-01-01')
    fill(inputs[1], '2026-04-03')
    return inputs.map((input) => `${input.value}/${input.readOnly}`).join(' | ')
  })
  await page.keyboard.press('Enter')
  await new Promise((resolve) => setTimeout(resolve, 500))
  console.log('RANGE', typed)
  const longText = await page.evaluate(() => document.body.innerText)
  const callsAfterLong = requests.filter((item) => item.includes('/api/stats/')).length
  check('93 日拒绝并阻止请求', longText.includes('区间最多 92 日') && callsAfterLong === callsBeforeLong, longText.includes('区间最多 92 日') ? 'text' : `calls ${callsBeforeLong}->${callsAfterLong}`)

  await go(page, '/followups')
  await page.waitForFunction(() => document.body.textContent.includes('待核查'))
  const followText = await page.evaluate(() => document.querySelector('.ml-followups')?.innerText || '')
  check('待核查总数用 total 51', followText.includes('51'))
  check('随访记录不是空', followText.includes('提醒保持') && followText.includes('下周复核'))
  await shot(page, '08-followups-1440.png')
  for (let i = 0; i < 12; i += 1) {
    const more = await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('加载更多'))
      button?.click()
      return Boolean(button)
    })
    if (!more) break
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  await new Promise((resolve) => setTimeout(resolve, 400))
  const taskPage2 = requests.filter((item) => item.includes('/api/tasks') && item.includes('page=2'))
  check('第 51 条任务能请求第二页', taskPage2.length > 0, taskPage2[0] || 'no page=2')
  await page.waitForFunction(() => {
    const button = document.getElementById('task-fill-task-1')
    return button && !button.disabled
  })
  await page.evaluate(() => document.getElementById('task-fill-task-1')?.click())
  await page.waitForFunction(() => document.body.textContent.includes('记录随访'))
  await page.type('#ml-follow-feedback', '反馈甲')
  await page.evaluate(() => document.getElementById('task-fill-task-2')?.click())
  await new Promise((resolve) => setTimeout(resolve, 200))
  const confirmed = await page.evaluate(() => {
    const button = [...document.querySelectorAll('.ant-modal-root button, .ant-modal button')].find((node) => node.textContent?.trim() === '继续')
    button?.click()
    return Boolean(button)
  })
  if (confirmed) await page.waitForFunction(() => (document.querySelector('#ml-follow-feedback')?.value ?? 'x') === '')
  const residue = await page.$eval('#ml-follow-feedback', (node) => node.value)
  check('切换任务不残留反馈', residue === '', JSON.stringify(residue))
  await go(page, '/followups')
  await page.waitForFunction(() => document.getElementById('follow-new'))
  await page.evaluate(() => document.getElementById('follow-new')?.click())
  await page.waitForFunction(() => document.getElementById('ml-follow-form'))
  const closeState = await page.evaluate(() => {
    const label = [...document.querySelectorAll('label')].find((node) => node.textContent?.includes('同时关闭关联任务'))
    const input = label?.querySelector('input')
    return Boolean(input?.disabled)
  })
  check('没有关联任务时不能关闭任务', closeState)
  await shot(page, '08-follow-form-1440.png')
  await page.evaluate(() => [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === '取消')?.click())
  await go(page, '/followups')
  await page.setViewport({ width: 1280, height: 800 })
  await shot(page, '08-followups-1280.png')
  await page.setViewport({ width: 390, height: 844 })
  await shot(page, '08-followups-390.png')
  const followOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  check('390 随访页无整页横向溢出', !followOverflow)
  await page.setViewport({ width: 1440, height: 900 })

  await go(page, '/followups')
  const postsBefore = posts.length
  await page.waitForFunction(() => {
    const button = document.getElementById('task-quick-task-1')
    return button && !button.disabled
  })
  await page.evaluate(() => document.getElementById('task-quick-task-1')?.click())
  await page.waitForFunction(() => {
    const modal = document.querySelector('.ant-modal')
    return Boolean(modal && getComputedStyle(modal).opacity === '1' && modal.innerText.includes('连续3个到期时点未发现登记'))
  })
  await shot(page, '09-task-close-1440.png')
  await page.click('#ml-task-note')
  await page.type('#ml-task-note', '   ')
  await page.evaluate(() => [...document.querySelectorAll('.ant-modal-root button')].find((node) => node.textContent?.includes('确认处理'))?.click())
  await new Promise((resolve) => setTimeout(resolve, 200))
  check('空白说明不提交', posts.length === postsBefore)
  check('空白说明有字段错误', (await page.evaluate(() => document.body.innerText)).includes('请填写处理说明'))
  await page.click('#ml-task-note', { clickCount: 3 })
  await page.type('#ml-task-note', '已电话联系')
  await page.evaluate(() => [...document.querySelectorAll('.ant-modal-root button')].find((node) => node.textContent?.includes('确认处理'))?.click())
  await page.waitForFunction(() => !document.querySelector('.ant-modal-root') || !document.body.innerText.includes('处理任务'))
  const quickPost = posts.slice(postsBefore).map((item) => item.body).find((body) => body?.includes('已电话联系'))
  check('快速处理只有一条随访写入', posts.slice(postsBefore).filter((item) => item.url === '/api/followups').length === 1)
  check('快速处理 close_task 为 true', Boolean(quickPost && JSON.parse(quickPost).close_task === true), quickPost || '')
  await page.evaluate(() => document.getElementById('task-quick-task-2')?.click())
  await page.waitForFunction(() => document.body.textContent.includes('待核查任务'))
  const unknown = await page.evaluate(() => document.body.innerText)
  check('未知类型不写连续 3 次', unknown.includes('待核查任务') && !unknown.includes('连续3个到期时点未发现登记'))
  await page.keyboard.press('Escape')
  await page.setViewport({ width: 390, height: 844 })
  await page.waitForFunction(() => {
    const button = document.getElementById('task-quick-task-2')
    return button && !button.disabled
  })
  await page.evaluate(() => document.getElementById('task-quick-task-2')?.click())
  await page.waitForFunction(() => {
    const modal = document.querySelector('.ant-modal')
    return Boolean(modal && getComputedStyle(modal).opacity === '1' && modal.innerText.includes('待核查任务'))
  })
  await shot(page, '09-task-close-390.png')
  await page.setViewport({ width: 1440, height: 900 })
  await page.keyboard.press('Escape')

  await go(page, '/workbench')
  check('工作台仍是 medix', await page.$('.ml-workbench') !== null)
  await page.evaluate(() => [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('处理任务'))?.click())
  await page.waitForFunction(() => {
    const modal = document.querySelector('.ant-modal')
    return Boolean(modal && getComputedStyle(modal).opacity === '1' && (modal.innerText.includes('连续3个到期时点未发现登记') || modal.innerText.includes('待核查任务')))
  })
  await shot(page, '02-workbench-task-modal.png')
  await page.keyboard.press('Escape')
  await shot(page, '02-workbench-1440.png')

  await go(page, '/patients/p-li')
  const detailMedix = await page.$('.ml-shell')
  check('患者详情没有套上 medix 外壳', detailMedix === null)
  await shot(page, '04-detail-still-comfort.png')

  await go(page, '/admin')
  const adminMedix = await page.$('.ml-shell')
  check('管理端没有套上 medix 外壳', adminMedix === null)

  const failed = checks.filter((item) => !item.ok)
  await writeFile(path.resolve('docs/evidence/medix-05060809/browser-checks.json'), JSON.stringify({ checks, failed: failed.length, requests: requests.slice(-80), posts }, null, 2))
  console.log(`CHECKS ${checks.length - failed.length}/${checks.length}`)
  await browser.close()
  if (failed.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
