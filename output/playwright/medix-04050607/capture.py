import sys, json, re
from pathlib import Path
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse,parse_qs
import importlib.util
spec=importlib.util.spec_from_file_location('baseline_capture',Path('output/playwright/medix-0123/capture.py').resolve());old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
from playwright.sync_api import sync_playwright,expect
OUT=Path('output/playwright/medix-04050607').resolve()
BASE=old.BASE; CHROME=old.CHROME
PID=old.PATIENTS[0]['id']
class Fixture(old.Fixture):
 def __init__(self):
  super().__init__(); self.fail=set(); self.mode='normal'; self.reads=[]; self.created_plans=[]; self.event_count=1; self.duplicate_detail=False
  self.tasks=[{**t,'created_at':'2026-11-08T10:00:00+08:00'} for t in self.tasks]
  self.seed=json.loads(Path('docs/design/medix-light/handoff-07-v1/fixture.json').read_text(encoding='utf-8-sig'))
 def route(self,route):
  req=route.request; path=urlparse(req.url).path; q=parse_qs(urlparse(req.url).query)
  if not path.startswith('/api/'): route.continue_(); return
  self.reads.append([req.method,path,q])
  if any(path.endswith(f) for f in self.fail): route.fulfill(status=503,json={'message':'演示服务暂不可用'}); return
  if req.method in ['POST','PATCH'] and path != '/api/auth/login' and path != '/api/auth/logout':
   self.posts.append([path,req.post_data_json]); data=req.post_data_json
   if path.endswith('/account'): body={'temporary_password':'Fixture-only-temp'}
   elif path.endswith('/medication-plans'): self.created_plans.insert(0,{**data,'id':'created-plan','version':1}); body={'id':'created-plan'}
   else: body={'id':'created','is_duplicate':False}
   route.fulfill(json=body); return
  if req.method!='GET': super().route(route); return
  if path in ['/api/stats/overview','/api/stats/matrix']:
   start=q['from'][0];end=q['to'][0];days=[];d=start
   while d<end: days.append(d); d=(datetime.fromisoformat(d)+timedelta(days=1)).strftime('%Y-%m-%d')
   totals=[24,28,26,32,30,34,36]; cells=[]
   for i in range(10):
    cs=[dict(day=d,N=2 if i==0 else 4 if i<8 else 5,M=0,coverage_rate=0,missing=0) for d in days];cells.append(cs)
   for j,d in enumerate(days):
    first=[2,1,2,2,1,2,2][j%7];cells[0][j]['M']=first;remain=totals[j%7]-first
    for k in range(9):
     i=1+(k+j*3)%9;v=min(cells[i][j]['N'],remain);cells[i][j]['M']=v;remain-=v
   rows=[]
   for i in range(10):
    person=self.patients[i];cs=cells[i]
    for c in cs:c.update(coverage_rate=round(c['M']/c['N']*100,1),missing=c['N']-c['M'])
    N=sum(c['N'] for c in cs);M=sum(c['M'] for c in cs)
    rows.append(dict(patient_id=person['id'],patient_code=person['patient_code'],display_name=person['display_name'],N=N,M=M,coverage_rate=round(M/N*100,1),missing_count=N-M,cells=cs))
   if self.mode=='zero':
    for r in rows:
     r.update(N=0,M=0,coverage_rate=None,missing_count=0)
     for c in r['cells']: c.update(N=0,M=0,coverage_rate=None,missing=0)
   if self.mode=='weighted':
    rows=rows[:2]
    for i,r in enumerate(rows):
     for c in r['cells']:c.update(N=0,M=0,coverage_rate=None,missing=0)
     r['cells'][0].update(N=1 if i==0 else 9,M=1,coverage_rate=100 if i==0 else 11.1,missing=0 if i==0 else 8)
     r.update(N=1 if i==0 else 9,M=1,coverage_rate=100 if i==0 else 11.1,missing_count=0 if i==0 else 8)
   N=sum(r['N'] for r in rows);M=sum(r['M'] for r in rows)
   if self.mode=='mismatch' and path.endswith('matrix'):
    c=next(c for r in rows for c in r['cells'] if c['M']<c['N']);c['M']+=1;c['coverage_rate']=round(c['M']/c['N']*100,1);c['missing']-=1
    for r in rows:r['M']=sum(c['M'] for c in r['cells']);r['coverage_rate']=round(r['M']/r['N']*100,1)
    M+=1
   body=dict(from_=start,to=end,timezone='Asia/Shanghai',total_N=N,total_M=M,coverage_rate=round(M/N*100,1) if N else None,patient_count=len(rows),planned_count=len(rows),days=days,rows=rows)
  elif re.fullmatch('/api/patients/[^/]+',path):
   body=next((p for p in self.patients if p['id']==path.split('/')[-1]),{**self.patients[0],'id':path.split('/')[-1]});body={**body,'note':None}
  elif path.endswith('/medication-plans'):
   body={'items':self.created_plans+[
    dict(id='plan-A',device_model_id='model-A',plan_group_id='group-A',version=1,drug_label='示例药物（DEMO）',plan_type='REGULAR',timezone='Asia/Shanghai',starts_at='2026-11-02T00:00:00+08:00',ends_at=None,daily_times=[dict(id='time-1',local_time='08:00:00',is_enabled=True),dict(id='time-2',local_time='20:00:00',is_enabled=True)]),
    dict(id='plan-B',device_model_id='model-A',plan_group_id='group-B',version=1,drug_label='示例药物（DEMO）',plan_type='REGULAR',timezone='Asia/Shanghai',starts_at='2026-10-26T00:00:00+08:00',ends_at='2026-11-02T00:00:00+08:00',daily_times=[dict(id='time-3',local_time='08:00:00',is_enabled=True),dict(id='time-4',local_time='20:00:00',is_enabled=True)])], 'total':len(self.created_plans)+2}
  elif path.endswith('/daily-slots'):
   start=q.get('from',['2026-11-03'])[0]; slots=[]
   for i in range(7):
    d=(datetime.fromisoformat(start)+timedelta(days=i)).strftime('%Y-%m-%d')
    for t in ['08:00','20:00']:slots.append(dict(id=f'detail-{i}-{t}',patient_id=PID,plan_id='plan-A',scheduled_at=f'{d}T{t}:00+08:00',state='DUE',has_active_record=False))
   if self.duplicate_detail:slots.append({**slots[0],'id':'duplicate-slot','plan_id':'plan-B','has_active_record':True})
   body={'items':slots}
  elif path.endswith('/medication-events'):
   items=[dict(id=f'event-{i}',slot_id='detail-0-08:00',source='PATIENT_REPORT' if i==0 else 'OTHER_SOURCE',occurred_at='2026-11-03T08:00:00+08:00',status='ACTIVE',note=None) for i in range(self.event_count)]
   n=int(q.get('page',['1'])[0]);size=int(q.get('page_size',['50'])[0]);body={'items':items[(n-1)*size:n*size],'total':len(items)}
  elif path.endswith('/stats/trend') or re.fullmatch('/api/patients/[^/]+/stats',path):
   start=q['from'][0];end=q['to'][0]
   body={**self.seed['expected'],'from_':start,'to':end,'timezone':'Asia/Shanghai','points':self.seed['points'],'missing_slots':[{'slot_id':s['id'],'scheduled_at':s['scheduled_at']} for s in self.seed['slots'] if not s['has_active_record']]}
   if self.mode in ['many-missing','rounding1','rounding5']:
    N=14 if self.mode=='many-missing' else 16;M=0 if self.mode=='many-missing' else 1 if self.mode=='rounding1' else 5
    body.update(N=N,M=M,coverage_rate=round(M/N*100,1),duplicate_slots=[],source_breakdown={'PATIENT_REPORT':M},missing_slots=[{'slot_id':f'missing-{i}','scheduled_at':f'2026-11-{2+i%7:02}T08:00:00+08:00'} for i in range(N-M)],points=[dict(day=f'2026-11-{2+i:02}',N=N if i==0 else 0,M=M if i==0 else 0,coverage_rate=round(M/N*100,1) if i==0 else None) for i in range(7)])
   if start!='2026-11-02':body.update(N=14,M=0,coverage_rate=0,duplicate_slots=[],source_breakdown={},missing_slots=[])
  elif path.endswith('/followups'):
   body={'items':[dict(f,id=f'follow-{i}',patient_id=PID) for i,f in enumerate(self.seed['followups'])], 'total':len(self.seed['followups'])}
  elif path=='/api/tasks' and q.get('patient_id'):body={'items':[dict(id='task-detail',status='OPEN')],'total':1}
  else:super().route(route);return
  route.fulfill(json=body)

