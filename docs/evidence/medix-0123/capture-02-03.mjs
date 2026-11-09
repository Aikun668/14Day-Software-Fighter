// 浏览器验收。数据全部来自请求拦截，不是 8010 后端。
import puppeteer from '/tmp/medix-browser/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = 'http://127.0.0.1:5180'
const OUT = path.resolve('docs/evidence/medix-0123/screenshots')
const MODEL_A = '11111111-1111-4111-8111-111111111111'
const GUIDE_A = '22222222-2222-4222-8222-222222222222'
const MODEL_B = '33333333-3333-4333-8333-333333333333'

const state = {
  scenario: 'main',
  followupFail: false,
  backfillFail: false,
  closed: new Set(),
  created: [],
  posts: [],
  patientGets: [],
}

const roster = [
  ['p-li', 'P-004', '李先生', '慢性阻塞性肺疾病', null],
  ['p-zhou', 'P-006', '周先生', '慢性阻塞性肺疾病', null],
  ['p-chen', 'P-002', '陈先生', '慢性阻塞性肺疾病', 'u-chen'],
  ['p-wu', 'P-007', '吴女士', '支气管哮喘', null],
  ['p-sun', 'P-009', '孙女士', '支气管哮喘', null],
  ['p-lin', 'P-001', '林女士', '支气管哮喘', 'u-lin'],
  ['p-zhao', 'P-005', '赵女士', '支气管哮喘', null],
  ['p-zheng', 'P-008', '郑先生', '慢性阻塞性肺疾病', null],
  ['p-wang', 'P-003', '王女士', '支气管哮喘', null],
  ['p-yang', 'P-014', '杨先生', '慢性阻塞性肺疾病', null],
  ['p-long', 'P-021', '欧阳明月长名字用于换行测试', null, null],
  ['p-dup', 'P-022', '李先生', '支气管哮喘 (DEMO)', 'u-dup'],
].map(([id, patient_code, display_name, diagnosis_label, account_user_id]) => ({
  id, patient_code, display_name, diagnosis_label, account_user_id, assigned_clinician_id: 'u-clin',
}))

function patient(row) {
  return { ...row }
}

function pagingRoster() {
  const rows = state.created.map(patient)
  for (let i = 1; i <= 21; i += 1) {
    rows.push({
      id: `p-page-${i}`,
      patient_code: `N-${String(i).padStart(3, '0')}`,
      display_name: i === 21 ? '第二页患者' : `分页患者${i}`,
      diagnosis_label: i % 2 ? '慢性阻塞性肺疾病' : '支气管哮喘',
      account_user_id: i % 3 === 0 ? `u-${i}` : null,
      assigned_clinician_id: 'u-clin',
    })
  }
  return rows
}

function listPatients(url) {
  const parsed = new URL(url)
  const page = Number(parsed.searchParams.get('page') || '1')
  const pageSize = Number(parsed.searchParams.get('page_size') || '100')
  const search = (parsed.searchParams.get('search') || '').trim()
  const diags = parsed.searchParams.getAll('diagnosis_label')
  const account = parsed.searchParams.get('account_status')
  if (account === '') return { status: 422, body: { detail: { code: 'VALIDATION', message: '账号状态不能为空' } } }
  let source = state.scenario === 'paging' ? pagingRoster() : roster.map(patient)
  if (search === 'slow') {
    source = [{ id: 'slow', patient_code: 'S-1', display_name: '慢结果', diagnosis_label: null, account_user_id: null, assigned_clinician_id: 'u-clin' }]
  } else if (search === 'fast') {
    source = [{ id: 'fast', patient_code: 'F-1', display_name: '快结果', diagnosis_label: '支气管哮喘', account_user_id: null, assigned_clinician_id: 'u-clin' }]
  } else if (search) {
    const q = search.toLowerCase()
    source = source.filter((item) => item.display_name.toLowerCase().includes(q) || item.patient_code.toLowerCase().includes(q))
  }
  if (diags.length) source = source.filter((item) => diags.includes(item.diagnosis_label))
  if (account === 'bound') source = source.filter((item) => item.account_user_id)
  if (account === 'unbound') source = source.filter((item) => !item.account_user_id)
  const total = source.length
  const start = Math.max(0, (page - 1) * pageSize)
  return { status: 200, body: { items: source.slice(start, start + pageSize), total, page, page_size: pageSize } }
}

