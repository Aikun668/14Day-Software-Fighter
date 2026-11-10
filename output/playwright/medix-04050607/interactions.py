import json,sys
from pathlib import Path
from datetime import datetime,timezone
sys.path.insert(0,str(Path('output/playwright/medix-04050607').resolve()))
from capture import *

def select(page,label,text):
 page.get_by_label(label,exact=True).click();page.locator('.ant-select-dropdown:visible').get_by_text(text,exact=True).click()
def report(page):
 old.go(page,'/plans');old.go(page,'/stats');expect(page.locator('.ml-stats-roster tbody tr')).to_have_count(5)
 page.get_by_role('tab',name='患者报告').click();select(page,'选择患者','李先生');expect(page.locator('.ml-duplicate-table tbody tr')).to_have_count(1)
def main():
 results={};errors=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROME,headless=True);ctx=browser.new_context(viewport={'width':1440,'height':900},timezone_id='America/Los_Angeles');ctx.add_init_script("sessionStorage.setItem('medix-demo-assets','approved-fixture-v1')")
  f=Fixture();ctx.route('**/api/**',f.route);page=ctx.new_page();page.set_default_timeout(8000);page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,11,9,13,tzinfo=timezone.utc));old.login(page)
  # Query/resource isolation, duplicate slots, and truthful errors on detail.
  f.duplicate_detail=True;old.go(page,'/patients/'+PID);expect(page.get_by_role('button',name=re.compile('11月3日 08:00：2 个计划时点'))).to_have_text('1/2');shot(page,'04-multi-slot.png');results['same_time_multiple_plans']=True;f.duplicate_detail=False
  f.fail={'/daily-slots','/stats'};old.go(page,'/patients/'+old.PATIENTS[1]['id']);expect(page.get_by_text('登记统计不可用：演示服务暂不可用')).to_be_visible();expect(page.locator('.ml-detail-grid [role=alert]')).to_contain_text('演示服务暂不可用');shot(page,'04-partial-failure.png');results['partial_failure_not_empty']=True;f.fail=set()
  # Switch patient contexts; every read/modal remounts on the stable patient ID.
  old.go(page,'/patients/'+PID);old.go(page,'/patients/'+old.PATIENTS[1]['id']);expect(page.locator('.ml-detail-identity h1')).to_have_text('周先生');results['patient_switch']=True
  old.go(page,'/patients/'+PID);page.get_by_role('button',name='记录随访').click();expect(page).to_have_url(re.compile('followups\\?patientId='+PID));expect(page.locator('.ant-select').filter(has=page.get_by_role('combobox',name='按患者筛选随访记录'))).to_contain_text('李先生');page.get_by_role('button',name='新建随访').click();expect(page.locator('#followup-patient')).to_have_attribute('aria-expanded','false');results['detail_followup_patient_context']=True;shot(page,'04-followup-context.png')
  old.go(page,'/patients/'+PID);page.get_by_role('button',name='绑定账号',exact=True).click();page.get_by_label('账号',exact=True).fill('fixture-account');page.get_by_role('button',name='确定',exact=True).click();expect(page.get_by_role('dialog',name='账号已创建')).to_be_visible();f.fail={f'/{PID}'};expect(page.get_by_label('临时密码',exact=True)).to_have_value('Fixture-only-temp');shot(page,'04-account-password.png');page.get_by_role('button',name='已保存',exact=True).click();expect(page.get_by_role('alert')).to_contain_text('演示服务暂不可用');results['one_time_password_survives_failed_refresh']=True;f.fail=set();page.get_by_role('button',name='重试',exact=True).click();expect(page.locator('.ml-detail-identity')).to_be_visible()
  old.go(page,'/patients/'+PID);page.get_by_role('button',name='更多患者操作').click();page.get_by_text('绑定装置',exact=True).click();select(page,'装置型号','吸入气雾剂 pMDI');page.get_by_label('生效日期',exact=True).fill('2026-11-10');page.get_by_label('生效日期',exact=True).press('Enter');page.get_by_role('button',name='确定',exact=True).click();page.wait_for_timeout(300);assert f.posts[-1][1]['effective_from']=='2026-11-10T00:00:00+08:00';results['device_date_shanghai']=True
  f.event_count=51;old.go(page,'/patients');old.go(page,'/patients/'+PID);page.get_by_role('button',name='更多患者操作').click();page.get_by_text('查看登记',exact=True).click();expect(page.locator('.ml-record-list li')).to_have_count(50);page.get_by_role('button',name='下一页',exact=True).click();expect(page.locator('.ml-record-list li')).to_have_count(1);expect(page.get_by_text('OTHER_SOURCE')).to_be_visible();shot(page,'04-record-pagination.png');page.keyboard.press('Escape');results['events_page_51_unknown_source']=True
  # Plan validation, successful payload in a non-Shanghai browser, failed POST keeps draft.
  old.go(page,'/plans?patientId='+PID);select(page,'装置型号','吸入气雾剂 pMDI');page.get_by_label('药物名称',exact=True).fill('  演示新计划  ');page.get_by_role('button',name='创建计划',exact=True).click();expect(page.get_by_role('alert').filter(has_text='请添加至少一个')).to_be_visible();add_time(page,'08:00');add_time(page,'20:00')
  page.get_by_label('开始日期',exact=True).fill('2026-11-10');page.get_by_label('开始日期',exact=True).press('Enter');page.get_by_label('结束日期（选填）',exact=True).fill('2026-11-10');page.get_by_label('结束日期（选填）',exact=True).press('Enter')
  f.fail={'/medication-plans'};page.get_by_role('button',name='创建计划',exact=True).click();expect(page.get_by_label('药物名称',exact=True)).to_have_value('  演示新计划  ');results['create_failure_keeps_draft']=True;f.fail=set()
  before=len(f.posts);page.get_by_role('button',name='创建计划',exact=True).dblclick();page.wait_for_timeout(350);payload=f.posts[-1][1];assert len(f.posts)==before+1;assert payload['starts_at']=='2026-11-10T00:00:00+08:00' and payload['ends_at']=='2026-11-11T00:00:00+08:00';assert payload['drug_label']=='演示新计划';assert len(payload['daily_times'])==2;results['plan_inclusive_end_date_and_single_submit']=True
  select(page,'装置型号','吸入气雾剂 pMDI');page.get_by_label('药物名称',exact=True).fill('按需演示');add_time(page,'08:00');page.get_by_role('radio',name='按需',exact=True).check();page.get_by_role('button',name='创建计划',exact=True).click();page.wait_for_timeout(300);assert f.posts[-1][1]['daily_times']==[];results['prn_discards_fixed_slots']=True
  page.get_by_label('药物名称',exact=True).fill('未保存');select(page,'选择患者','周先生');expect(page.get_by_role('dialog')).to_be_visible();page.get_by_role('button',name='取消',exact=True).click();expect(page.get_by_label('药物名称',exact=True)).to_have_value('未保存');select(page,'选择患者','周先生');page.get_by_role('button',name='切换患者',exact=True).click();expect(page.get_by_label('药物名称',exact=True)).to_have_value('');results['switch_confirm_and_reset']=True
  # Validate pure date and plan boundaries against the actual bundled module.
  unit=page.evaluate("""async () => {let u=await import('/src/components/medix/clinical.ts');let now=Date.parse('2026-11-09T12:00:00+08:00'); return { phases:[u.derivePlanPhase({starts_at:'2026-11-01T00:00:00+08:00',ends_at:'2026-11-10T00:00:00+08:00'},now),u.derivePlanPhase({starts_at:'2026-11-10T00:00:00+08:00',ends_at:null},now),u.derivePlanPhase({starts_at:'2026-11-01T00:00:00+08:00',ends_at:'2026-11-02T00:00:00+08:00'},now)], times:[u.validTimes(['08:00','08:00']),u.validTimes(['24:00']),u.validTimes(['23:59'])],shanghai:u.shanghaiDay(new Date('2026-11-08T16:01:00Z'))} }""")
  assert unit=={'phases':['active','pending','ended'],'times':[False,False,True],'shanghai':'2026-11-09'};results['date_plan_boundary_checks']=unit
  old.go(page,'/stats');expect(page.locator('.ml-team-summary')).to_contain_text('75%');page.get_by_text('登记明细',exact=True).click();expect(page.locator('.ml-team-matrix tbody tr')).to_have_count(10);page.get_by_text('数据表',exact=True).click();expect(page.locator('.ml-chart-data table tbody tr')).to_have_count(7);results['chart_table_and_matrix_reachable']=True
  f.mode='weighted';old.go(page,'/plans');old.go(page,'/stats');expect(page.locator('.ml-team-summary')).to_contain_text('20%');shot(page,'06-weighted-20.png');results['weighted_2_of_10_is_20']=True
  f.mode='zero';old.go(page,'/plans');old.go(page,'/stats');expect(page.locator('.ml-donut-empty')).to_be_visible();expect(page.get_by_text('无到期时点',exact=True).first).to_be_visible();shot(page,'06-no-due.png');results['zero_N_neutral_not_zero_percent']=True
  f.mode='mismatch';old.go(page,'/plans');old.go(page,'/stats');expect(page.get_by_role('alert').filter(has_text='数据更新中')).to_be_visible();shot(page,'06-mismatch.png');results['mismatch_retry_then_visible_error']=True
  f.mode='normal';report(page);expect(page.locator('.ml-report-summary')).to_contain_text('85.7%');expect(page.locator('.ml-source-list')).to_contain_text('10');expect(page.locator('.ml-source-list')).to_contain_text('3');page.get_by_role('button',name='来源口径').click();expect(page.get_by_text('按有效登记事件计数，非去重；患者自述未由设备验证。')).to_be_visible();page.keyboard.press('Escape');page.locator('h1').click();results['report_12_slots_13_events']=True
  page.get_by_role('button',name='查看全部',exact=True).click();expect(page.locator('.ant-select').filter(has=page.get_by_role('combobox',name='按患者筛选随访记录'))).to_contain_text('李先生');results['report_followup_patient_context']=True
  for size in [1280,390]:
   page.set_viewport_size({'width':size,'height':844 if size==390 else 900})
   for path,name in [('/patients/'+PID,'04'),('/plans?patientId='+PID,'05'),('/stats','06')]:
    old.go(page,path);page.wait_for_timeout(250);shot(page,f'{name}-{size}.png',True);assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),name+' overflow'
   page.get_by_role('tab',name='患者报告').click();select(page,'选择患者','李先生');expect(page.locator('.ml-duplicate-table')).to_be_visible();shot(page,f'07-{size}.png',True);assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),'report overflow'
  results['responsive_1280_390']=True
  results['uncaught_js_errors']=errors;assert not errors
  (OUT/'interaction-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(results,ensure_ascii=False))
  browser.close()
if __name__=='__main__':main()


