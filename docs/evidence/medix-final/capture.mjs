// 浏览器验收。接口由请求拦截提供，不是 8010。截图记为 mock。
import puppeteer from '/tmp/medix-shot/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = 'http://127.0.0.1:5181'
const OUT = path.resolve('docs/evidence/medix-final/screenshots')
const checks = []
const posts = []
let role = 'CLINICIAN'
let account = 'clinician_a'

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`)
}

function shanghaiToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  return parts
}

function addDays(day, amount) {
  const [year, month, date] = day.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, date + amount))
  const pad = (value) => String(value).padStart(2, '0')
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`
}

function daysOf(from, to) {
  const out = []
  let cursor = from
  while (cursor < to && out.length < 40) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}

const models = [
  { id: 'm1', category: 'pMDI', brand: '万托林', model_name: '吸入气雾剂 pMDI', manufacturer: '阿斯利康', status: 'ACTIVE' },
  { id: 'm2', category: 'DPI', brand: '信必可', model_name: '都保 DPI', manufacturer: '阿斯利康', status: 'ACTIVE' },
  { id: 'm3', category: 'SMI', brand: '思力华', model_name: '能倍乐 Respimat', manufacturer: '勃林格殷格翰', status: 'ACTIVE' },
]

const guides = [
  guide('g1', 'm1', '1.0', 'pMDI 操作指导', 'PUBLISHED'),
  guide('g2', 'm2', '1.0', 'DPI 操作指导', 'PUBLISHED'),
  guide('g3', 'm3', '1.0', 'SMI 操作指导', 'PUBLISHED'),
  guide('g4', 'm1', '1.1-demo', '万托林吸入气雾剂操作指导', 'DRAFT'),
]

function guide(id, modelId, version, title, status) {
  return {
    id, device_model_id: modelId, version, title, review_status: status,
    source_title: null, source_url: null,
    steps: [
      { id: `${id}-1`, step_no: 1, text: '打开盖子并检查吸嘴。', error_notes: null, image_path: null },
      { id: `${id}-2`, step_no: 2, text: '呼气后含住吸嘴，缓慢深吸。', error_notes: '吸得过快时提示放慢。', image_path: null },
    ],
  }
}

const users = [
  { id: 'u-admin', account: 'admin', role: 'ADMIN', status: 'ACTIVE', must_change_password: false },
  { id: 'u-clin', account: 'clinician_a', role: 'CLINICIAN', status: 'ACTIVE', must_change_password: true },
  { id: 'u-pat', account: 'patient_demo', role: 'PATIENT', status: 'DISABLED', must_change_password: false },
]

const knowledge = [
  {
    id: 'k1', device_model_id: 'm1', title: '吸入前准备', version: '1.0', review_status: 'PUBLISHED', source_url: 'https://example.com/guide',
    chunks: [
      { id: 'c1', chunk_no: 1, text: '使用前先核对装置和药物名称。' },
      { id: 'c2', chunk_no: 2, text: '呼气不要对着吸嘴。' },
    ],
  },
]

function auditEvents() {
  const end = addDays(shanghaiToday(), -1)
  const start = addDays(end, -6)
  const actions = ['GUIDE_REVIEW', 'GUIDE_PUBLISH', 'DEVICE_MODEL_CREATE', 'KNOWLEDGE_CREATE', 'GUIDE_CREATE']
  return daysOf(start, addDays(end, 1)).map((day, index) => ({
    id: `audit-${index}`,
    actor_id: 'u-admin',
    action: actions[index % actions.length],
    resource_type: 'device_guide',
    resource_id: `res-${index}`,
    detail: { version: '1.0', reason: index === 2 ? '原始内容' : 'ok' },
    created_at: `${day}T10:0${index}:00+08:00`,
  }))
}

