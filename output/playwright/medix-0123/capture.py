"""Real browser captures of the product, with isolated synthetic API responses.
No clinical database writes. Run from repository root: python output/playwright/medix-0123/capture.py
"""
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).resolve().parent
BASE = 'http://localhost:5180'
CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
codes = ['004', '006', '002', '007', '009', '001', '005', '008', '003', '014']
names = ['李先生', '周先生', '陈先生', '吴女士', '孙女士', '林女士', '赵女士', '郑先生', '王女士', '杨先生']
PATIENTS = [dict(id=f'00000000-0000-4000-8000-{i+1:012}', patient_code='P-'+code, display_name=name,
    diagnosis_label=('慢性阻塞性肺疾病' if code in ['004','006','002','008','014'] else '支气管哮喘')+'（DEMO）',
    account_user_id='demo-account' if code in ['002','001'] else None, assigned_clinician_id='clinician') for i,(code,name) in enumerate(zip(codes,names))]
order = ['014','003','008','004','001','005','006']
TASKS = [dict(id=f'task-{i}', patient_id=next(p['id'] for p in PATIENTS if p['patient_code']=='P-'+c), task_type='MISSED_DOSE', status='OPEN') for i,c in enumerate(order)]

class Fixture:
    def __init__(self):
        self.patients = [dict(p) for p in PATIENTS]
        self.tasks = [dict(t) for t in TASKS]
        self.watch_count = 1
        self.stats_fail = False
        self.empty_due = False
        self.fail_patients = False
        self.fail_login = False
        self.role = 'CLINICIAN'
        self.change_password = False
        self.posts = []
        self.requests = []

    def route(self, route):
        req = route.request
        u = urlparse(req.url)
        q = parse_qs(u.query)
        path = u.path
        if not path.startswith('/api/'):
            route.continue_(); return
        self.requests.append([req.method,path,q])
        body = {}; status = 200
        if req.method == 'POST':
            data = req.post_data_json or {}
            if path == '/api/auth/login':
                if self.fail_login:
                    status=401; body={'detail':{'message':'账号或密码错误'}}
                else: body={'access_token':'isolated-fixture-token','user':{'id':'fixture-clinician','account':'clinician_a','role':self.role,'status':'ACTIVE','must_change_password':self.change_password}}
            elif path == '/api/auth/logout': body={}
            else:
                self.posts.append([path, data])
                if path == '/api/patients':
                    new={**self.patients[0],**data,'id':'new-patient'}
                    self.patients.insert(0,new); body=new
                elif path == '/api/followups':
                    self.tasks=[t for t in self.tasks if t['id'] != data.get('task_id')]; body={'id':'followup'}
                else: body={'id':'created','is_duplicate':False}
        elif path == '/api/patients/filter-options': body={'diagnosis_labels':['慢性阻塞性肺疾病（DEMO）','支气管哮喘（DEMO）']}
        elif path == '/api/patients':
            if self.fail_patients: status=503; body={'message':'患者服务暂不可用'}
            else:
                items=self.patients
                if q.get('search'): items=[p for p in items if q['search'][0] in p['display_name']+' '+p['patient_code']]
                if q.get('diagnosis_label'): items=[p for p in items if p['diagnosis_label'] in q['diagnosis_label']]
                if q.get('account_status'): items=[p for p in items if bool(p['account_user_id']) == (q['account_status'][0]=='bound')]
                size=int(q.get('page_size',['20'])[0]); page=int(q.get('page',['1'])[0])
                body={'items':items[(page-1)*size:page*size],'total':len(items)}
        elif path == '/api/tasks': body={'items':self.tasks[:int(q.get('page_size',['20'])[0])],'total':len(self.tasks)}
        elif path == '/api/stats/overview':
            body={'rows':[dict(patient_id=p['id'],patient_code=p['patient_code'],display_name=p['display_name'],N=8,M=0,coverage_rate=0,missing_count=8) for p in self.patients[:self.watch_count]]}
            if self.stats_fail: status=503; body={'message':'统计暂不可用'}
        elif path == '/api/stats/matrix':
            start=datetime.fromisoformat(q['from'][0]); end=datetime.fromisoformat(q['to'][0])
            days=[(start+timedelta(days=i)).strftime('%Y-%m-%d') for i in range((end-start).days)]
            values=[(4,4),(4,2),(4,0),(0,0),(4,4),(4,2),(0,0)]
            body={'days':days,'rows':[{'patient_id':self.patients[0]['id'],'cells':[dict(day=d,N=0 if self.empty_due else values[i%7][0],M=0 if self.empty_due else values[i%7][1]) for i,d in enumerate(days)]}]}
            if self.stats_fail: status=503; body={'message':'统计暂不可用'}
        elif path == '/api/device-models': body={'items':[{'id':'model-A','model_name':'吸入气雾剂 pMDI'},{'id':'model-B','model_name':'无指导型号'}]}
        elif path == '/api/device-models/model-A/guide': body={'id':'guide-C','title':'标准操作指导','steps':[{'id':'step-1','step_no':1,'text':'呼气'}]}
        elif path == '/api/device-models/model-B/guide': status=404; body={'message':'暂无已发布指导'}
        elif path.endswith('/medication-plans'): body={'items':[{'id':'plan-A','plan_type':'REGULAR','drug_label':'演示用药','version':1}],'total':1}
        elif path.endswith('/daily-slots'):
            day=datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d')
            body={'items':[{'id':'slot-A','patient_id':PATIENTS[9]['id'],'plan_id':'plan-A','scheduled_at':day+'T08:00:00+08:00','state':'DUE','has_active_record':False}]}
        else: body={'items':[],'total':0}
        route.fulfill(status=status,content_type='application/json',body=json.dumps(body,ensure_ascii=False))

