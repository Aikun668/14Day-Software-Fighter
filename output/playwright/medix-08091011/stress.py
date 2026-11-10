from capture import *
checks=[];errors=[]
def ok(s):checks.append(s);print('PASS',s,flush=True)
def chooser(a,label,name):
 x=a.get_by_role('combobox',name=label,exact=True);x.click();x.fill(name);a.locator('.ant-select-dropdown:visible').get_by_text(name,exact=True).click()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=CHROME,headless=True);c=b.new_context(viewport={'width':1440,'height':900},timezone_id='America/Los_Angeles');f=Fixture();c.route('**/api/**',f.route);a=c.new_page();a.on('pageerror',lambda e:errors.append(str(e)));a.clock.install(time=datetime(2026,11,9,13,tzinfo=timezone.utc));signin(a)
 # 08 unknown full-form outcome: verification blocks both new and quick contexts
 old.go(a,'/followups');a.get_by_role('button',name='填写随访',exact=True).first.click();a.get_by_label('反馈',exact=True).fill('结果核对');f.post_error=503;a.get_by_role('button',name='保存随访',exact=True).click();expect(a.get_by_text('结果未确认，请刷新核对')).to_be_visible()
 pending=[];a.route('**/api/patients/*/followups*',lambda r:pending.append(r));a.get_by_role('button',name='刷新核对',exact=True).click();expect(a.get_by_role('button',name='新建随访',exact=True)).to_be_disabled();expect(a.get_by_role('button',name='快速处理',exact=True).first).to_be_disabled();expect(a.get_by_role('combobox',name='随访患者',exact=True)).to_be_disabled()
 assert len(pending)==1;f.route(pending[0]);a.unroute('**/api/patients/*/followups*');expect(a.get_by_text('未找到本次记录，请核对列表后再新建')).to_be_visible();ok('08 verification locks page/context controls, unknown result stays blocked')
 old.go(a,'/workbench');f.post_error=0
 # 10 mismatched slot identity or missing historical plan never POSTs
 for field,val in [('patient_id','other-patient'),('plan_id','missing-plan')]:
  f.slots_override=[dict(f.slots[0],patient_id=f.tasks[0]['patient_id'],**({field:val} if field!='patient_id' else {}))]
  if field=='patient_id':f.slots_override[0]['patient_id']=val
  a.get_by_role('button',name='补登用药',exact=True).first.click();a.get_by_role('radio').first.check();n=len(f.posts);a.get_by_role('button',name='确认补登').click();expect(a.get_by_text('时点与患者或计划不匹配，请刷新后重新选择')).to_be_visible();assert len(f.posts)==n;expect(a.get_by_role('radio').first).to_be_focused();a.get_by_role('button',name='取消',exact=True).click()
 ok('10 mismatched patient/missing history plan blocked and selection field focused')
 f.slots_override=None;a.get_by_role('button',name='补登用药',exact=True).first.click();a.get_by_role('radio').first.check();a.locator('#backfill-time').fill('2026-11-10 08:00');a.locator('#backfill-time').press('Enter');a.locator('#backfill-time').press('Tab');n=len(f.posts);a.get_by_role('button',name='确认补登').click();expect(a.get_by_text('实际用药时间不能晚于当前时间')).to_be_visible();assert len(f.posts)==n;expect(a.locator('#backfill-time')).to_be_focused();a.get_by_role('button',name='取消',exact=True).click();ok('10 future actual time blocked with field focus')
 # Unknown backfill and another existing record do not prove this write succeeded
 a.get_by_role('button',name='补登用药',exact=True).first.click();a.get_by_role('radio').first.check();a.locator('#backfill-note').fill('本次备注');f.post_error=503;a.get_by_role('button',name='确认补登').click();expect(a.get_by_text('结果未确认，请刷新核对')).to_be_visible();f.events=[dict(id='other-event',status='ACTIVE',slot_id='slot-0',plan_id='plan-A',occurred_at='2026-11-07T09:00:00+08:00',note='其他人的记录')];a.get_by_role('button',name='刷新核对').click();expect(a.get_by_text('找到该时点或计划的登记，请返回页面核对结果')).to_be_visible();expect(a.get_by_role('button',name='确认补登')).to_be_disabled();expect(a.get_by_role('dialog')).to_be_visible();shot(a,'10-unknown-result.png');a.get_by_role('button',name='取消',exact=True).click();f.post_error=0;ok('10 someone else registered slot: no false success or repeat POST')
 # All fixed-slot radios inherit write lock (each explicit disabled must include busy).
 a.get_by_role('button',name='补登用药',exact=True).first.click();a.get_by_role('radio').first.check();pending=[];a.route('**/api/medication-events',lambda r:pending.append(r));a.get_by_role('button',name='确认补登').click()
 for radio in a.get_by_role('radio').all():expect(radio).to_be_disabled()
 expect(a.get_by_role('radio').first).to_be_checked();pending[0].fulfill(status=503,json={'message':'结果不确定'});a.unroute('**/api/medication-events');expect(a.get_by_text('结果未确认，请刷新核对')).to_be_visible()
 for radio in a.get_by_role('radio').all():expect(radio).to_be_disabled()
 expect(a.get_by_role('radio').first).to_be_checked();shot(a,'10-locked-slots.png');a.get_by_role('button',name='取消',exact=True).click();ok('10 each radio disabled while POST pending and outcome unknown; selection preserved')
 # Patient detail entry uses same dialog and real patient metadata
 old.go(a,'/patients/'+PID);expect(a.locator('.ml-detail-identity h1')).to_be_visible();a.locator('.ml-detail-todos').get_by_role('button',name='补登用药').click();expect(a.locator('.ml-dialog-person')).to_contain_text('李先生');a.get_by_role('radio').first.check();a.get_by_role('button',name='确认补登').click();expect(a.get_by_role('dialog')).to_have_count(0);assert f.posts[-1][1]['patient_id']==PID;ok('10 patient-detail entry uses same functioning dialog as workbench')
 # Directory >100 and history >50
 extra=[dict(f.patients[0],id='extra-'+str(i),display_name='扩展患者'+str(i)) for i in range(105)];f.patients+=extra
 f.followups=[dict(f.followups[0],id='record-'+str(i)) for i in range(62)];old.go(a,'/followups');expect(a.locator('.ml-follow-records tbody tr')).to_have_count(5)
 for _ in range(10):a.locator('.ml-follow-records').get_by_role('button',name='查看更多 · 共 62 条').click()
 expect(a.locator('.ml-follow-records tbody tr')).to_have_count(55);assert any(path=='/api/patients' and q.get('page')==['2'] for _,path,q in f.requests)
 chooser(a,'筛选随访患者','扩展患者104');expect(a.locator('.ml-follow-records').get_by_text('暂无随访记录')).to_be_visible();ok('08 patient directory >100 and followup history >50 are reachable')
 # Slow A / fast B response isolation
 old.go(a,'/workbench');old.go(a,'/followups');f.followups=[dict(f.followups[0],id='record-B',patient_id=f.patients[1]['id'],feedback='B专属记录')]
 pending=[];a.route('**/api/patients/'+PID+'/followups*',lambda r:pending.append(r));chooser(a,'筛选随访患者','李先生');chooser(a,'筛选随访患者','周先生');expect(a.locator('.ml-follow-records')).to_contain_text('B专属记录');assert len(pending)==1;pending[0].fulfill(json={'items':[],'total':0});a.unroute('**/api/patients/'+PID+'/followups*');a.wait_for_timeout(200);expect(a.locator('.ml-follow-records')).to_contain_text('B专属记录');ok('08 slow old patient response cannot replace new patient history')
 # Narrow viewport short height still allows footer and title
 a.set_viewport_size({'width':390,'height':600});a.get_by_role('button',name='快速处理',exact=True).first.click();a.wait_for_timeout(550);r=geometry(a);assert abs(r['rect']['y']+r['rect']['height']/2-300)<1
 for name in ['取消','确认处理']:
  r=a.get_by_role('button',name=name,exact=True).bounding_box();assert r['y']>=0 and r['y']+r['height']<=600
 shot(a,'09-short-mobile.png');a.get_by_role('button',name='取消',exact=True).click();ok('09 short mobile viewport keeps centered dialog and reachable buttons')
 # No synthetic portraits for ordinary patient records without a real photo.
 f.patients=[dict(x,diagnosis_label='普通诊断') for x in f.patients];old.go(a,'/workbench');old.go(a,'/followups');expect(a.locator('.ml-follow-queue .ml-avatar-demo')).to_have_count(0);shot(a,'08-neutral-avatars.png',True);ok('08 ordinary patient without photo uses neutral avatar')
 a.set_viewport_size({'width':1280,'height':900});old.go(a,'/followups');shot(a,'08-1280.png',True);a.get_by_role('button',name='快速处理',exact=True).first.click();shot(a,'09-1280.png');a.get_by_role('button',name='取消',exact=True).click()
 assert not errors,errors
 (OUT/'stress-checks.json').write_text(json.dumps({'passed':checks,'pageerrors':errors},ensure_ascii=False,indent=2),encoding='utf-8');b.close()

