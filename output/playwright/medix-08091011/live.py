import ast
from capture import *
def credential(file,account):
 tree=ast.parse(Path(file).read_text(encoding='utf-8-sig'))
 return next(ast.literal_eval(n) for n in ast.walk(tree) if isinstance(n,ast.Dict) and any(isinstance(v,ast.Constant) and v.value==account for v in n.values))
results={'mode':'real-backend-read-only','writes':'authentication login/logout only'};responses=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=CHROME,headless=True);c=b.new_context(viewport={'width':1440,'height':900});a=c.new_page()
 a.on('pageerror',lambda e:errors.append(str(e)));a.on('response',lambda r:responses.append([r.url.split('/api/')[-1],r.status]) if '/api/' in r.url else None)
 for role,cred in [('clinician',credential('backend/tests/check_overview.py','clinician_a')),('admin',credential('backend/tests/smoke_s6_regression.py','admin'))]:
  a.goto(BASE+'/login');a.get_by_label('账号',exact=True).fill(cred['account']);a.get_by_label('密码',exact=True).fill(cred['password']);a.get_by_role('button',name='登录',exact=True).click();a.wait_for_url('**/workbench' if role=='clinician' else '**/admin')
  if role=='clinician':
   old.go(a,'/followups');expect(a.locator('.ml-follow-queue tbody tr').first).to_be_visible();shot(a,'08-followups-live.png',True);a.get_by_role('button',name='快速处理',exact=True).first.click();shot(a,'09-task-close-live.png');a.get_by_role('button',name='取消',exact=True).click()
   old.go(a,'/workbench');a.get_by_role('button',name='补登用药',exact=True).first.click();a.wait_for_timeout(600);shot(a,'10-backfill-live.png');results['backfill_errors']=a.locator('.ml-action-dialog [role=alert]').all_text_contents();a.get_by_role('button',name='取消',exact=True).click()
  else:
   expect(a.locator('.ml-admin-models tbody tr').first).to_be_visible();shot(a,'11-admin-devices-live.png');results['admin_errors']=a.locator('.ml-content [role=alert]').all_text_contents()
  a.get_by_role('button',name='退出',exact=True).click();a.wait_for_url('**/login')
 results['api_statuses']=responses;results['pageerrors']=errors
 assert not errors and not results['backfill_errors'] and not results['admin_errors'];assert all(status<400 for _,status in responses)
 (OUT/'live-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');print('Real backend 08-11 read-only acceptance passed');b.close()