def go(page, path):
    page.evaluate("p => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')) }",path)
    page.wait_for_timeout(350)

def settle(page):
    page.evaluate("async () => { await document.fonts.ready; await Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))) }")
    page.mouse.move(1439,899)
    page.wait_for_timeout(200)

def shot(page, name, full=False):
    settle(page); page.screenshot(path=str(OUT/name),full_page=full)

def login(page):
    page.goto(BASE+'/login'); page.get_by_label('账号',exact=True).fill('fixture-clinician')
    page.get_by_label('密码',exact=True).fill('fixture-only')
    page.get_by_role('button',name='登录',exact=True).click()
    page.wait_for_url('**/workbench'); expect(page.locator('.ml-task-table tbody tr')).to_have_count(7)

def main():
    results={}; errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=CHROME,headless=True)
        ctx=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
        ctx.add_init_script("sessionStorage.setItem('medix-demo-assets','approved-fixture-v1')")
        fixture=Fixture(); ctx.route('**/api/**',fixture.route)
        page=ctx.new_page(); page.on('pageerror',lambda e: errors.append(str(e)))
        page.goto(BASE+'/login'); expect(page.locator('.ml-login-card')).to_be_visible()
        shot(page,'01-login.png')
        page.get_by_role('button',name='登录',exact=True).click()
        expect(page.get_by_text('请输入账号',exact=True)).to_be_visible(); shot(page,'01-required.png')
        fixture.fail_login=True
        page.get_by_label('账号',exact=True).fill('fixture-clinician'); page.get_by_label('密码',exact=True).fill('fixture-only')
        page.get_by_role('button',name='登录',exact=True).click(); expect(page.get_by_role('alert').filter(has_text='账号或密码错误')).to_be_visible()
        shot(page,'01-invalid.png'); results['login_required_and_error']=True
        fixture.fail_login=False; page.get_by_role('button',name='登录',exact=True).click()
        page.wait_for_url('**/workbench'); expect(page.locator('.ml-task-table tbody tr')).to_have_count(7)
        shot(page,'02-workbench.png')
        page.get_by_role('link',name='患者管理',exact=True).click(); expect(page.locator('.ml-patients-table tbody tr')).to_have_count(10)
        shot(page,'03-patients.png')
        results['geometry']=page.evaluate("() => Object.fromEntries(['.ml-sidebar','.ml-topbar','.ml-surface','.ml-avatar','.ml-table th','.ml-table td','.ml-nav a'].map(s=>{let e=document.querySelector(s),r=e.getBoundingClientRect(),c=getComputedStyle(e);return [s,{x:r.x,y:r.y,w:r.width,h:r.height,font:c.fontSize}]}))")
        search=page.get_by_role('textbox',name='搜索姓名或编号',exact=True)
        search.fill('P-004'); search.press('Enter'); expect(page.locator('.ml-patients-table tbody tr')).to_have_count(1)
        page.get_by_role('button',name='清除筛选').click(); expect(page.locator('.ml-patients-table tbody tr')).to_have_count(10)
        results['server_search_and_clear']=True
        for size in [{'width':1280,'height':800},{'width':390,'height':844}]:
            page.set_viewport_size(size); shot(page,f"03-patients-{size['width']}.png")
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'page horizontal overflow'
            if size['width']==390:
                page.get_by_role('button',name='打开导航').click(); expect(page.get_by_role('dialog')).to_be_visible(); shot(page,'00-mobile-navigation.png'); page.keyboard.press('Escape')
            go(page,'/workbench'); shot(page,f"02-workbench-{size['width']}.png")
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'workbench horizontal overflow'
            go(page,'/patients')
        results['responsive_1280_and_390']=True
        page.set_viewport_size({'width':1440,'height':900})
        page.get_by_role('button',name='为李先生现场评估',exact=True).click(); expect(page.get_by_role('dialog')).to_be_visible()
        shot(page,'03-evaluation.png')
        page.keyboard.press('Escape')
        page.get_by_role('button',name='新建患者',exact=True).click(); shot(page,'03-create.png'); page.keyboard.press('Escape')
        fixture.watch_count=3
        fixture.tasks.append({**fixture.tasks[0],'id':'task-duplicate'})
        go(page,'/workbench'); shot(page,'02-stress.png')
        page.get_by_role('button',name='展开其余 1 条').click(); expect(page.locator('.ml-task-table tbody tr')).to_have_count(8)
        results['duplicate_patient_tasks_preserved']=True
        fixture.stats_fail=True; page.get_by_role('button',name='刷新',exact=True).click(); expect(page.get_by_text('登记统计暂不可用')).to_be_visible(); shot(page,'02-stats-failure.png')
        fixture.stats_fail=False; fixture.empty_due=True; page.get_by_role('button',name='刷新',exact=True).click(); expect(page.locator('.ml-cell-none.ml-scale-cell')).to_have_count(7); shot(page,'02-no-due.png')
        results['partial_failure_and_no_due']=True
        page.get_by_role('button',name='处理任务',exact=True).first.click(); expect(page.get_by_role('dialog')).to_be_visible(); shot(page,'02-close-task.png'); page.keyboard.press('Escape')
        page.get_by_role('button',name='补登用药',exact=True).first.click(); expect(page.get_by_role('dialog')).to_be_visible(); shot(page,'02-backfill.png'); page.keyboard.press('Escape')
        results['task_modals_reachable']=True
        # Explicitly turn portraits off and verify neutral production fallback.
        page.evaluate("sessionStorage.removeItem('medix-demo-assets')")
        fixture.patients=[{**p, 'diagnosis_label':p['diagnosis_label'].replace('（DEMO）','')} for p in fixture.patients]
        go(page,'/patients'); expect(page.locator('.ml-avatar-demo')).to_have_count(0); shot(page,'03-no-demo-portraits.png')
        page.goto(BASE+'/login'); page.set_viewport_size({'width':390,'height':844}); shot(page,'01-login-390.png')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        results['uncaught_js_errors']=errors
        (OUT/'checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(results,ensure_ascii=False,indent=2))
        browser.close()

if __name__=='__main__': main()
