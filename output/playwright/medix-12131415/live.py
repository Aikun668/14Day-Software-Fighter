import ast
from capture import *
tree=ast.parse(Path('backend/tests/smoke_s6_regression.py').read_text(encoding='utf-8-sig'))
cred=next(ast.literal_eval(n) for n in ast.walk(tree) if isinstance(n,ast.Dict) and any(isinstance(v,ast.Constant) and v.value=='admin' for v in n.values))
results={'mode':'real-backend-read-only','writes':'authentication login/logout only'};responses=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=CHROME,headless=True);c=b.new_context(viewport={'width':1440,'height':900});a=c.new_page();a.on('pageerror',lambda e:errors.append(str(e)));a.on('response',lambda r:responses.append([r.url.split('/api/')[-1],r.status]) if '/api/' in r.url else None)
 a.goto(BASE+'/login');a.get_by_label('账号',exact=True).fill(cred['account']);a.get_by_label('密码',exact=True).fill(cred['password']);a.get_by_role('button',name='登录',exact=True).click();a.wait_for_url('**/admin')
 for tab,n in [('guide','12'),('user','13'),('kb','14'),('audit','15')]:
  go(a,tab);expect(a.locator('.ml-audit-charts') if tab=='audit' else a.locator('.ml-admin tbody tr').first).to_be_visible();shot(a,n+'-live.png',True);results[n+'_errors']=a.locator('.ml-content [role=alert]').all_text_contents();assert not results[n+'_errors']
  if tab in ['guide','kb']:
   a.get_by_role('button',name=re.compile('^查看')).first.click();expect(a.get_by_role('dialog',name='查看内容')).to_be_visible();expect(a.locator('.ml-content-title')).to_be_visible();a.get_by_role('dialog').get_by_role('button',name='关闭',exact=True).last.click()
 a.get_by_role('button',name='退出',exact=True).click();a.wait_for_url('**/login');results['api_statuses']=responses;results['pageerrors']=errors;assert not errors and all(s<400 for _,s in responses)
 (OUT/'live-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');print('Real backend 12-15 read-only acceptance passed');b.close()
