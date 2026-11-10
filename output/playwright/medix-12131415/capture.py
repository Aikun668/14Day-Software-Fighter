import json,re,importlib.util
from pathlib import Path
from datetime import datetime,timezone,timedelta
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('batch08',Path('output/playwright/medix-08091011/capture.py').resolve());prev=importlib.util.module_from_spec(spec);spec.loader.exec_module(prev)
old=prev.old;CHROME=prev.CHROME;BASE=prev.BASE;OUT=Path(__file__).resolve().parent
class Fixture(prev.Fixture):
 def __init__(self):
  super().__init__();self.role='ADMIN';self.mode='normal';self.api_reads=[];self.writes=[];self.post_error=0
  self.users=[dict(id='fixture-user' if name=='admin' else 'user-'+str(i),account=name,role=role,status='ACTIVE',must_change_password=False) for i,(name,role) in enumerate([('admin','ADMIN'),('clinician_b','CLINICIAN'),('patient_x','PATIENT'),('patient_y','PATIENT'),('clinician_a','CLINICIAN')])]
  self.guides=[dict(id='guide-'+str(i),device_model_id='model-'+str(i%3),version='1.0' if i<3 else '1.1-demo',title=['pMDI 操作指导','DPI 操作指导','SMI 操作指导','万托林吸入气雾剂操作指导'][i],review_status='PUBLISHED' if i<3 else 'DRAFT',source_title=None,source_url=None,reviewed_at=None,published_at=None,steps=[dict(id='step-'+str(j),step_no=j+1,text='示例操作步骤'+str(j+1),error_notes='完整错误提示' if j==2 else None,image_path=None) for j in range(3)]) for i in range(4)]
  self.docs=[dict(id='doc-'+str(i),device_model_id='model-'+str(i),version='1.0',title='使用要点知识库',review_status='PUBLISHED',source_url='https://example.org/guide' if i==0 else None,reviewed_at=None,published_at=None,chunks=[dict(id='chunk-'+str(j),chunk_no=j+1,text='示例知识段落'+str(j+1)) for j in range(4-i)]) for i in range(3)]
  self.audits=[];actions=['GUIDE_REVIEW','KNOWLEDGE_PUBLISH','DEVICE_MODEL_CREATE','GUIDE_CREATE']+['GUIDE_REVIEW']*11+['KNOWLEDGE_PUBLISH']*7+['DEVICE_MODEL_CREATE']*3+['GUIDE_CREATE']*17
  for day,count in zip(range(2,9),[4,6,3,8,5,7,9]):
   for i in range(count):self.audits.append(dict(id='audit-'+str(len(self.audits)),actor_id='fixture-user',action='',resource_type='device_guide',resource_id='resource-'+str(i),detail={'version':'1.0'},created_at=f'2026-11-{day:02}T{10+i:02}:18:00+08:00'))
  self.audits.sort(key=lambda x:x['created_at'],reverse=True)
  for a,action in zip(self.audits,actions):a['action']=action
 def route(self,r):
  req=r.request;path=urlparse(req.url).path;q=parse_qs(urlparse(req.url).query)
  if not path.startswith('/api/'):r.continue_();return
  if any(path.endswith(x) for x in self.fail):r.fulfill(status=503,json={'message':'演示读取失败'});return
  def paged(items):
   page=int(q.get('page',['1'])[0]);size=int(q.get('page_size',['20'])[0]);return {'items':items[(page-1)*size:page*size],'total':len(items)}
  if req.method in ['POST','PATCH'] and any(path.startswith('/api/admin/'+v) for v in ['users','device-guides','knowledge-documents']):
   data=req.post_data_json if req.post_data else {};self.writes.append([req.method,path,data])
   if self.post_error:r.fulfill(status=self.post_error,json={'detail':{'code':'CONFLICT','message':'模拟写入失败'}});return
   if path=='/api/admin/users':
    row=dict(id='new-user',account=data['account'],role=data['role'],status='ACTIVE',must_change_password=True);self.users.append(row);body=dict(row,temporary_password=None if data.get('initial_password') else 'Fixture-Only-Temp-Secret')
   elif path.startswith('/api/admin/users/'):
    body=next(u for u in self.users if u['id']==path.split('/')[-1]);body.update(data)
   else:
    guide='device-guides' in path;items=self.guides if guide else self.docs;parent='/api/admin/'+('device-guides' if guide else 'knowledge-documents')
    if path==parent:
     if guide:body=dict(data,id='new-guide',review_status='DRAFT',source_title=None,source_url=None,steps=[dict(s,id='new-step-'+str(i),error_notes=None,image_path=None) for i,s in enumerate(data['steps'])])
     else:body=dict(data,id='new-doc',review_status='DRAFT',chunks=[dict(id='new-chunk-'+str(i),chunk_no=i+1,text=t.strip()) for i,t in enumerate(data['text'].split('\n\n')) if t.strip()])
     items.insert(0,body)
    else:
     rid=path.split('/')[4];body=next(x for x in items if x['id']==rid);body['review_status']='PUBLISHED' if path.endswith('/publish') else 'REVIEWED'
   r.fulfill(status=201 if req.method=='POST' else 200,json=body);return
  if req.method=='GET':
   self.api_reads.append([path,q])
   if path=='/api/admin/users':body=paged(self.users)
   elif path=='/api/admin/device-guides':body=paged(self.guides)
   elif path=='/api/admin/knowledge-documents':body=paged(self.docs)
   elif path.startswith('/api/admin/knowledge-documents/'):
    body=next((d for d in self.docs if d['id']==path.split('/')[-1]),None)
    if body is None:r.fulfill(status=404,json={'message':'记录不存在'});return
   elif path=='/api/admin/audit-logs':
    n=int(q.get('page',['1'])[0])
    if self.mode=='audit-middle-fail' and n==2:r.fulfill(status=500,json={'message':'分页失败'});return
    body=paged(self.audits)
    if self.mode=='audit-unstable':body['total']=len(self.audits)+(len([x for x in self.api_reads if x[0]==path]) % 2)
   else:super().route(r);return
   r.fulfill(json=body);return
  super().route(r)