function enumerateDays(from, to) {
  const days = []
  const cursor = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  while (cursor < end) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    days.push(`${y}-${m}-${d}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function matrixFor(url) {
  const parsed = new URL(url)
  const days = enumerateDays(parsed.searchParams.get('from'), parsed.searchParams.get('to'))
  if (state.scenario === 'stats-fail') {
    return { status: 200, body: { days, rows: { broken: true } } }
  }
  const pattern = state.scenario === 'stats-none'
    ? days.map(() => ({ N: 0, M: 0 }))
    : [{ N: 2, M: 2 }, { N: 2, M: 1 }, { N: 2, M: 0 }, { N: 0, M: 0 }, { N: 2, M: 2 }, { N: 2, M: 1 }, { N: 2, M: 0 }]
  const cells = days.map((day, index) => {
    const count = pattern[index % pattern.length]
    return { day, N: count.N, M: count.M, missing: count.N - count.M, coverage_rate: count.N > 0 ? Math.round((count.M / count.N) * 1000) / 10 : null }
  })
  return {
    status: 200,
    body: {
      from_: parsed.searchParams.get('from'),
      to: parsed.searchParams.get('to'),
      timezone: 'Asia/Shanghai',
      days,
      total_N: cells.reduce((sum, cell) => sum + cell.N, 0),
      total_M: cells.reduce((sum, cell) => sum + cell.M, 0),
      coverage_rate: null,
      rows: [{ patient_id: 'p-li', patient_code: 'P-004', display_name: '李先生', N: 0, M: 0, coverage_rate: null, cells }],
    },
  }
}

function overviewBody() {
  if (state.scenario === 'stats-fail') return { status: 500, body: { detail: { message: '统计服务失败' } } }
  const rows = state.scenario === 'stats-none'
    ? [{ patient_id: 'p-lin', patient_code: 'P-001', display_name: '林女士', N: 0, M: 0, coverage_rate: null, missing_count: 0 }]
    : [
        { patient_id: 'p-li', patient_code: 'P-004', display_name: '李先生', N: 8, M: 0, coverage_rate: 0, missing_count: 8 },
        { patient_id: 'p-yang', patient_code: 'P-014', display_name: '杨先生', N: 4, M: 2, coverage_rate: 50, missing_count: 2 },
        { patient_id: 'p-wang', patient_code: 'P-003', display_name: '王女士', N: 4, M: 3, coverage_rate: 75, missing_count: 1 },
        { patient_id: 'p-lin', patient_code: 'P-001', display_name: '林女士', N: 4, M: 4, coverage_rate: 100, missing_count: 0 },
      ]
  return {
    status: 200,
    body: { from_: '', to: '', timezone: 'Asia/Shanghai', patient_count: rows.length, planned_count: 1, total_N: 8, total_M: 0, coverage_rate: 0, rows },
  }
}

function taskItems() {
  if (state.scenario === 'tasks-empty' || state.scenario === 'stats-none') return []
  const count = state.scenario === 'tasks-overflow' ? 20 : 8
  const ids = ['p-yang', 'p-yang', 'p-wang', 'p-li', 'p-zhao', 'p-zheng', 'p-wu', 'p-sun']
  const items = []
  for (let i = 0; i < count; i += 1) {
    const id = `t-${i + 1}`
    if (state.closed.has(id)) continue
    items.push({
      id,
      patient_id: ids[i % ids.length],
      task_type: 'CHECK',
      status: 'OPEN',
      assigned_to: null,
      due_at: null,
      closed_at: null,
      created_at: '2026-11-09T01:00:00Z',
    })
  }
  return items
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const checks = []
function check(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}${detail ? ` ${detail}` : ''}`)
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) })
}

async function login(page, account) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
  await page.click('input[placeholder="请输入账号"]', { clickCount: 3 })
  await page.type('input[placeholder="请输入账号"]', account)
  await page.type('input[placeholder="请输入密码"]', 'secret')
  await Promise.all([
    page.waitForFunction(() => location.pathname !== '/login', { timeout: 8000 }),
    page.click('button.ml-auth-submit'),
  ])
}

async function clickText(page, text) {
  const clicked = await page.evaluate((label) => {
    const modalButtons = [...document.querySelectorAll('.ant-modal-root button')]
    const rest = [...document.querySelectorAll('button, .ant-menu-item')]
    const node = [...modalButtons, ...rest].find((item) => item.textContent?.includes(label))
    if (!node) return false
    node.click()
    return true
  }, text)
  if (!clicked) throw new Error(`missing ${text}`)
}