def shot(page,name,full=False):old.settle(page);page.screenshot(path=str(OUT/name),full_page=full)
def add_time(page,time):
 page.get_by_role('button',name='添加时点',exact=True).click()
 field=page.get_by_role('textbox',name='添加每日时点',exact=True);field.fill(time);field.press('Enter');page.keyboard.press('Tab');page.wait_for_timeout(150)
def fonts(page,selectors):
 cdp=page.context.new_cdp_session(page);cdp.send('DOM.enable');cdp.send('CSS.enable');root=cdp.send('DOM.getDocument')['root']['nodeId'];out={}
 for sel in selectors:
  node=cdp.send('DOM.querySelector',{'nodeId':root,'selector':sel})['nodeId'];out[sel]=cdp.send('CSS.getPlatformFontsForNode',{'nodeId':node})
 cdp.detach();return out
def main():
 errors=[];results={}
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROME,headless=True)
  ctx=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1,timezone_id='America/Los_Angeles')
  ctx.add_init_script("sessionStorage.setItem('medix-demo-assets','approved-fixture-v1')")
  fixture=Fixture();ctx.route('**/api/**',fixture.route)
  page=ctx.new_page();page.on('pageerror',lambda e: errors.append(str(e)))
  page.clock.install(time=datetime(2026,11,9,13,0,tzinfo=timezone.utc))
  old.login(page)
  old.go(page,'/patients/'+PID);expect(page.locator('.ml-detail-identity h1')).to_have_text('李先生');expect(page.locator('.ml-detail-matrix tbody tr')).to_have_count(2);shot(page,'04-patient-detail.png');results['fonts_detail']=fonts(page,['.ml-detail-identity h1','.ml-detail-identity > span','.ml-detail-matrix tbody th'])
  old.go(page,'/plans?patientId='+PID);expect(page.locator('.ml-plan-history li')).to_have_count(2)
  add_time(page,'08:00');add_time(page,'20:00');page.locator('h1').click();shot(page,'05-plans.png');results['fonts_plans']=fonts(page,['.ml-plan-form label','.ml-history-meta','.ml-time-item input'])
  old.go(page,'/stats');expect(page.locator('.ml-stats-roster tbody tr')).to_have_count(5);shot(page,'06-stats.png')
  page.get_by_role('tab',name='患者报告').click();page.get_by_role('combobox',name='选择患者').click();page.locator('.ant-select-dropdown:visible').get_by_text('李先生',exact=True).click()
  expect(page.locator('.ml-duplicate-table tbody tr')).to_have_count(1);page.set_viewport_size({'width':1440,'height':1080});shot(page,'07-patient-report.png',True)
  results['geometry']=page.locator('.ml-report section').evaluate_all("es => es.map(e=>({title:e.querySelector('h2').textContent,rect:e.getBoundingClientRect().toJSON(),padding:getComputedStyle(e).padding,head:e.firstElementChild.getBoundingClientRect().toJSON(),children:[...e.children].map(c=>({class:c.className,rect:c.getBoundingClientRect().toJSON(),margin:getComputedStyle(c).margin}))}))");results['errors']=errors;results['report_summary']=page.locator('.ml-report-summary').inner_text()
  (OUT/'capture-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');print('04-07 captures, fonts and geometry saved; errors:',errors)
  browser.close()
if __name__=='__main__':main()
