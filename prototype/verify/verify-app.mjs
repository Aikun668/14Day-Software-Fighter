import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9400 + Math.floor(Math.random() * 500);
const ORIGIN = 'http://127.0.0.1:4175/prototype/';
const EVIDENCE = 'D:\\My_Grand_Projects2026\\14Day-Software-Fighter\\prototype\\evidence';
const profile = join(tmpdir(), 'cdp-v4-app-' + Date.now());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

function killEdgeOnPort(port) {
  const out = spawnSync('cmd', ['/c', 'netstat -ano | findstr :' + port + ' | findstr LISTENING'], { encoding: 'utf8' }).stdout || '';
  const pids = [...new Set(out.split(/\r?\n/).map((l) => l.trim().split(/\s+/).pop()).filter((p) => /^\d+$/.test(p)))];
  for (const pid of pids) spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' });
  spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' });
}

async function waitForPage() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {}
    await sleep(200);
  }
  throw new Error('no page target');
}

class CDP {
  constructor(url) {
    this.id = 0;
    this.pending = new Map();
    this.onEvent = null;
    this.ws = new WebSocket(url);
    this.ready = new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method && this.onEvent) this.onEvent(m);
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('JS: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
}

const results = [];
const ok = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

let cdp;
let errors = [];

async function waitUntil(expr, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if (await cdp.eval(`!!(${expr})`)) return; } catch {}
    await sleep(100);
  }
  throw new Error('timeout waiting: ' + expr);
}

function navigate(url) {
  return new Promise(async (res, rej) => {
    const prev = cdp.onEvent;
    cdp.onEvent = (m) => {
      prev?.(m);
      if (m.method === 'Page.loadEventFired') { cdp.onEvent = prev; res(); }
    };
    try { await cdp.send('Page.navigate', { url }); } catch (e) { rej(e); }
  });
}

async function open(path, w = 390, h = 844) {
  errors = [];
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: true });
  await navigate(ORIGIN + path);
  await waitUntil(`!document.body.hasAttribute('x-cloak')`);
  await sleep(150);
}

const q = (expr) => cdp.eval(expr);
const st = (expr) => cdp.eval(`(()=>{const d=Alpine.$data(document.body);return (${expr})})()`);

async function click(selector, text = '') {
  return q(`(()=>{const els=[...document.querySelectorAll(${JSON.stringify(selector)})].filter(e=>e.offsetParent!==null&&(${JSON.stringify(text)}===''||e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(text)})));if(!els.length)return false;els[0].click();return true;})()`);
}

