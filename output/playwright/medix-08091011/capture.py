import json, re, importlib.util
from pathlib import Path
from datetime import datetime,timezone
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('previous_capture',Path('output/playwright/medix-04050607/capture.py').resolve());prev=importlib.util.module_from_spec(spec);spec.loader.exec_module(prev)
old=prev.old;CHROME=prev.CHROME;BASE=prev.BASE;PID=prev.PID;OUT=Path(__file__).resolve().parent
class Fixture(prev.Fixture):
 def __init__(self):
  super().__init__();self.role='CLINICIAN';self.post_error=0;self.duplicate=False;self.plans_override=None;self.slots_override=None
  self.tasks=[dict(t,task_type='MISSED_MEDICATION') for t in self.tasks]
  self.followups=[dict(id='follow-'+str(i),patient_id=self.patients[j]['id'],task_id=None,followed_at='2026-11-0'+str(9-i)+'T'+tm+':00+08:00',feedback=f,action_taken=a,next_plan=n) for i,(j,tm,f,a,n) in enumerate([(5,'10:10','基本按时登记','提醒保持','下周复核'),(9,'18:30','偶有延迟登记','口头宣教','一周后复查'),(0,'09:20','需核对登记','说明登记方法','继续跟进')])]
  self.models=[dict(id='model-'+str(i),category=c,brand=b,model_name=n,manufacturer=m,status='ACTIVE') for i,(c,b,n,m) in enumerate([('pMDI','万托林','吸入气雾剂 pMDI','葛兰素史克'),('DPI','信必可','都保 DPI','阿斯利康'),('SMI','思力华','能倍乐 Respimat','勃林格殷格翰')])]
  self.plans=[dict(id='plan-A',device_model_id='model-A',plan_group_id='group-A',version=1,drug_label='示例药物（DEMO）',plan_type='REGULAR',timezone='Asia/Shanghai',starts_at='2026-11-02T00:00:00+08:00',ends_at=None,daily_times=[dict(local_time='08:00:00',is_enabled=True),dict(local_time='20:00:00',is_enabled=True)])]
  self.slots=[dict(id='slot-'+str(i),patient_id=self.patients[9]['id'],plan_id='plan-A',scheduled_at='2026-11-'+d+'T'+tm+':00+08:00',state='ACTIVE',has_active_record=False) for i,(d,tm) in enumerate([('07','08:00'),('07','20:00'),('08','08:00')])]
  self.events=[]
 def route(self,route):
  req=route.request;path=urlparse(req.url).path;q=parse_qs(urlparse(req.url).query)
  if not path.startswith('/api/'):route.continue_();return
  if any(path.endswith(f) for f in self.fail):route.fulfill(status=503,json={'message':'演示服务暂不可用'});return
  if req.method=='POST' and path=='/api/auth/login':
   route.fulfill(json={'access_token':'fixture-only','user':{'id':'fixture-user','account':'admin' if self.role=='ADMIN' else 'clinician_a','role':self.role,'status':'ACTIVE','must_change_password':False}});return
  if req.method=='POST' and path in ['/api/followups','/api/medication-events','/api/admin/device-models']:
   self.posts.append([path,req.post_data_json]);data=req.post_data_json
   if self.post_error:route.fulfill(status=self.post_error,json={'message':'模拟保存失败'});return
   if path=='/api/followups':
    new=dict(id='saved-'+str(len(self.posts)),**data);self.followups.insert(0,new)
    if data.get('close_task'):self.tasks=[t for t in self.tasks if t['id']!=data.get('task_id')]
    body={'followup':new}
   elif path=='/api/medication-events':
    new=dict(id='event-'+str(len(self.posts)),status='ACTIVE',**data);self.events.insert(0,new)
    for t in self.slots:
     if t['id']==data.get('slot_id'):t['has_active_record']=True
    body={'event':new,'is_duplicate':self.duplicate}
   else:
    new=dict(id='created-model',status='ACTIVE',**data);self.models.append(new);body=new
   route.fulfill(status=201,json=body);return
  if req.method!='GET':super().route(route);return
  self.reads.append([req.method,path,q])
  def paged(items):
   size=int(q.get('page_size',['20'])[0]);n=int(q.get('page',['1'])[0]);return {'items':items[(n-1)*size:n*size],'total':len(items),'page':n}
  if path=='/api/tasks':
   items=self.tasks
   if q.get('status'):items=[t for t in items if t['status']==q['status'][0]]
   if q.get('patient_id'):items=[t for t in items if t['patient_id']==q['patient_id'][0]]
   body=paged(items)
  elif path.endswith('/followups'):
   items=self.followups
   if path.startswith('/api/patients/'):items=[f for f in items if f['patient_id']==path.split('/')[3]]
   body=paged(items)
  elif path.endswith('/medication-plans'):body=paged(self.plans_override if self.plans_override is not None else self.plans)
  elif path.endswith('/daily-slots'):body={'items':self.slots_override if self.slots_override is not None else [dict(s,patient_id=path.split('/')[3]) for s in self.slots]}
  elif path.endswith('/medication-events'):body=paged(self.events)
  elif path=='/api/admin/device-models':body=paged(self.models)
  else:super().route(route);return
  route.fulfill(json=body)