function reportStats(from, to) {
  const days = daysOf(from, to)
  const pattern = [
    [2, 2], [2, 1], [2, 2], [2, 2], [2, 1], [2, 2], [2, 2],
  ]
  const points = days.map((day, index) => {
    const [N, M] = pattern[index] ?? [0, 0]
    return { day, N, M, coverage_rate: N > 0 ? Math.round((M / N) * 1000) / 10 : null }
  })
  const N = points.reduce((sum, point) => sum + point.N, 0)
  const M = points.reduce((sum, point) => sum + point.M, 0)
  const missing = []
  if (days[1]) missing.push({ slot_id: 'miss-1', scheduled_at: `${days[1]}T20:00:00+08:00` })
  if (days[4]) missing.push({ slot_id: 'miss-2', scheduled_at: `${days[4]}T08:00:00+08:00` })
  return {
    stats: {
      from_: from, to, timezone: 'Asia/Shanghai', N, M,
      coverage_rate: N > 0 ? Math.round((M / N) * 1000) / 10 : null,
      missing_slots: missing,
      duplicate_slots: days[2] ? [{ slot_id: 'dup-1', scheduled_at: `${days[2]}T08:00:00+08:00`, active_event_count: 2 }] : [],
      source_breakdown: { PATIENT_REPORT: 10, CLINICIAN_OBSERVED: 3 },
      source_note: '患者自述未由设备验证',
    },
    points,
  }
}