async function chooseOption(page, text) {
  await page.waitForFunction((label) => {
    return [...document.querySelectorAll('.ant-select-item-option')].some((node) => node.textContent?.includes(label))
  }, {}, text)
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
  const version = await browser.version()
  await page.setViewport({ width: 1440, height: 900 })
  page.on('framenavigated', (frame) => console.log('NAV', frame.url()))
  page.on('response', (res) => {
    if (res.url().includes('/api/')) console.log('RES', res.status(), res.url().replace(BASE, ''))
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE', msg.text())
  })
  await page.setRequestInterception(true)
  page.on('request', async (request) => {
    const url = request.url()
    const parsed = new URL(url)
    const pathname = parsed.pathname
    if (!pathname.startsWith('/api/')) {
      await request.continue()
      return
    }
    const method = request.method()
    if (method === 'POST') state.posts.push({ url: pathname, body: request.postData() })
    if (method === 'GET' && pathname === '/api/patients') state.patientGets.push(`${pathname}?${parsed.searchParams.toString()}`)
    const json = async (status, body, wait = 0) => {
      if (wait) await delay(wait)
      await request.respond({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(body),
      })
    }
    try {
      if (pathname === '/api/auth/login' && method === 'POST') {
        const creds = JSON.parse(request.postData() || '{}')
        const role = creds.account === 'admin_a' ? 'ADMIN' : 'CLINICIAN'
        await json(200, {
          access_token: 'mock-token',
          user: { id: role === 'ADMIN' ? 'u-admin' : 'u-clin', account: creds.account, role, status: 'ACTIVE', must_change_password: false },
        })
        return
      }
      if (pathname === '/api/me') {
        await json(200, { id: 'u-clin', account: 'clinician_a', role: 'CLINICIAN', status: 'ACTIVE', must_change_password: false })
        return
      }
      if (pathname === '/api/auth/logout') {
        await request.respond({ status: 204, body: '' })
        return
      }
      if (pathname === '/api/tasks' && method === 'GET') {
        if (state.scenario === 'tasks-fail') {
          await json(500, { detail: { message: '任务列表失败' } })
          return
        }
        const items = taskItems()
        const total = state.scenario === 'tasks-overflow' ? 25 : items.length
        await json(200, { items, total, page: 1, page_size: 20 })
        return
      }
      if (pathname === '/api/patients' && method === 'GET') {
        if (state.scenario === 'list-fail') {
          await json(500, { detail: { message: '患者列表失败' } })
          return
        }
        const search = parsed.searchParams.get('search')
        const wait = search === 'slow' ? 700 : search === 'fast' ? 40 : 0
        const result = listPatients(url)
        await json(result.status, result.body, wait)
        return
      }
      if (pathname === '/api/patients/filter-options') {
        await json(200, { diagnosis_labels: ['慢性阻塞性肺疾病', '支气管哮喘'] })
        return
      }
      if (pathname === '/api/patients' && method === 'POST') {
        const body = JSON.parse(request.postData() || '{}')
        if (!body.patient_code || !body.display_name) {
          await json(422, { detail: { message: '编号和姓名必填' } })
          return
        }
        const created = { id: 'p-new', account_user_id: null, assigned_clinician_id: 'u-clin', diagnosis_label: body.diagnosis_label || null, ...body }
        state.created.unshift(created)
        await json(200, created)
        return
      }
      if (pathname === '/api/stats/overview') {
        const result = overviewBody()
        await json(result.status, result.body)
        return
      }
      if (pathname === '/api/stats/matrix') {
        const result = matrixFor(url)
        await json(result.status, result.body)
        return
      }
      if (pathname === '/api/device-models' && method === 'GET') {
        await json(200, { items: [{ id: MODEL_A, model_name: '型号甲' }, { id: MODEL_B, model_name: '型号乙' }], total: 2 })
        return
      }
      if (pathname.endsWith('/guide') && method === 'GET') {
        if (pathname.includes(MODEL_B)) {
          await json(404, { detail: { message: '没有已发布指导' } })
          return
        }
        await json(200, {
          id: GUIDE_A,
          title: '指导 v1',
          device_model_id: MODEL_A,
          steps: [{ id: 'step-1', step_no: 1, text: '摇匀' }],
        })
        return
      }
      if (pathname === '/api/training-sessions' && method === 'POST') {
        await json(200, { id: 'session-1' })
        return
      }
      if (pathname === '/api/followups' && method === 'POST') {
        if (state.followupFail) {
          await json(422, { detail: { message: '处理没有写入' } })
          return
        }
        const body = JSON.parse(request.postData() || '{}')
        if (body.task_id) state.closed.add(body.task_id)
        await json(200, { id: 'f-1' })
        return
      }
      if (pathname.includes('/medication-plans')) {
        await json(200, {
          items: [
            { id: 'plan-regular', plan_type: 'REGULAR', drug_label: '布地奈德', version: 1 },
            { id: 'plan-prn', plan_type: 'PRN', drug_label: '沙丁胺醇', version: 2 },
          ],
        })
        return
      }
      if (pathname.includes('/daily-slots')) {
        await json(200, {
          items: [
            { id: 'slot-1', plan_id: 'plan-regular', patient_id: 'p-yang', scheduled_at: '2026-11-07T00:00:00.000Z', state: 'DUE', has_active_record: false },
            { id: 'slot-2', plan_id: 'plan-regular', patient_id: 'p-yang', scheduled_at: '2026-11-07T12:00:00.000Z', state: 'DUE', has_active_record: true },
          ],
        })
        return
      }
      if (pathname === '/api/medication-events' && method === 'POST') {
        if (state.backfillFail) {
          await json(422, { detail: { message: '补登没有写入' } })
          return
        }
        await json(200, { event: { id: 'event-1' }, is_duplicate: false })
        return
      }
      if (/^\/api\/patients\/[^/]+$/.test(pathname) && method === 'GET') {
        const id = pathname.split('/').pop()
        const found = roster.find((item) => item.id === id) || roster[0]
        await json(200, { ...found, note: null })
        return
      }
      if (pathname.includes('/medication-events') && method === 'GET') {
        await json(200, { items: [], total: 0 })
        return
      }
      if (pathname.includes('/stats')) {
        await json(200, { N: 0, M: 0, coverage_rate: null, duplicate_slots: [] })
        return
      }
      if (pathname.startsWith('/api/admin/')) {
        await json(200, { items: [], total: 0 })
        return
      }
      await json(200, { items: [], total: 0 })
    } catch (error) {
      console.error('intercept', method, pathname, error.message)
    }
  })

  try {
    await login(page, 'clinician_a')
    await page.waitForSelector('.ml-day-cell')
    const text = async () => page.evaluate(() => document.body.innerText)
    check('workbench route', page.url().includes('/workbench'))
    check('no iterable crash', !(await text()).includes('is not iterable') && !(await text()).includes('统计矩阵不可用'))
    const statuses = await page.$$eval('.ml-day-cell', (nodes) => nodes.map((node) => node.dataset.status))
    check('four states', ['full', 'partial', 'miss', 'none'].every((status) => statuses.includes(status)), statuses.join(','))
    const labels = await page.$$eval('.ml-day-cell', (nodes) => nodes.map((node) => node.getAttribute('aria-label')))
    check('cell label has counts', labels.every((label) => label.includes('已登记') && label.includes('应')))
    check('none is not miss', labels.some((label) => label.includes('无到期时点')) && labels.some((label) => label.includes('未发现登记')))
    const headers = await page.$$eval('#ml-task-queue th', (nodes) => nodes.map((node) => node.textContent.trim()))
    check('queue columns', headers.join(',') === '患者,操作', headers.join(','))
    const taskRows = await page.$$eval('#ml-task-queue tbody tr', (nodes) => nodes.map((node) => ({
      id: node.dataset.taskId,
      patientId: node.dataset.patientId,
    })))
    check('same patient two tasks', taskRows.filter((row) => row.patientId === 'p-yang').length === 2 && new Set(taskRows.map((row) => row.id)).size === taskRows.length, taskRows.map((row) => row.id).join(','))
    const queueText = await page.$eval('#ml-task-queue', (node) => node.innerText)
    check('no code in queue', !queueText.includes('P-014') && !queueText.includes('编号'), queueText.slice(0, 80))
    check('no hero status', !(await text()).includes('系统正常') && !(await text()).includes('近 7 日覆盖偏低') && !(await text()).includes('近7日覆盖偏低'))
    const attention = await page.$eval('.ml-attn-person', (node) => node.innerText.replace(/\s+/g, ' '))
    check('attention one line rate', attention.includes('李先生') && attention.includes('0%') && !attention.includes('缺'), attention)
    const quiet = await page.$eval('.ml-quiet', (node) => {
      const style = getComputedStyle(node)
      return { color: style.color, border: style.borderTopColor, bg: style.backgroundColor }
    })
    check('quiet button not purple', quiet.color !== 'rgb(129, 70, 255)' && quiet.bg === 'rgb(255, 255, 255)', JSON.stringify(quiet))
    const metrics = await page.evaluate(() => {
      const html = getComputedStyle(document.documentElement)
      const title = document.querySelector('h1')
      const row = document.querySelector('#ml-task-queue tbody tr')
      const avatar = document.querySelector('#ml-task-queue .ml-avatar')
      const sider = document.querySelector('.ml-sider')
      const content = document.querySelector('.ml-content')
      const split = [...document.querySelectorAll('.ml-split > *')].map((node) => node.getBoundingClientRect().width)
      return {
        htmlFontSize: html.fontSize,
        titleSize: title ? getComputedStyle(title).fontSize : null,
        titleWeight: title ? getComputedStyle(title).fontWeight : null,
        rowHeight: row ? row.getBoundingClientRect().height : null,
        avatar: avatar ? avatar.getBoundingClientRect().width : null,
        sider: sider ? sider.getBoundingClientRect().width : null,
        contentPad: content ? getComputedStyle(content).paddingLeft : null,
        split,
        scrollWidth: document.documentElement.scrollWidth,
      }
    })
    check('root 16px', metrics.htmlFontSize === '16px', metrics.htmlFontSize)
    check('title 20px', metrics.titleSize === '20px', metrics.titleSize)
    check('row about 56', Math.abs(metrics.rowHeight - 56) <= 4, String(metrics.rowHeight))
    check('avatar 36', Math.abs(metrics.avatar - 36) <= 4, String(metrics.avatar))
    check('sider 240', Math.abs(metrics.sider - 240) <= 4, String(metrics.sider))
    check('no page overflow 1440', metrics.scrollWidth <= 1440)
    await shot(page, '02-workbench-1440-mock.png')
    await page.screenshot({ path: path.join(OUT, '02-workbench-1440-full-mock.png'), fullPage: true })

    await page.setViewport({ width: 1280, height: 800 })
    await shot(page, '02-workbench-1280-mock.png')
    await page.setViewport({ width: 390, height: 844 })
    await page.waitForFunction(() => document.querySelector('.ml-shell-layout')?.classList.contains('is-narrow'))
    const narrow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      sider: document.querySelector('.ml-sider') ? getComputedStyle(document.querySelector('.ml-sider')).display : 'missing',
    }))
    check('390 no page overflow', narrow.scrollWidth <= 390, String(narrow.scrollWidth))
    check('390 sider hidden', narrow.sider === 'none', narrow.sider)
    check('390 no iterable', !(await text()).includes('is not iterable'))
    await shot(page, '02-workbench-390-mock.png')
    await page.setViewport({ width: 1440, height: 900 })

    state.scenario = 'stats-fail'
    await clickText(page, '刷新')
    await page.waitForFunction(() => document.body.innerText.includes('近 7 日统计不可用'))
    const failed = await text()
    check('partial failure copy', failed.includes('近 7 日统计不可用') && failed.includes('今日统计不可用'))
    check('failure is not zero percent', !failed.includes('0%') && !failed.includes('is not iterable'))
    check('tasks remain after stats failure', failed.includes('杨先生') && failed.includes('补登用药'))
    await shot(page, '02-workbench-stats-fail-mock.png')

    state.scenario = 'stats-none'
    await clickText(page, '刷新')
    await page.waitForFunction(() => document.body.innerText.includes('暂无待关注事项'))
    const noneLabels = await page.$$eval('.ml-day-cell', (nodes) => nodes.map((node) => node.getAttribute('aria-label')))
    check('all none days', noneLabels.length === 7 && noneLabels.every((label) => label.includes('无到期时点') && !label.includes('未发现登记')), String(noneLabels.length))
    check('empty attention', (await text()).includes('暂无待关注事项') && (await text()).includes('暂无待核查任务'))
    check('none is not zero percent', !(await text()).includes('0%'))
    await shot(page, '02-workbench-empty-mock.png')

    state.scenario = 'tasks-overflow'
    await clickText(page, '刷新')
    await page.waitForFunction(() => document.body.innerText.includes('全部任务'))
    const overflowTitle = await page.$eval('#ml-task-queue .ml-surface-title', (node) => node.textContent.replace(/\s+/g, ' '))
    const visibleBefore = await page.$$eval('#ml-task-queue tbody tr', (nodes) => nodes.length)
    check('overflow title uses total', overflowTitle.includes('25') && !overflowTitle.includes('20'), overflowTitle)
    check('collapsed to 6', visibleBefore === 6, String(visibleBefore))
    await clickText(page, '其余')
    const visibleAfter = await page.$$eval('#ml-task-queue tbody tr', (nodes) => nodes.length)
    check('expanded loaded rows', visibleAfter === 20, String(visibleAfter))
    await shot(page, '02-workbench-overflow-mock.png')

    state.scenario = 'main'
    state.closed.clear()
    await clickText(page, '刷新')
    await page.waitForFunction(() => document.querySelector('#ml-task-queue .ml-count')?.textContent?.includes('8'), { timeout: 8000 })
    const postsBeforeCancel = state.posts.length
    await clickText(page, '处理任务')
    await page.waitForSelector('.ml-modal-name')
    await delay(300)
    check('task modal root', (await page.$eval('.ant-modal-root', (node) => node.className)).includes('ml-shell'))
    await (await page.$('.ant-modal-container')).screenshot({ path: path.join(OUT, '02-task-close-modal-mock.png') })
    await clickText(page, '取消')
    await page.waitForFunction(() => !document.querySelector('.ant-modal-root'))
    check('cancel task writes nothing', state.posts.length === postsBeforeCancel)

    state.followupFail = true
    await clickText(page, '处理任务')
    await page.waitForSelector('#ml-task-note')
    await page.type('#ml-task-note', '已电话说明')
    await clickText(page, '确认处理')
    await page.waitForSelector('.ant-alert-error')
    check('failed close stays open', Boolean(await page.$('.ant-modal-root')) && (await text()).includes('处理没有写入'))
    await shot(page, '02-task-close-fail-mock.png')
    state.followupFail = false
    await clickText(page, '确认处理')
    await page.waitForFunction(() => !document.querySelector('.ant-modal-root'))
    const followPost = state.posts.filter((item) => item.url === '/api/followups').at(-1)
    check('followup posted', Boolean(followPost))
    await page.waitForFunction(() => !document.querySelector('[data-task-id="t-1"]'))
    check('success refresh drops closed task', !(await page.$('[data-task-id="t-1"]')))

    const beforeBackfill = state.posts.filter((item) => item.url === '/api/medication-events').length
    await clickText(page, '补登用药')
    await page.waitForSelector('.ml-slot')
    await delay(300)
    await (await page.$('.ant-modal-container')).screenshot({ path: path.join(OUT, '02-backfill-modal-mock.png') })
    await clickText(page, '取消')
    await page.waitForFunction(() => !document.querySelector('.ant-modal-root'))
    check('cancel backfill writes nothing', state.posts.filter((item) => item.url === '/api/medication-events').length === beforeBackfill)

    state.backfillFail = true
    await clickText(page, '补登用药')
    await page.waitForSelector('.ml-slot:not([disabled])')
    await page.click('.ml-slot:not([disabled])')
    await clickText(page, '确认补登')
    await page.waitForSelector('.ant-alert-error')
    check('failed backfill stays open', (await text()).includes('补登没有写入'))
    await shot(page, '02-backfill-fail-mock.png')
    state.backfillFail = false
    await clickText(page, '确认补登')
    await page.waitForFunction(() => !document.querySelector('.ant-modal-root'))
    check('backfill posted once', state.posts.filter((item) => item.url === '/api/medication-events' && !JSON.parse(item.body || '{}').noop).length >= 1)

    await clickText(page, '患者管理')
    await page.waitForSelector('.ml-patients')
    await page.waitForFunction(() => document.body.innerText.includes('共 12 位'))
    await page.evaluate(() => document.querySelectorAll('.ant-message').forEach((node) => node.remove()))
    const patientHeaders = await page.$$eval('.ml-patients th', (nodes) => nodes.map((node) => node.textContent.trim()))
    check('patient columns', patientHeaders.join(',') === '患者,诊断,账号状态,操作', patientHeaders.join(','))
    const patientText = await text()
    check('patients copy removed', !patientText.includes('系统正常') && !patientText.includes('筛出未绑定') && !patientText.includes('患者列表') && !patientText.includes('(DEMO)') && !patientText.includes('P-004'))
    check('bound tags', patientText.includes('已绑定') && patientText.includes('未绑定'))
    check('long name', patientText.includes('欧阳明月长名字用于换行测试'))
    const primary = await page.$eval('.ml-patients .ant-btn-primary', (node) => getComputedStyle(node).backgroundColor)
    check('create button brand', primary === 'rgb(129, 70, 255)', primary)
    const detailLabel = await page.$eval('[aria-label="查看李先生详情"]', (node) => node.getAttribute('aria-label'))
    check('row action label', detailLabel === '查看李先生详情')
    const actionColor = await page.$eval('.ml-row-action', (node) => getComputedStyle(node).color)
    check('row action not purple', actionColor !== 'rgb(129, 70, 255)', actionColor)
    await shot(page, '03-patients-1440-mock.png')
    await page.setViewport({ width: 1280, height: 800 })
    await shot(page, '03-patients-1280-mock.png')
    await page.setViewport({ width: 390, height: 844 })
    await page.waitForFunction(() => document.querySelector('.ml-shell-layout')?.classList.contains('is-narrow'))
    const patientsNarrow = await page.evaluate(() => document.documentElement.scrollWidth)
    check('patients 390 no overflow', patientsNarrow <= 390, String(patientsNarrow))
    await shot(page, '03-patients-390-mock.png')
    await page.setViewport({ width: 1440, height: 900 })

    const getsBeforeFilter = state.patientGets.length
    await page.click('.ml-filter-diagnosis')
    await chooseOption(page, '慢性阻塞性肺疾病')
    await chooseOption(page, '支气管哮喘')
    await page.keyboard.press('Escape')
    await page.click('.ml-filter-account')
    await chooseOption(page, '已绑定')
    await chooseOption(page, '未绑定')
    await page.keyboard.press('Escape')
    await page.waitForFunction((start) => {
      const foot = document.querySelector('.ml-table-foot')
      return foot && document.body.innerText.includes('共')
    }, {}, getsBeforeFilter)
    await delay(300)
    const filterUrl = state.patientGets.at(-1) || ''
    const filterParams = new URL(filterUrl, BASE).searchParams
    check('repeated diagnosis', filterParams.getAll('diagnosis_label').length === 2, filterUrl)
    check('both accounts omit status', !filterParams.has('account_status'), filterUrl)
    check('filter page 1', filterParams.get('page') === '1', filterUrl)
    await clickText(page, '清除筛选')
    await delay(200)
    const cleared = new URL(state.patientGets.at(-1), BASE).searchParams
    check('clear removes filters', !cleared.has('diagnosis_label') && !cleared.has('account_status') && cleared.get('page') === '1', state.patientGets.at(-1))

    await page.click('.ml-filter-search input', { clickCount: 3 })
    await page.type('.ml-filter-search input', '没有这个人')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.body.innerText.includes('没有匹配患者'))
    await shot(page, '03-patients-no-match-mock.png')
    await clickText(page, '清除筛选')
    await page.waitForFunction(() => document.body.innerText.includes('共 12 位'))

    await page.click('.ml-filter-search input')
    await page.type('.ml-filter-search input', 'slow')
    await page.keyboard.press('Enter')
    await page.click('.ml-filter-search input', { clickCount: 3 })
    await page.keyboard.press('Backspace')
    await page.type('.ml-filter-search input', 'fast')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.body.innerText.includes('快结果'), { timeout: 4000 })
    await delay(900)
    check('race keeps fast result', (await text()).includes('快结果') && !(await text()).includes('慢结果'))

    await clickText(page, '清除筛选')
    await page.waitForFunction(() => document.body.innerText.includes('杨先生'))
    await page.click('[aria-label="为杨先生做现场评估"]')
    await page.waitForSelector('.ant-modal-root .ant-select')
    const urlBeforeEvalClick = page.url()
    check('eval does not navigate', urlBeforeEvalClick.endsWith('/patients'))
    await (await page.$$('.ant-modal-root .ant-select'))[0].click()
    await chooseOption(page, '型号甲')
    await delay(200)
    await (await page.$$('.ant-modal-root .ant-select'))[1].click()
    await chooseOption(page, '指导 v1')
    await (await page.$$('.ant-modal-root .ant-select'))[0].click()
    await chooseOption(page, '型号乙')
    await page.waitForFunction(() => document.body.innerText.includes('该型号没有已发布指导'))
    const blocked = await page.$eval('.ant-modal-container .ant-btn-primary', (node) => node.disabled)
    check('no guide blocks submit', blocked)
    check('no training post yet', !state.posts.some((item) => item.url === '/api/training-sessions'))
    await (await page.$('.ant-modal-container')).screenshot({ path: path.join(OUT, '03-eval-no-guide-mock.png') })
    await (await page.$$('.ant-modal-root .ant-select'))[0].click()
    await chooseOption(page, '型号甲')
    await page.waitForFunction(() => !document.body.innerText.includes('该型号没有已发布指导'))
    await (await page.$$('.ant-modal-root .ant-select'))[1].click()
    await chooseOption(page, '指导 v1')
    await (await page.$('.ant-modal-container')).screenshot({ path: path.join(OUT, '03-eval-modal-mock.png') })
    await clickText(page, '确定')
    await page.waitForFunction(() => !document.querySelector('.ant-modal-root'))
    const training = state.posts.filter((item) => item.url === '/api/training-sessions').at(-1)
    const trainingBody = JSON.parse(training.body)
    check('device model is not guide', trainingBody.device_model_id === MODEL_A && trainingBody.guide_id === GUIDE_A && trainingBody.device_model_id !== trainingBody.guide_id, training.body)
    check('training patient id', trainingBody.patient_id === 'p-yang', trainingBody.patient_id)

    state.scenario = 'paging'
    await page.click('.ml-filter-search input')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.body.innerText.includes('共 21 位'))
    await clickText(page, '下一页')
    await page.waitForFunction(() => document.querySelector('.ml-table-foot')?.dataset.page === '2')
    check('page 2', (await page.$eval('.ml-table-foot', (node) => node.dataset.page)) === '2')
    await clickText(page, '新建患者')
    await page.waitForSelector('[aria-label="患者编号"]')
    await (await page.$('.ant-modal-container')).screenshot({ path: path.join(OUT, '03-create-modal-mock.png') })
    await page.type('[aria-label="患者编号"]', 'P-100')
    await page.type('[aria-label="姓名"]', '新建患者甲')
    await clickText(page, '确定')
    await page.waitForFunction(() => document.querySelector('.ml-table-foot')?.dataset.page === '1')
    const afterCreate = state.patientGets.at(-1)
    check('create returns page 1', afterCreate.includes('page=1') && (await page.$eval('.ml-table-foot', (node) => node.dataset.page)) === '1', afterCreate)
    check('create kept code', state.posts.some((item) => item.url === '/api/patients' && JSON.parse(item.body).patient_code === 'P-100'))
    await shot(page, '03-patients-after-create-mock.png')

    state.scenario = 'list-fail'
    await clickText(page, '下一页')
    await page.waitForFunction(() => document.body.innerText.includes('患者列表失败'))
    check('list failure visible', (await text()).includes('患者列表失败') && !(await text()).includes('暂无患者'))
    await shot(page, '03-patients-fail-mock.png')

    state.scenario = 'main'
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
    await login(page, 'clinician_a')
    await page.waitForSelector('.ml-workbench')
    await clickText(page, '患者管理')
    await page.waitForSelector('.ml-patients')
    await page.click('[aria-label="查看李先生详情"]')
    await page.waitForFunction(() => location.pathname === '/patients/p-li')
    await page.waitForSelector('.cc-shell')
    const scope = await page.evaluate(() => ({
      medix: Boolean(document.querySelector('.ml-frame')),
      comfort: Boolean(document.querySelector('.cc-shell')),
      button: getComputedStyle(document.querySelector('.cc-shell .ant-btn-primary, .ant-btn-primary')).backgroundColor,
    }))
    check('detail stays comfort', scope.comfort && !scope.medix, JSON.stringify(scope))
    await shot(page, '04-patient-detail-still-comfort-mock.png')

    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
    await login(page, 'admin_a')
    await page.waitForSelector('.cc-shell')
    const admin = await page.evaluate(() => ({
      medix: Boolean(document.querySelector('.ml-frame')),
      comfort: Boolean(document.querySelector('.cc-shell')),
      button: getComputedStyle(document.querySelector('.ant-btn-primary')).backgroundColor,
    }))
    check('admin stays comfort', admin.comfort && !admin.medix && admin.button === 'rgb(91, 124, 255)', JSON.stringify(admin))
    await shot(page, '05-admin-still-comfort-mock.png')

    const summary = {
      browser: version,
      capturedAt: new Date().toISOString(),
      data: 'request-intercept mock, backend 8010 not used',
      metrics,
      quiet,
      trainingBody,
      checks,
      failed: checks.filter((item) => !item.ok).length,
    }
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path.resolve('docs/evidence/medix-0123/browser-02-03.json'), JSON.stringify(summary, null, 2))
    console.log(`FAILED ${summary.failed} / ${checks.length}`)
    if (summary.failed) process.exitCode = 1
  } catch (error) {
    console.error(error)
    await shot(page, '99-capture-error-mock.png').catch(() => {})
    console.log(await page.evaluate(() => document.body.innerText).catch(() => ''))
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

await main()