def shot(page,name,full=False):old.settle(page);page.wait_for_timeout(500);page.screenshot(path=str(OUT/name),full_page=full)
def signin(page,admin=False):
 page.goto(BASE+'/login');page.get_by_label('账号',exact=True).fill('fixture');page.get_by_label('密码',exact=True).fill('fixture');page.get_by_role('button',name='登录',exact=True).click()
 page.wait_for_url('**/admin' if admin else '**/workbench')
def open_backfill(page):
 old.go(page,'/workbench');page.get_by_role('button',name='补登用药',exact=True).first.click();expect(page.get_by_role('radio')).to_have_count(3);page.get_by_role('radio').first.check()
def geometry(page):
 return page.locator('.ant-modal:visible').evaluate('(e)=>({rect:e.getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight]})')
def main():
 results={};errors=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROME,headless=True)
  ctx=browser.new_context(viewport={'width':1440,'height':900},timezone_id='America/Los_Angeles')
  ctx.add_init_script("sessionStorage.setItem('medix-demo-assets','approved-fixture-v1')")
  fixture=Fixture();ctx.route('**/api/**',fixture.route);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.clock.install(time=datetime(2026,11,9,13,tzinfo=timezone.utc));signin(page)
  old.go(page,'/followups');expect(page.locator('.ml-follow-queue tbody tr')).to_have_count(5);expect(page.locator('.ml-follow-records tbody tr')).to_have_count(3);shot(page,'08-followups.png',True)
  page.get_by_role('button',name='快速处理',exact=True).first.click();expect(page.get_by_role('dialog',name='处理任务')).to_be_visible();shot(page,'09-task-close-modal.png');results['09desktop']=geometry(page)
  page.get_by_role('button',name='取消',exact=True).click();open_backfill(page);shot(page,'10-medication-backfill-modal.png');results['10desktop']=geometry(page);page.set_viewport_size({'width':1280,'height':900});shot(page,'10-1280.png');page.set_viewport_size({'width':1440,'height':900})
  page.get_by_role('button',name='取消',exact=True).click()
  page.set_viewport_size({'width':390,'height':844});old.go(page,'/followups');shot(page,'08-followups-mobile.png',True)
  page.get_by_role('button',name='快速处理',exact=True).first.click();shot(page,'09-task-close-mobile.png');results['09mobile']=geometry(page)
  page.get_by_role('button',name='取消',exact=True).click();open_backfill(page);shot(page,'10-backfill-mobile.png');results['10mobile']=geometry(page)
  page.get_by_role('button',name='取消',exact=True).click()
  ctx.close()
  ctx=browser.new_context(viewport={'width':1440,'height':900});ctx.add_init_script("sessionStorage.setItem('medix-demo-assets','approved-fixture-v1')")
  fixture=Fixture();fixture.role='ADMIN';ctx.route('**/api/**',fixture.route);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));signin(page,True);expect(page.locator('.ml-admin-models tbody tr')).to_have_count(3);shot(page,'11-admin-devices.png');page.set_viewport_size({'width':1280,'height':900});shot(page,'11-1280.png');page.set_viewport_size({'width':1440,'height':900})
  page.set_viewport_size({'width':390,'height':844});shot(page,'11-admin-devices-mobile.png',True)
  results['errors']=errors;(OUT/'capture-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(results,ensure_ascii=False))
  browser.close()
if __name__=='__main__':main()