const patients = [
  { id: 'p-li', patient_code: 'P-004', display_name: '李先生', diagnosis_label: '慢性阻塞性肺疾病', account_user_id: 'u-pat', note: null },
  { id: 'p-li-2', patient_code: 'P-022', display_name: '李先生', diagnosis_label: '哮喘', account_user_id: null, note: null },
]

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  page.on('pageerror', (error) => console.log('PAGEERROR', error.message))
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE', msg.text()) })
  await page.setRequestInterception(true)
  page.on('request', async (request) => {
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/')) {
      await request.continue()
      return
    }
    const method = request.method()
    if (method !== 'GET') posts.push({ url: url.pathname, method, body: request.postData() })
    const json = async (status, body) => {
      await request.respond({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) })
    }
    try {
      if (url.pathname === '/api/auth/login') {
        const body = JSON.parse(request.postData() || '{}')
        account = body.account || 'clinician_a'
        role = account === 'admin' ? 'ADMIN' : 'CLINICIAN'
        const id = role === 'ADMIN' ? 'u-admin' : 'u-clin'
        await json(200, { access_token: 'mock-token', user: { id, account, role, status: 'ACTIVE', must_change_password: false } })
        return
      }
      if (url.pathname === '/api/me') {
        await json(200, { id: role === 'ADMIN' ? 'u-admin' : 'u-clin', account, role, status: 'ACTIVE', must_change_password: false })
        return
      }
      if (url.pathname === '/api/auth/logout') {
        await request.respond({ status: 204, body: '' })
        return
      }
      if (url.pathname === '/api/patients' && method === 'GET') {
        await json(200, { items: patients, total: patients.length, page: 1, page_size: 100 })
        return
      }
      const patient = url.pathname.match(/^\/api\/patients\/([^/]+)$/)
      if (patient && method === 'GET') {
        const found = patients.find((item) => item.id === patient[1])
        if (!found) { await json(404, { detail: { code: 'NOT_FOUND', message: '患者不存在' } }); return }
        await json(200, found)
        return
      }
      if (url.pathname === '/api/admin/device-models' && method === 'GET') {
        await json(200, { items: models, total: models.length, page: 1, page_size: 20 })
        return
      }
      if (url.pathname === '/api/device-models') {
        await json(200, { items: models, total: models.length, page: 1, page_size: 100 })
        return
      }
      if (url.pathname === '/api/admin/device-guides') {
        await json(200, { items: guides, total: guides.length, page: 1, page_size: 20 })
        return
      }
      if (url.pathname === '/api/admin/users') {
        await json(200, { items: users, total: users.length, page: 1, page_size: 20 })
        return
      }
      if (url.pathname === '/api/admin/knowledge-documents' && method === 'GET') {
        await json(200, { items: knowledge, total: knowledge.length, page: 1, page_size: 20 })
        return
      }
      const knowledgeOne = url.pathname.match(/^\/api\/admin\/knowledge-documents\/([^/]+)$/)
      if (knowledgeOne && method === 'GET') {
        await json(200, knowledge.find((item) => item.id === knowledgeOne[1]) || knowledge[0])
        return
      }
      if (url.pathname === '/api/admin/audit-logs') {
        const events = auditEvents().reverse()
        await json(200, { items: events, total: events.length, page: 1, page_size: 100 })
        return
      }
      if (url.pathname === '/api/stats/overview' || url.pathname === '/api/stats/matrix') {
        const from = url.searchParams.get('from')
        const to = url.searchParams.get('to')
        const days = daysOf(from, to)
        const overview = {
          from_: from, to, timezone: 'Asia/Shanghai', patient_count: 2, planned_count: 1,
          total_N: 14, total_M: 12, coverage_rate: 85.7,
          rows: [{ patient_id: 'p-li', patient_code: 'P-004', display_name: '李先生', N: 14, M: 12, coverage_rate: 85.7, missing_count: 2 }],
        }
        const matrix = {
          ...overview,
          days,
          rows: [{
            patient_id: 'p-li', patient_code: 'P-004', display_name: '李先生', N: 14, M: 12,
            cells: days.map((day) => ({ day, N: 2, M: 2, missing: 0, coverage_rate: 100 })),
          }],
        }
        if (matrix.rows[0]) {
          const per = Math.floor(14 / Math.max(days.length, 1))
          let leftN = 14
          let leftM = 12
          matrix.rows[0].cells = days.map((day, index) => {
            const n = index === days.length - 1 ? leftN : per
            const m = index === days.length - 1 ? leftM : Math.min(per, leftM)
            leftN -= n
            leftM -= m
            return { day, N: n, M: m, missing: Math.max(n - m, 0), coverage_rate: n ? Math.round((m / n) * 1000) / 10 : null }
          })
        }
        await json(200, url.pathname.endsWith('matrix') ? matrix : overview)
        return
      }
      const stats = url.pathname.match(/^\/api\/patients\/([^/]+)\/stats$/)
      if (stats) {
        const pack = reportStats(url.searchParams.get('from'), url.searchParams.get('to'))
        await json(200, pack.stats)
        return
      }
      if (url.pathname.endsWith('/stats/trend')) {
        const pack = reportStats(url.searchParams.get('from'), url.searchParams.get('to'))
        await json(200, { points: pack.points })
        return
      }
      if (url.pathname.includes('/followups')) {
        await json(200, {
          items: [{
            id: 'fu-1', patient_id: 'p-li', followed_at: `${addDays(shanghaiToday(), -1)}T10:30:00+08:00`,
            feedback: '需核对登记', action_taken: '电话随访', next_plan: '继续随访',
          }],
          total: 1, page: 1, page_size: 100,
        })
        return
      }
      if (url.pathname.includes('/medication-plans')) {
        await json(200, {
          items: [{
            id: 'plan-1', plan_type: 'REGULAR', drug_label: '万托林', version: 1,
            starts_at: '2026-10-01T00:00:00+08:00', ends_at: null,
            daily_times: [{ id: 't1', local_time: '08:00:00', label: null, is_enabled: true }],
          }, {
            id: 'plan-prn', plan_type: 'PRN', drug_label: '按需药物', version: 1,
            starts_at: '2026-10-01T00:00:00+08:00', ends_at: null, daily_times: [],
          }],
          total: 2, page: 1, page_size: 100,
        })
        return
      }
      if (url.pathname.includes('/daily-slots')) {
        if (url.searchParams.get('from') === '1999-01-01') {
          await json(500, { detail: { code: 'ERROR', message: '时点服务不可用' } })
          return
        }
        const day = shanghaiToday()
        await json(200, {
          items: [
            { id: 'slot-ok', plan_id: 'plan-1', patient_id: 'p-li', scheduled_at: `${addDays(day, -1)}T08:00:00+08:00`, state: 'ACTIVE', has_active_record: false },
            { id: 'slot-done', plan_id: 'plan-1', patient_id: 'p-li', scheduled_at: `${addDays(day, -1)}T20:00:00+08:00`, state: 'ACTIVE', has_active_record: true },
            { id: 'slot-future', plan_id: 'plan-1', patient_id: 'p-li', scheduled_at: `${day}T23:30:00+08:00`, state: 'ACTIVE', has_active_record: false },
          ],
          timezone: 'Asia/Shanghai',
        })
        return
      }
      if (url.pathname.includes('/medication-events') && method === 'GET') {
        await json(200, { items: [], total: 0, page: 1, page_size: 20 })
        return
      }
      if (url.pathname.startsWith('/api/tasks')) {
        await json(200, {
          items: [{ id: 'task-1', patient_id: 'p-li', task_type: 'MISSED_MEDICATION', status: 'OPEN', created_at: `${shanghaiToday()}T01:00:00+08:00` }],
          total: 1, page: 1, page_size: 20,
        })
        return
      }
      if (method === 'GET') {
        await json(200, { items: [], total: 0, page: 1, page_size: 20 })
        return
      }
      await json(201, { id: 'created', temporary_password: null, must_change_password: true, review_status: 'REVIEWED' })
    } catch (error) {
      console.log('MOCK', error.message)
      try { await request.respond({ status: 500, contentType: 'application/json', body: '{"detail":{"message":"mock"}}' }) } catch { /* already handled */ }
    }
  })

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await login(page, 'clinician_a', 'secret')
  await go(page, '/stats')
  await page.waitForFunction(() => document.body.innerText.includes('患者报告'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === '查看')?.click())
  await page.waitForFunction(() => document.body.innerText.includes('每日登记覆盖'), { timeout: 8000 })
  await new Promise((resolve) => setTimeout(resolve, 800))
  const reportText = await page.evaluate(() => document.querySelector('.ml-report')?.innerText || '')
  check('07 显示 85.7% 与 12/14', reportText.includes('85.7%') && reportText.includes('12') && reportText.includes('14'), reportText.slice(0, 240))
  check('07 来源是事件数 10 和 3', reportText.includes('患者自述') && reportText.includes('10') && reportText.includes('医护观察'))
  check('07 有未登记、随访和重复登记', reportText.includes('未发现登记') && reportText.includes('电话随访') && reportText.includes('重复登记'))
  check('07 没有基础管理报告大标题', !reportText.includes('基础管理报告'))
  await page.screenshot({ path: path.join(OUT, '07-patient-report-1440.png'), fullPage: true })
  await page.setViewport({ width: 1280, height: 800 })
  await page.screenshot({ path: path.join(OUT, '07-patient-report-1280.png'), fullPage: true })
  await page.setViewport({ width: 390, height: 844 })
  const overflow = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth + 2
    const wide = [...document.querySelectorAll('body *')]
      .map((node) => ({ node, box: node.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.right > limit)
      .slice(0, 8)
      .map(({ node, box }) => `${node.tagName}.${String(node.className).slice(0, 80)} right=${Math.round(box.right)} w=${Math.round(box.width)}`)
    const identity = document.querySelector('.ml-report-identity')
    return {
      overflow: document.documentElement.scrollWidth > limit,
      inner: window.innerWidth,
      dir: identity ? getComputedStyle(identity).flexDirection : 'missing',
      wide,
    }
  })
  check('07 窄屏不整页横滚', !overflow.overflow, JSON.stringify(overflow.wide))
  await page.screenshot({ path: path.join(OUT, '07-patient-report-390.png'), fullPage: true })
  await page.setViewport({ width: 1440, height: 900 })

  await go(page, '/workbench')
  await page.waitForFunction(() => document.body.innerText.includes('补登用药'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('补登用药'))?.click())
  await page.waitForFunction(() => document.body.innerText.includes('选择计划时点'))
  await new Promise((resolve) => setTimeout(resolve, 500))
  const backfillText = await page.evaluate(() => document.querySelector('.ant-modal')?.innerText || '')
  check('10 展示已登记和未到时点', backfillText.includes('已登记') && backfillText.includes('未到时点'), backfillText.slice(0, 300))
  check('10 有实际用药时间', backfillText.includes('实际用药时间'))
  await page.screenshot({ path: path.join(OUT, '10-backfill-1440.png') })
  const postsBefore = posts.length
  await page.evaluate(() => [...document.querySelectorAll('.ant-modal button')].find((node) => node.textContent?.includes('确认补登'))?.click())
  await new Promise((resolve) => setTimeout(resolve, 300))
  check('未选时点不发登记', posts.filter((item) => item.url === '/api/medication-events').length === posts.slice(0, postsBefore).filter((item) => item.url === '/api/medication-events').length)

  await login(page, 'admin', 'secret')
  await go(page, '/admin')
  await page.waitForFunction(() => document.body.innerText.includes('装置型号'))
  const adminText = await page.evaluate(() => document.body.innerText)
  check('管理端有五项导航', ['装置型号', '指导版本', '账号管理', '知识内容', '审计日志'].every((label) => adminText.includes(label)))
  check('管理员顶栏没有患者搜索', !adminText.includes('搜索患者'))
  await page.screenshot({ path: path.join(OUT, '11-devices-1440.png') })
  await page.evaluate(() => [...document.querySelectorAll('.ant-menu-item, button')].find((node) => node.textContent?.trim() === '指导版本')?.click())
  await page.waitForFunction(() => document.body.innerText.includes('新建指导草稿'))
  await page.screenshot({ path: path.join(OUT, '12-guides-1440.png') })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === '查看')?.click())
  await page.waitForFunction(() => document.body.innerText.includes('打开盖子'))
  check('已发布指导可以查看步骤', (await page.evaluate(() => document.body.innerText)).includes('打开盖子'))
  await page.keyboard.press('Escape')
  await page.evaluate(() => [...document.querySelectorAll('.ant-menu-item')].find((node) => node.textContent?.includes('账号管理'))?.click())
  await page.waitForFunction(() => document.body.innerText.includes('需改密'))
  const usersText = await page.evaluate(() => document.body.innerText)
  check('需改密按接口显示是', usersText.includes('clinician_a') && usersText.includes('是'))
  check('患者账号可以出现在列表', usersText.includes('patient_demo'))
  await page.screenshot({ path: path.join(OUT, '13-accounts-1440.png') })
  await page.evaluate(() => [...document.querySelectorAll('.ant-menu-item')].find((node) => node.textContent?.includes('知识内容'))?.click())
  await page.waitForFunction(() => document.body.innerText.includes('片段'))
  await page.screenshot({ path: path.join(OUT, '14-knowledge-1440.png') })
  const auditClicked = await page.evaluate(() => {
    const item = [...document.querySelectorAll('.ml-nav .ant-menu-item')].find((node) => node.textContent?.includes('审计日志'))
    item?.click()
    return Boolean(item)
  })
  await new Promise((resolve) => setTimeout(resolve, 400))
  if (!page.url().includes('tab=audit')) await go(page, '/admin?tab=audit')
  await new Promise((resolve) => setTimeout(resolve, 800))
  const auditText = await page.evaluate(() => document.body.innerText)
  console.log('AUDIT NAV', auditClicked, page.url(), auditText.slice(0, 180).replaceAll('\n', ' | '))
  check('审计图出现且没有停用账号假事件', auditText.includes('操作趋势') && !auditText.includes('停用账号'), auditText.slice(0, 180))
  check('审计页没有写入请求', posts.every((item) => !item.url.includes('/audit')))
  await page.screenshot({ path: path.join(OUT, '15-audit-1440.png'), fullPage: true })
  await page.setViewport({ width: 1280, height: 800 })
  await page.screenshot({ path: path.join(OUT, '15-audit-1280.png') })
  await page.setViewport({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(OUT, '11-devices-390.png'), fullPage: true })

  const failed = checks.filter((item) => !item.ok)
  await writeFile(path.resolve('docs/evidence/medix-final/browser-checks.json'), JSON.stringify({ mock: true, checks, failed: failed.length, posts }, null, 2))
  console.log(`CHECKS ${checks.length - failed.length}/${checks.length}`)
  await browser.close()
  if (failed.length) process.exitCode = 1
}

async function go(page, next) {
  await page.evaluate((path) => {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, next)
  await page.waitForFunction((path) => location.pathname === path, { timeout: 8000 }, next.split('?')[0])
  await new Promise((resolve) => setTimeout(resolve, 500))
}

async function login(page, name, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
  await page.click('input[placeholder="请输入账号"]', { clickCount: 3 })
  await page.type('input[placeholder="请输入账号"]', name)
  await page.type('input[placeholder="请输入密码"]', password)
  await Promise.all([
    page.waitForFunction(() => location.pathname !== '/login', { timeout: 8000 }),
    page.click('button.ml-auth-submit'),
  ])
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