def signin(a):
 a.goto(BASE+'/login');a.get_by_label('账号',exact=True).fill('fixture');a.get_by_label('密码',exact=True).fill('fixture');a.get_by_role('button',name='登录',exact=True).click();a.wait_for_url('**/admin')
def go(a,tab):old.go(a,'/admin?tab='+tab)
def shot(a,name,full=False):
 old.settle(a);a.wait_for_timeout(550);a.screenshot(path=str(OUT/name),full_page=full)
def main():
 errors=[];results={}
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=CHROME,headless=True);c=b.new_context(viewport={'width':1440,'height':900},timezone_id='America/Los_Angeles');c.add_init_script("sessionStorage.setItem('medix-demo-assets','approved-fixture-v1')");f=Fixture();c.route('**/api/**',f.route);a=c.new_page();a.on('pageerror',lambda e:errors.append(str(e)));a.clock.set_fixed_time(datetime(2026,11,9,13,tzinfo=timezone.utc));signin(a)
  for tab,name in [('guide','12-admin-guides'),('user','13-admin-accounts'),('kb','14-admin-knowledge'),('audit','15-admin-audit')]:
   go(a,tab)
   expect(a.locator('.ml-audit-charts') if tab=='audit' else a.locator('.ml-admin tbody tr').first).to_be_visible();shot(a,name+'.png')
   if tab=='audit':results['audit_total']=a.locator('.ml-audit-chart-heading').first.inner_text()
   a.set_viewport_size({'width':1280,'height':900});shot(a,name[:2]+'-1280.png',True)
   a.set_viewport_size({'width':390,'height':844});shot(a,name[:2]+'-mobile.png',True);results[name+'_document_width']=a.evaluate('document.documentElement.scrollWidth');a.set_viewport_size({'width':1440,'height':900})
  results['pageerrors']=errors;(OUT/'capture-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(results,ensure_ascii=False));b.close()
if __name__=='__main__':main()



