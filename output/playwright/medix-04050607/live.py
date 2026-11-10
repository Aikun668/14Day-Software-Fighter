import ast,json
from pathlib import Path
from capture import *
source=ast.parse(Path('backend/tests/check_overview.py').read_text(encoding='utf-8-sig'))
credentials=next(ast.literal_eval(n) for n in ast.walk(source) if isinstance(n,ast.Dict) and any(isinstance(v,ast.Constant) and v.value=='clinician_a' for v in n.values))
result={'mode':'real-backend-read-only','writes':'auth login/logout only'};errors=[];responses=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=CHROME,headless=True);ctx=b.new_context(viewport={'width':1440,'height':900});pg=ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('response',lambda r:responses.append([r.url.split('/api/')[-1],r.status]) if '/api/' in r.url else None)
 pg.goto(BASE+'/login');pg.get_by_label('账号',exact=True).fill(credentials['account']);pg.get_by_label('密码',exact=True).fill(credentials['password']);pg.get_by_role('button',name='登录',exact=True).click();pg.wait_for_url('**/workbench');old.go(pg,'/patients');expect(pg.locator('.ml-patients-table tbody tr').first).to_be_visible()
 pg.locator('.ml-patients-table tbody tr').first.locator('.ml-identity').click();expect(pg.locator('.ml-detail-identity h1')).to_be_visible();pid=pg.url.rsplit('/',1)[1];pg.wait_for_timeout(400);shot(pg,'04-patient-detail-live.png');result['detail_errors']=pg.locator('.ml-content [role=alert]').all_text_contents()
 old.go(pg,'/plans?patientId='+pid);expect(pg.get_by_role('heading',name='新建计划',exact=True)).to_be_visible();pg.wait_for_timeout(500);shot(pg,'05-plans-live.png');result['plan_errors']=pg.locator('.ml-content [role=alert]').all_text_contents()
 old.go(pg,'/stats');expect(pg.locator('.ml-team-summary')).to_be_visible();shot(pg,'06-stats-live.png',True);result['team_errors']=pg.locator('.ml-content [role=alert]').all_text_contents()
 pg.locator('.ml-stats-roster tbody tr').first.get_by_role('button',name=re.compile('查看')).click();expect(pg.locator('.ml-report-summary')).to_contain_text('登记覆盖');pg.wait_for_timeout(300);shot(pg,'07-patient-report-live.png',True);result['report_errors']=pg.locator('.ml-content [role=alert]').all_text_contents()
 pg.get_by_role('button',name='退出',exact=True).click();pg.wait_for_url('**/login');result['uncaught_js_errors']=errors;result['api_statuses']=responses
 assert not errors and all(not result[k] for k in ['detail_errors','plan_errors','team_errors','report_errors'])
 (OUT/'live-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print('Real backend 04-07 read-only checks passed');b.close()
