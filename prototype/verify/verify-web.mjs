import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9400 + Math.floor(Math.random() * 500);
const ORIGIN = 'http://127.0.0.1:4175/prototype/';
const EVIDENCE = 'D:\\My_Grand_Projects2026\\14Day-Software-Fighter\\prototype\\evidence';
const profile = join(tmpdir(), 'cdp-v4-web-' + Date.now());
function killEdgeOnPort(port) {
  const out = spawnSync('cmd', ['/c', 'netstat -ano | findstr :' + port + ' | findstr LISTENING'], { encoding: 'utf8' }).stdout || '';
  const pids = [...new Set(out.split(/\r?\n/).map((l) => l.trim().split(/\s+/).pop()).filter((p) => /^\d+$/.test(p)))];
  for (const pid of pids) spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' });
  spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

async function getJson(path) {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return r.json();
}

async function waitForPage() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await getJson('/json/list');
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
      } else if (m.method && this.onEvent) {
        this.onEvent(m);
      }
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

async function open(path, w = 1440, h = 900) {
  errors = [];
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await navigate(ORIGIN + path);
  await waitUntil(`!document.body.hasAttribute('x-cloak')`);
  await sleep(120);
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

  console.log('== 场景 1：筛选与选中（1440）');
  await open('web.html', 1440, 900);
  ok('默认渲染 3 条待核查任务', await q(`document.querySelectorAll('.task-row').length===3`));
  ok('默认选中林女士并展示患者摘要', await q(`(()=>{const a=document.querySelector('aside[aria-label="选中患者摘要"]');return !!a&&a.textContent.includes('林女士')&&document.querySelector('.task-row.is-selected')?.textContent.includes('林女士')})()`));
  await click('.task-row', '周先生'); await sleep(150);
  ok('点击周先生后选中行与摘要同步', await q(`(()=>{const a=document.querySelector('aside[aria-label="选中患者摘要"] h3');return document.querySelector('.task-row.is-selected')?.textContent.includes('周先生')&&a?.textContent.includes('周先生')})()`));
  await click('.seg button', '处理中'); await sleep(150);
  ok('筛选"处理中"只剩周先生', await q(`document.querySelectorAll('.task-row').length===1&&document.querySelector('.task-row').textContent.includes('周先生')`));
  await click('.seg button', '待核查'); await sleep(150);
  ok('筛选"待核查"剩林女士和许女士', await q(`(()=>{const t=[...document.querySelectorAll('.task-row')].map(e=>e.textContent);return t.length===2&&t[0].includes('林女士')&&t[1].includes('许女士')})()`));
  await click('.seg button', '待处理'); await sleep(150);
  ok('切回"待处理"恢复 3 条', await q(`document.querySelectorAll('.task-row').length===3`));
  await click('.nav-item', '患者管理'); await sleep(150);
  ok('点击患者管理打开详情弹层', await q(`document.querySelector('dialog').open`));
  await click('.x[aria-label="关闭详情"]'); await sleep(120);
  ok('关闭详情弹层', await q(`!document.querySelector('dialog').open`));
  ok('场景1 无横向溢出', await noOverflow());
  ok('场景1 控制台无报错', errors.length === 0, errors.join(' | '));

  console.log('== 场景 2：随访保存成功（1440）');
  await open('web.html', 1440, 900);
  await click('aside[aria-label="选中患者摘要"] button', '记录随访'); await sleep(200);
  ok('记录随访进入表单并带入林女士', await q(`document.querySelector('.fu-head h2')?.textContent.includes('林女士')&&document.querySelector('.fu').style.display!=='none'`));
  await setVal('feedback', '电话联系，患者称本周按时使用，已核对装置');
  await setVal('action-taken', '核实吸入步骤，提醒按固定时点登记');
  await submitVia('feedback'); await sleep(650);
  ok('保存后显示成功提示', (await toastText()).includes('随访已保存'));
  ok('保存后回到工作台', await q(`document.querySelector('.fu').style.display==='none'`));
  ok('已处理任务从待处理列表移除', await q(`document.querySelectorAll('.task-row').length===2`));
  ok('近期随访出现林女士新记录', await q(`document.querySelector('.rec strong')?.textContent.includes('林女士')`));
  ok('待核查计数减为 2', await q(`[...document.querySelectorAll('.overview .stat-value')][1]?.textContent.trim()==='2'`));
  await shot('interaction-save-1440.png');
  ok('场景2 控制台无报错', errors.length === 0, errors.join(' | '));

  console.log('== 场景 3：随访保存失败后保留输入并重试');
  await open('web.html?submit=fail', 1440, 900);
  await click('aside[aria-label="选中患者摘要"] button', '记录随访'); await sleep(200);
  await setVal('feedback', '第一次提交的内容');
  await setVal('action-taken', '第一次处理措施');
  await submitVia('feedback'); await sleep(650);
  ok('失败时显示未保存提示', await q(`document.querySelector('.fu .alert')?.textContent.includes('随访尚未保存，输入已保留，请重试。')`));
  ok('失败后输入保留', await q(`document.getElementById('feedback').value==='第一次提交的内容'&&document.getElementById('action-taken').value==='第一次处理措施'`));
  ok('失败时任务状态未改变', await st(`d.tasks.find(t=>t.id==='t1').status==='OPEN'`));
  await submitVia('feedback'); await sleep(650);
  ok('重试后显示成功提示', (await toastText()).includes('随访已保存'));
  ok('重试后任务标记为已处理', await st(`d.tasks.find(t=>t.id==='t1').status==='CLOSED'`));
  ok('场景3 控制台无报错', errors.length === 0, errors.join(' | '));

  console.log('== 场景 4：读取失败后重试（1440）');
  await open('web.html?state=error', 1440, 900);
  ok('读取失败显示提示且不显示为零', await q(`(()=>{const a=document.querySelector('.alert');return a&&a.textContent.includes('工作台暂时无法读取')&&a.offsetParent!==null})()`));
  await click('.alert button', '重新读取'); await sleep(60);
  ok('点击重新读取进入加载态', await st(`d.state==='loading'`));
  await sleep(550);
  ok('重新读取后恢复 3 条任务', await st(`d.state==='normal'`) && await q(`document.querySelectorAll('.task-row').length===3`));
  ok('场景4 控制台无报错', errors.length === 0, errors.join(' | '));

  console.log('== 场景 5：暂无待核查（1440）');
  await open('web.html?state=empty', 1440, 900);
  ok('空状态显示暂无待核查事项', await q(`[...document.querySelectorAll('.empty h2')].some(h=>h.textContent.includes('暂无待核查事项')&&h.offsetParent!==null)`));
  ok('空状态不展示患者摘要', await q(`!document.querySelector('aside[aria-label="选中患者摘要"]')`));
  ok('空状态待核查计数为 0', await q(`[...document.querySelectorAll('.overview .stat-value')][1]?.textContent.trim()==='0'`));

  console.log('== 场景 6：窄屏 1280 选中行内展开摘要');
  await open('web.html', 1280, 900);
  ok('1280 不展示右侧摘要栏', await q(`!document.querySelector('aside[aria-label="选中患者摘要"]')`));
  ok('1280 仅在选中行下展开一处摘要', await q(`[...document.querySelectorAll('.task-inline')].filter(e=>e.offsetParent!==null).length===1`));
  await click('.task-row', '周先生'); await sleep(150);
  ok('切换到周先生后摘要移到其行下', await q(`(()=>{const v=[...document.querySelectorAll('.task-inline')].filter(e=>e.offsetParent!==null);return v.length===1&&v[0].parentElement.querySelector('.task-row').textContent.includes('周先生')})()`));
  ok('1280 无横向溢出', await noOverflow());
  await shot('interaction-1280-inline.png');
  ok('场景6 控制台无报错', errors.length === 0, errors.join(' | '));

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