async function setVal(id, val) {
  return q(`(()=>{const el=document.getElementById(${JSON.stringify(id)});const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(val)});el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
}

const submitVia = (id) => q(`document.getElementById(${JSON.stringify(id)}).form.requestSubmit()`);
const toastText = () => q(`document.querySelector('.toast')?.textContent||''`);
const noOverflow = () => q(`document.documentElement.scrollWidth<=window.innerWidth`);
const visibleSolidPrimary = () => q(`[...document.querySelectorAll('.btn:not(.btn-secondary):not(.btn-ghost)')].filter(e=>e.offsetParent!==null).length`);
const visibleHeroButtons = () => q(`[...document.querySelectorAll('.hero .btn')].filter(e=>e.offsetParent!==null).length`);

async function shot(name) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(EVIDENCE, name), Buffer.from(r.data, 'base64'));
}

async function main() {
  const target = await waitForPage();
  cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  cdp.onEvent = (m) => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text);
  };

  console.log('== 场景 1：首页结构（390）');
  await open('app.html', 390, 844);
  ok('未登记时显示下一步登记按钮', await q(`[...document.querySelectorAll('.hero .btn')].some(b=>b.offsetParent!==null&&b.textContent.includes('登记实际情况'))`));
  ok('首屏唯一实心紫按钮', (await visibleSolidPrimary()) === 1, `实际 ${await visibleSolidPrimary()}`);
  ok('登记按钮高度不小于 52px', await q(`(()=>{const b=[...document.querySelectorAll('.hero .btn')].find(e=>e.offsetParent!==null&&e.textContent.includes('登记实际情况'));return b.getBoundingClientRect().height>=52})()`));
  ok('环形显示 0 / 2', await q(`document.querySelector('.ring-text strong').textContent.trim()==='0 / 2'`));
  ok('08:00 显示未发现登记（描边标签）', await q(`[...document.querySelectorAll('.item .tag')].some(t=>t.textContent.trim()==='未发现登记'&&t.classList.contains('tag-missed'))`));
  ok('08:00 行是可点按钮且带箭头', await q(`[...document.querySelectorAll('button.item')].some(b=>b.offsetParent!==null&&b.textContent.includes('08:00')&&b.querySelector('svg'))`));
  ok('20:00 行不可点（不是按钮）', await q(`![...document.querySelectorAll('button.item')].some(b=>b.textContent.includes('20:00'))`));
  ok('学习入口三格可见', await q(`[...document.querySelectorAll('.shortcut')].filter(e=>e.offsetParent!==null).length===3`));
  ok('底部导航三项', await q(`document.querySelectorAll('.tabbar button').length===3`));
  ok('无横向溢出', await noOverflow());
  await shot('app-home-390.png');
  await click('.text-link', '本人信息'); await sleep(200);
  ok('本人信息入口可达', await st(`d.screen==='profile'`) && await q(`document.body.textContent.includes('本人标识')`));
  await click('.topbar .back'); await sleep(200);
  ok('从本人信息返回今日', await st(`d.screen==='home'&&d.tab==='today'`));
  ok('场景1 控制台无报错', errors.length === 0, errors.join(' | '));

  console.log('== 场景 2：登记成功');
  await open('app.html', 390, 844);
  await click('.hero .btn', '登记实际情况'); await sleep(200);
  ok('点击后进入用药登记页面', await st(`d.screen==='record'`));
  await setVal('record-note', '早餐后使用');
  await submitVia('record-note'); await sleep(650);
  ok('登记成功后环形变为 1 / 2', await q(`document.querySelector('.ring-text strong').textContent.trim()==='1 / 2'`));
  ok('登记成功后提示已保存', (await toastText()).includes('登记已保存'));
  ok('登记成功后下一步按钮收起', (await visibleHeroButtons()) === 0);
  ok('已登记的 08:00 标签为已登记', await q(`[...document.querySelectorAll('.item .tag')].some(t=>t.textContent.trim()==='已登记')`));
  await shot('app-recorded-390.png');
  await click('button.item', '08:00'); await sleep(200);
  ok('已登记后点 08:00 行进入记录页', await st(`d.tab==='history'`) && await q(`document.querySelector('.page-title h2')?.textContent.trim()==='记录'`));
  ok('场景2 控制台无报错', errors.length === 0, errors.join(' | '));

  console.log('== 场景 3：登记失败后保留输入并重试');
  await open('app.html?submit=fail', 390, 844);
  await click('.hero .btn', '登记实际情况'); await sleep(200);
  await setVal('record-note', '第一次输入的备注');
  await submitVia('record-note'); await sleep(650);
  ok('失败时显示登记尚未保存', await q(`document.querySelector('.form .alert')?.textContent.includes('登记尚未保存')`));
  ok('失败后输入保留', await q(`document.getElementById('record-note').value==='第一次输入的备注'`));
  ok('失败时环形仍为 0 / 2', await st(`d.recorded===false`));
  await submitVia('record-note'); await sleep(650);
  ok('重试成功后记录已登记', await st(`d.recorded===true`));
  ok('场景3 控制台无报错', errors.length === 0, errors.join(' | '));

  console.log('== 场景 4：提交未确认后先核对，不能直接补交');
  await open('app.html?submit=timeout', 390, 844);
  await click('.hero .btn', '登记实际情况'); await sleep(200);
  await submitVia('record-note'); await sleep(650);
  ok('未确认时显示先核对的提示', await q(`document.querySelector('.form .alert')?.textContent.includes('提交结果尚未确认')`));
  ok('未确认时提交按钮禁用', await q(`document.querySelector('.form button[type=submit]').disabled===true`));
  await click('.form .alert button', '核对记录'); await sleep(450);
  ok('核对后提示未找到有效登记', await q(`document.querySelector('.form .alert')?.textContent.includes('未找到本次有效登记')`));
  ok('核对后提交按钮恢复可用', await q(`document.querySelector('.form button[type=submit]').disabled===false`));
  ok('场景4 控制台无报错', errors.length === 0, errors.join(' | '));

  console.log('== 场景 5：暂无固定计划');
  await open('app.html?state=empty', 390, 844);
  ok('空状态显示暂无固定计划', await q(`[...document.querySelectorAll('h2')].some(h=>h.textContent.trim()==='暂无固定计划'&&h.offsetParent!==null)`));
  ok('空状态不显示环形与下一步', await q(`!document.querySelector('.hero')||document.querySelector('.hero').offsetParent===null`));
  ok('空状态提供按需登记入口', await q(`[...document.querySelectorAll('.note-block button')].some(b=>b.textContent.includes('登记按需用药'))`));
  ok('空状态无横向溢出', await noOverflow());
  await shot('app-empty-390.png');

  console.log('== 场景 6：读取失败后重试');
  await open('app.html?state=error', 390, 844);
  ok('读取失败显示提示', await q(`[...document.querySelectorAll('.alert strong')].some(s=>s.textContent.includes('今日信息暂时无法读取')&&s.offsetParent!==null)`));
  await click('.alert button', '重新读取'); await sleep(60);
  ok('点击后进入加载态', await st(`d.state==='loading'`));
  await sleep(500);
  ok('重新读取后恢复首页', await st(`d.state==='normal'`) && await q(`!!document.querySelector('.hero')`));

  console.log('== 场景 7：底部导航与指导页（360）');
  await open('app.html', 360, 800);
  ok('360 无横向溢出', await noOverflow());
  await click('.tabbar button', '记录'); await sleep(200);
  ok('记录标签进入记录页', await st(`d.tab==='history'`) && await q(`document.querySelector('.page-title h2')?.textContent.trim()==='记录'`));
  await click('.tabbar button', '指导'); await sleep(200);
  ok('指导标签进入指导页', await st(`d.tab==='guide'`) && await q(`document.querySelector('.page-title h2')?.textContent.trim()==='指导'`));
  await click('.menu-item', '型号操作指导'); await sleep(250);
  ok('型号指导页显示暂无已发布资料', await st(`d.screen==='guide'`) && await q(`[...document.querySelectorAll('.note-block h2')].some(h=>h.offsetParent!==null&&h.textContent.includes('暂无已发布的指导资料'))`));
  await shot('app-guide-360.png');
  await click('.topbar .back'); await sleep(200);
  ok('从指导页返回指导标签', await st(`d.screen==='home'&&d.tab==='guide'`));
  ok('场景7 控制台无报错', errors.length === 0, errors.join(' | '));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n合计 ${results.length} 项，通过 ${results.length - failed.length}，未通过 ${failed.length}`);
  if (failed.length) console.log('未通过：\n' + failed.map((f) => '  - ' + f.name).join('\n'));
}

try {
  await main();
} catch (e) {
  console.log('ERROR ' + e.message);
  process.exitCode = 1;
} finally {
  try { cdp?.ws?.close(); } catch {}
  killEdgeOnPort(PORT);
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
