from capture import *
checks=[];errors=[]
def ok(name):checks.append(name);print('PASS',name,flush=True)
def select(page,name,text):
 page.get_by_role('combobox',name=name,exact=True).click()
 if name=='随访患者':page.get_by_role('combobox',name=name,exact=True).fill(text)
 page.locator('.ant-select-dropdown:visible').get_by_text(text,exact=True).click()
def follow(page):
 old.go(page,'/workbench');old.go(page,'/followups');expect(page.locator('.ml-follow-queue tbody tr')).to_have_count(min(5,len(f.tasks)))
def cancel(page):
 page.get_by_role('dialog').get_by_role('button',name='取消',exact=True).click()
def writecheck(page):
 expect(page.get_by_role('dialog',name='处理任务')).to_be_visible()
 page.get_by_role('textbox',name='处理说明',exact=True).fill('已电话联系')
def openquick(page):
 page.get_by_role('button',name='快速处理',exact=True).first.click();writecheck(page)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=CHROME,headless=True)
 c=b.new_context(viewport={'width':1440,'height':900},timezone_id='America/Los_Angeles');c.add_init_script("sessionStorage.setItem('medix-demo-assets','approved-fixture-v1')")
 f=Fixture();c.route('**/api/**',f.route);a=c.new_page();a.on('pageerror',lambda e:errors.append(str(e)));a.clock.install(time=datetime(2026,11,9,13,tzinfo=timezone.utc));signin(a);follow(a)
 # UI, modal geometry, counter, keyboard/focus
 trigger=a.get_by_role('button',name='快速处理',exact=True).first;trigger.click();a.wait_for_timeout(550)
 r=geometry(a);assert abs(r['rect']['x']+r['rect']['width']/2-720)<1 and abs(r['rect']['y']+r['rect']['height']/2-450)<1
 assert a.locator('#task-close-note').bounding_box()['height']>=120
 assert a.locator('.ant-modal-mask').evaluate('e=>getComputedStyle(e).backdropFilter')=='none'
 a.get_by_role('button',name='确认处理').click();expect(a.get_by_text('请填写 1–200 字处理说明')).to_be_visible();assert not f.posts
 a.locator('#task-close-note').fill('甲'*201);assert len(a.locator('#task-close-note').input_value())==200
 a.keyboard.press('Escape');expect(a.get_by_role('dialog')).to_have_count(0);expect(trigger).to_be_focused();ok('09 center, multiline, mask, required/counter, Esc focus return')
 # locked single POST and no dismissal while pending
 openquick(a);a.get_by_role('checkbox',name='安排操作复训提醒').check();pending=[]
 a.route('**/api/followups',lambda r:pending.append(r) if r.request.method=='POST' else r.fallback())
 a.get_by_role('button',name='确认处理').dblclick();a.keyboard.press('Escape');expect(a.get_by_role('dialog')).to_be_visible();expect(a.get_by_role('button',name='取消',exact=True)).to_be_disabled();assert len(pending)==1
 data=pending[0].request.post_data_json;assert data['close_task'] and data['create_retraining_reminder'] and len(data['feedback'])>0
 f.route(pending[0]);a.unroute('**/api/followups');expect(a.get_by_role('dialog')).to_have_count(0);ok('09 single followup POST; pending controls locked; retraining payload')
 # A->B clean, failure and conflict preserve/reject
 follow(a);openquick(a);cancel(a);a.get_by_role('button',name='快速处理',exact=True).nth(1).click();expect(a.locator('#task-close-note')).to_have_value('');cancel(a)
 f.post_error=409;openquick(a);a.get_by_role('button',name='确认处理').click();expect(a.get_by_text('任务已关闭，请返回列表核对')).to_be_visible();expect(a.get_by_role('button',name='确认处理')).to_be_disabled();expect(a.locator('#task-close-note')).to_have_value('已电话联系');cancel(a);f.post_error=0;ok('09 clean reopen/task switch, 409 retains note and prevents another write')
 f.tasks[0]['task_type']='UNKNOWN';follow(a);a.get_by_role('button',name='快速处理',exact=True).first.click();expect(a.get_by_text('待核查任务',exact=True)).to_be_visible();cancel(a);ok('09 unknown task type uses neutral copy')
 # Unknown outcome must never claim old matching record saved this time
 f.post_error=503;openquick(a);a.get_by_role('button',name='确认处理').click();expect(a.get_by_text('结果未确认，请刷新核对')).to_be_visible()
 t=f.tasks[0];f.followups.insert(0,dict(id='old-matching',patient_id=t['patient_id'],task_id=t['id'],followed_at='2026-11-01T10:00:00+08:00',feedback='已电话联系',action_taken=None,next_plan=None))
 a.get_by_role('button',name='刷新核对',exact=True).click();expect(a.get_by_text('找到相同任务的记录，请返回列表核对处理结果')).to_be_visible();expect(a.get_by_role('dialog')).to_be_visible();expect(a.get_by_role('button',name='确认处理')).to_be_disabled();cancel(a);f.post_error=0;ok('09 uncertain result stays unconfirmed despite old matching note')
 # Full form: dirty context switches cancel then reset; association belongs to selected patient
 follow(a);a.get_by_role('button',name='填写随访',exact=True).first.click();expect(a.locator('.ml-follow-composer')).to_be_visible();a.get_by_label('反馈',exact=True).fill('甲患者的草稿')
 select(a,'随访患者','李先生');a.get_by_role('button',name='继续填写',exact=True).click();expect(a.get_by_label('反馈',exact=True)).to_have_value('甲患者的草稿')
 select(a,'随访患者','李先生');a.get_by_role('button',name='切换',exact=True).click();expect(a.get_by_label('反馈',exact=True)).to_have_value('');expect(a.get_by_role('checkbox',name='关闭关联任务')).to_be_disabled()
 a.get_by_label('反馈',exact=True).fill('李先生的随访')
 a.get_by_label('关联任务',exact=True).click();opt=a.locator('.ant-select-dropdown:visible .ant-select-item-option');expect(opt).to_have_count(1);opt.first.click();a.get_by_role('checkbox',name='关闭关联任务').check()
 a.get_by_role('button',name='保存随访',exact=True).click();expect(a.locator('.ml-follow-composer')).to_have_count(0);data=f.posts[-1][1];assert data['patient_id']==PID and next(t for t in old.TASKS if t['id']==data['task_id'])['patient_id']==PID;assert data['followed_at'].endswith('+08:00');ok('08 dirty patient switch cancel/reset, ownership guard, Shanghai payload')
 a.get_by_role('button',name='新建随访',exact=True).click();expect(a.get_by_role('combobox',name='随访患者',exact=True)).to_have_value('');expect(a.get_by_role('checkbox',name='关闭关联任务')).to_be_disabled();expect(a.get_by_label('反馈',exact=True)).to_have_value('')
 a.get_by_label('反馈',exact=True).fill('未保存');a.get_by_role('button',name='快速处理',exact=True).first.click();expect(a.get_by_role('dialog',name='放弃未保存的随访？')).to_be_visible();a.get_by_role('button',name='继续填写',exact=True).click();expect(a.locator('.ml-follow-composer')).to_be_visible()
 a.get_by_role('button',name='快速处理',exact=True).first.click();a.get_by_role('button',name='放弃',exact=True).click();expect(a.locator('.ml-follow-composer')).to_have_count(0);cancel(a);ok('08 new form is empty; dirty full form and quick modal are mutually exclusive')
 # Independent load errors
 f.fail={'/followups'};follow(a);expect(a.locator('.ml-follow-records').get_by_role('alert')).to_be_visible();expect(a.locator('.ml-follow-queue tbody tr')).to_have_count(5);f.fail=set();a.locator('.ml-follow-records').get_by_role('button',name='重试').click();expect(a.locator('.ml-follow-records tbody tr')).not_to_have_count(0);ok('08 record errors are distinct and do not blank tasks')
 # More than a server page. Local 5->10 must not request again.
 original=f.tasks[:];f.tasks=[dict(original[i%len(original)],id='many-'+str(i)) for i in range(62)];follow(a);n=len(f.reads)
 a.locator('.ml-follow-queue').get_by_role('button',name='查看更多 · 共 62 条').click();expect(a.locator('.ml-follow-queue tbody tr')).to_have_count(10);assert len(f.reads)==n
 for _ in range(9):a.locator('.ml-follow-queue').get_by_role('button',name='查看更多 · 共 62 条').click()
 expect(a.locator('.ml-follow-queue tbody tr')).to_have_count(55);assert any(path=='/api/tasks' and q.get('page')==['2'] for _,path,q in f.reads)
 f.tasks=original;ok('08 cached five-row expansion crosses server page 50 with real total')
 # mobile actions visible and long CJK text accessible
 f.followups=[dict(f.followups[-1],action_taken='一二三四五六七八九十一二三四五六七八九十')];follow(a);a.set_viewport_size({'width':390,'height':844});a.wait_for_timeout(350)
 for btn in a.locator('.ml-follow-queue tbody tr').first.get_by_role('button').all():
  r=btn.bounding_box();assert r['x']>=0 and r['x']+r['width']<=390 and r['height']>=44
 expect(a.locator('.ml-follow-records').get_by_role('button',name='展开')).to_be_visible();a.locator('.ml-follow-records').get_by_role('button',name='展开').click();expect(a.locator('.ml-follow-records .is-teal')).to_have_text('一二三四五六七八九十一二三四五六七八九十');ok('08 mobile action buttons are visible; 20-char clipped content expands')
 a.set_viewport_size({'width':1440,'height':900})
 # Backfill reads history, Shanghai default seven dates, fixed plan_id from slot
 open_backfill(a);reads=[q for _,path,q in f.reads if path.endswith('/daily-slots')];assert reads[-1]['from']==['2026-11-03'] and reads[-1]['to']==['2026-11-10']
 expect(a.locator('#backfill-time')).to_have_value('2026-11-07 08:00');a.locator('#backfill-note').fill('  补充备注  ')
 a.get_by_role('button',name='确认补登',exact=True).click();expect(a.get_by_role('dialog')).to_have_count(0);data=f.posts[-1][1];assert data['plan_id']=='plan-A' and data['slot_id']=='slot-0' and data['occurred_at']=='2026-11-07T08:00:00+08:00' and data['note']=='补充备注';assert any(path.endswith('/medication-plans') and q.get('include_history')==['true'] for _,path,q in f.reads);ok('10 historical plan query, 7 Shanghai dates, actual-time payload and trimmed note')
 f.slots[0]['has_active_record']=False;f.plans.append(dict(f.plans[0],id='old-plan'));f.slots_override=[dict(f.slots[0],id='registered',has_active_record=True),dict(f.slots[0],id='future',scheduled_at='2026-11-10T08:00:00+08:00'),dict(f.slots[0],id='cancelled',state='CANCELLED'),dict(f.slots[0],id='historical',plan_id='old-plan',patient_id=f.tasks[0]['patient_id'])]
 old.go(a,'/workbench');a.get_by_role('button',name='补登用药',exact=True).first.click();expect(a.get_by_role('radio')).to_have_count(4)
 for i in range(3):expect(a.get_by_role('radio').nth(i)).to_be_disabled()
 a.get_by_role('radio').nth(3).check();f.duplicate=True;a.get_by_role('button',name='确认补登',exact=True).click();expect(a.get_by_text('已保存，该时点已有登记')).to_be_visible();assert f.posts[-1][1]['plan_id']=='old-plan';f.duplicate=False;f.slots_override=None;ok('10 registered/future/cancelled disabled; historical slot owns plan; duplicate response')
 f.fail={'/daily-slots'};a.get_by_role('button',name='补登用药',exact=True).first.click();expect(a.get_by_text('时点加载失败：演示服务暂不可用')).to_be_visible();expect(a.get_by_role('button',name='确认补登')).to_be_disabled();f.fail=set();a.get_by_role('button',name='重试',exact=True).click();expect(a.get_by_role('radio')).to_have_count(3);cancel(a);ok('10 failed slots are not empty, retry loads data')
 # PRN historical versions and validity checks; no implicit Enter POST
 f.plans_override=[dict(f.plans[0],id='prn-'+str(i),plan_type='PRN',version=i+1,starts_at='2026-10-01T00:00:00+08:00',ends_at='2026-11-08T00:00:00+08:00') for i in range(101)];f.slots_override=[]
 a.get_by_role('button',name='补登用药',exact=True).first.click();expect(a.get_by_label('按需计划',exact=True)).to_be_visible();assert any(path.endswith('/medication-plans') and q.get('page')==['2'] for _,path,q in f.reads)
 select(a,'按需计划','示例药物（DEMO） · v1')
 field=a.locator('#backfill-time');field.fill('2026-11-09 08:00');field.press('Enter');field.press('Tab');before=len(f.posts);a.get_by_role('button',name='确认补登').click();expect(a.get_by_text('请选择在该用药时间生效的按需计划')).to_be_visible();assert len(f.posts)==before
 field.fill('2026-11-07 08:10');field.press('Enter');field.press('Tab');a.get_by_role('button',name='确认补登').click();expect(a.get_by_role('dialog')).to_have_count(0);assert f.posts[-1][1]['slot_id'] is None;ok('10 PRN historical pagination >100, effective interval validation, null slot')
 # Nonadmin cannot read admin model data
 old.go(a,'/admin?tab=model');expect(a.get_by_text('无权访问',exact=True)).to_be_visible();assert not any(path=='/api/admin/device-models' for _,path,q in f.reads);ok('11 nonadmin gated before admin read')
 c.close()
 # Admin server pagination, creation, failure retention and navigation
 c=b.new_context(viewport={'width':1440,'height':900});f=Fixture();f.role='ADMIN';f.models=[dict(f.models[i%3],id='m'+str(i)) for i in range(43)];c.route('**/api/**',f.route);a=c.new_page();signin(a,True);expect(a.locator('.ml-admin-models tbody tr')).to_have_count(20)
 a.locator('.ant-pagination-item-3').click();expect(a.locator('.ml-admin-models tbody tr')).to_have_count(3);assert any(path=='/api/admin/device-models' and q.get('page')==['3'] for _,path,q in f.reads);ok('11 server pagination reaches last model, independent API')
 a.get_by_role('button',name='新建型号',exact=True).click();select(a,'类别','SMI');a.get_by_label('品牌',exact=True).fill('  示例品牌  ');a.get_by_label('型号',exact=True).fill('  Respimat 新型号  ');a.get_by_label('厂商',exact=True).fill('   ')
 f.post_error=422;a.get_by_role('button',name='创建型号',exact=True).click();expect(a.get_by_text('模拟保存失败',exact=True)).to_be_visible();expect(a.get_by_label('型号',exact=True)).to_have_value('  Respimat 新型号  ');f.post_error=0
 a.get_by_role('button',name='创建型号',exact=True).click();expect(a.get_by_role('dialog')).to_have_count(0);data=f.posts[-1][1];assert data==dict(category='SMI',brand='示例品牌',model_name='Respimat 新型号',manufacturer=None);expect(a.locator('.ml-admin-models tbody tr')).to_have_count(4);ok('11 create trims/validates; failure retains input; last-page refresh shows real new entry')
 for label,tab in [('指导版本','guide'),('账号管理','user'),('知识内容','kb'),('审计日志','audit')]:
  old.go(a,'/admin?tab=model');a.get_by_role('link',name=label,exact=True).click();assert 'tab='+tab in a.url;expect(a.get_by_role('tab',selected=True)).to_be_visible()
 ok('11 all four remaining admin entries navigate to their existing tabs')
 assert not errors,errors
 (OUT/'interaction-checks.json').write_text(json.dumps({'passed':checks,'pageerrors':errors},ensure_ascii=False,indent=2),encoding='utf-8');b.close()

