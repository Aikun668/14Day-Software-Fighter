from pathlib import Path
import ast,json,time,hashlib
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
ROOT=Path.cwd();OUT=Path(__file__).resolve().parent;BASE='http://127.0.0.1:5190';CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'
tree=ast.parse((ROOT/'backend/tests/check_patient_p01.py').read_text(encoding='utf-8-sig'))
credential=next(ast.literal_eval(n) for n in ast.walk(tree) if isinstance(n,ast.Dict) and any(isinstance(v,ast.Constant) and v.value=='patient_x' for v in n.values))
shots=[];responses=[];writes=[];errors=[]
def settle(a):
 a.wait_for_function("!document.body.innerText.includes('加载中…')",timeout=20000)
 a.evaluate("async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))}")
 a.wait_for_timeout(350)
def go(a,path):
 a.evaluate("p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'))}",path);a.wait_for_timeout(300);settle(a)
def shot(a,id,title,note,kind='live-read-only',route=None):
 settle(a);a.evaluate('scrollTo(0,0)');a.mouse.move(389,0);a.wait_for_timeout(100)
 a.screenshot(path=str(OUT/(id+'.png')));a.screenshot(path=str(OUT/(id+'-full.png')),full_page=True)
 shots.append({'id':id,'title':title,'route':route or urlparse(a.url).path,'mode':kind,'note':note,'viewport':[390,844],'document_width':a.evaluate('document.documentElement.scrollWidth'),'document_height':a.evaluate('document.documentElement.scrollHeight')})
 print('CAPTURE',id,title,flush=True)
def response(r):
 if '/api/' in r.url:responses.append({'path':urlparse(r.url).path,'status':r.status})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=CHROME,headless=True);c=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True,timezone_id='Asia/Shanghai');a=c.new_page();a.on('pageerror',lambda e:errors.append(str(e)));a.on('response',response)
 def guard(r):
  path=urlparse(r.request.url).path
  if r.request.method not in ['GET','OPTIONS']:
   writes.append({'method':r.request.method,'path':path})
   if path not in ['/api/auth/login','/api/auth/logout']:r.fulfill(status=409,json={'message':'截图审查禁止业务写入'});return
  r.continue_()
 c.route('**/api/**',guard)
 a.goto(BASE+'/login');expect(a.get_by_placeholder('请输入账号')).to_be_visible();shot(a,'01-login','登录','当前APP登录首屏')
 a.get_by_placeholder('请输入账号').fill(credential['account']);a.get_by_placeholder('请输入密码').fill(credential['password']);a.get_by_role('button',name='登录',exact=True).click();a.wait_for_url('**/today',timeout=20000);settle(a)
 print('TODAY',a.locator('main').inner_text()[:750],flush=True)
 shot(a,'03-today','今日','真实后端当前患者与当天数据')
 go(a,'/change-password');expect(a.get_by_role('heading',name='首次登录需修改密码')).to_be_visible();shot(a,'02-change-password','首次改密','仅预览空表单，没有修改密码');go(a,'/today')
 a.get_by_role('button',name='型号指导',exact=True).click();settle(a);shot(a,'04-guide','型号指导','实际已绑定型号与后端指导步骤')
 print('GUIDE',a.locator('main').inner_text()[:600],flush=True)
 a.get_by_role('button',name='开始自检',exact=True).click();settle(a);shot(a,'05-training','操作自检','逐步自检表单，没有提交')
 a.get_by_role('button',name='历史记录',exact=True).click();settle(a);shot(a,'08-training-history','自检历史','同一页面的历史状态')
 go(a,'/medication');shot(a,'06-medication','用药记录','真实当日时点与历史记录，没有登记或撤销')
 if a.get_by_role('button',name='撤销此记录',exact=True).count():
  a.get_by_role('button',name='撤销此记录',exact=True).first.click();expect(a.get_by_text('撤销此登记？',exact=True)).to_be_visible();shot(a,'09-revoke-sheet','撤销确认','只打开确认层，未确认撤销');a.get_by_role('button',name='取消',exact=True).click()
 go(a,'/assistant');shot(a,'07-assistant','AI指导助手','空白提问状态；未调用外部模型')
 # Preview an otherwise unobservable result branch without touching AI or business data.
 def answer(r):
  r.fulfill(json={'status':'NO_EVIDENCE','answer':'当前已审核资料未提供该问题的可靠依据。','citations':[]})
 a.route('**/api/ai/ask',answer)
 a.get_by_placeholder('例如：这个型号使用前需要做哪些准备？（请勿输入姓名、电话等身份信息）').fill('这个型号的保养资料在哪里查看？')
 a.get_by_role('button',name='提问',exact=True).click();expect(a.get_by_text('资料不足',exact=True)).to_be_visible();shot(a,'10-assistant-result','助手反馈','响应使用隔离示例，展示现有“资料不足”样式，未调用模型','fixture-response');a.unroute('**/api/ai/ask')
 go(a,'/today');a.get_by_role('button',name='退出',exact=True).click();a.wait_for_url('**/login')
 assert all(x['path'] in ['/api/auth/login','/api/auth/logout'] for x in writes),writes
 assert not errors,errors
 sources=json.loads((OUT/'source-before.json').read_text());assert all(hashlib.sha256((ROOT/n).read_bytes()).hexdigest()==v for n,v in sources.items())
 result={'scope':'patient-app current code browser capture, not Android device capture','viewport':[390,844],'timezone':'Asia/Shanghai','native_ui':'not captured','screens':sorted(shots,key=lambda s:s['id']),'api_responses':responses,'real_writes':writes,'pageerrors':errors,'product_source_unchanged':True}
 (OUT/'capture-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print('Capture audit complete',len(shots),'screens',flush=True);b.close()
