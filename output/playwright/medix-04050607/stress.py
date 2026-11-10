import json,re
from capture import *
from interactions import select
class StressFixture(Fixture):
 def __init__(self):super().__init__();self.hold_id=None;self.pending=[];self.multiple_followups=False
 def route(self,r):
  path=urlparse(r.request.url).path;q=parse_qs(urlparse(r.request.url).query)
  if r.request.method=='GET' and self.hold_id and path.startswith('/api/patients/'+self.hold_id):self.pending.append(r);return
  if path.endswith('/followups') and self.multiple_followups:
   n=int(q.get('page',['1'])[0]);items=[dict(id=f'new-{i}',patient_id=PID,followed_at='2026-11-10T12:00:00+08:00',feedback='区间外',action_taken=None,next_plan=None) for i in range(100)] if n==1 else [dict(id='period-follow',patient_id=PID,followed_at='2026-11-07T12:00:00+08:00',feedback='第二页周期内记录',action_taken=None,next_plan=None)]
   self.reads.append(['GET',path,q]);r.fulfill(json={'items':items,'total':101});return
  super().route(r)
 def release(self):
  self.hold_id=None
  for r in self.pending:
   try:Fixture.route(self,r)
   except Exception:pass
  self.pending=[]
def open_report(page):
 old.go(page,'/plans');old.go(page,'/stats');page.get_by_role('tab',name='患者报告').click();select(page,'选择患者','李先生');expect(page.locator('.ml-report-summary')).to_contain_text('登记覆盖')
def main():
 result={};errors=[]
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=CHROME,headless=True);ctx=b.new_context(viewport={'width':1440,'height':900},timezone_id='America/Los_Angeles');ctx.add_init_script("sessionStorage.setItem('medix-demo-assets','approved-fixture-v1')");f=StressFixture();ctx.route('**/api/**',f.route);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,11,9,13,tzinfo=timezone.utc));old.login(page)
  f.hold_id=PID;old.go(page,'/patients/'+PID);old.go(page,'/patients/'+old.PATIENTS[1]['id']);expect(page.locator('.ml-detail-identity h1')).to_have_text('周先生');f.release();page.wait_for_timeout(300);expect(page.locator('.ml-detail-identity h1')).to_have_text('周先生');result['detail_A_slow_B_fast']=True
  for mode,rate in [('rounding1','6.2%'),('rounding5','31.2%')]:
   f.mode=mode;open_report(page);expect(page.locator('.ml-report-summary')).to_contain_text(rate);assert not page.locator('.ml-report [role=alert]').count();result[mode]=True
  f.mode='many-missing';open_report(page);expect(page.locator('.ml-missing-distribution li')).to_have_count(7);page.get_by_role('button',name='查看全部 14 个',exact=True).click();expect(page.locator('.ml-missing-list li')).to_have_count(14);shot(page,'07-many-missing.png',True);result['many_missing_day_bars_and_all_slots']=True
  f.mode='normal';f.multiple_followups=True;open_report(page);expect(page.locator('.ml-followup-table')).to_contain_text('第二页周期内记录');assert any(path.endswith('/followups') and q.get('page')==['2'] for _,path,q in f.reads);result['followups_beyond_100']=True;f.multiple_followups=False
  f.fail={'/stats/trend','/followups'};open_report(page);expect(page.locator('.ml-report-summary')).to_contain_text('85.7%');expect(page.locator('.ml-report [role=alert]')).to_have_count(2);shot(page,'07-partial-failure.png',True);result['report_independent_errors']=True;f.fail=set()
  # Directory failure must not hide a report opened from a verified overview row.
  f.fail={'/patients'};old.go(page,'/plans');old.go(page,'/stats');first=page.locator('.ml-stats-roster tbody tr').first;name=first.locator('.ml-identity').inner_text();first.get_by_role('button',name=re.compile('查看')).click();expect(page.locator('.ml-report-summary')).to_contain_text(name);result['overview_row_fallback_without_directory']=True;f.fail=set()
  old.go(page,'/plans');old.go(page,'/stats');page.get_by_role('tab',name='患者报告').click();f.hold_id=PID;select(page,'选择患者','李先生');select(page,'选择患者','周先生');expect(page.locator('.ml-report-summary')).to_contain_text('周先生');f.release();page.wait_for_timeout(300);expect(page.locator('.ml-report-summary')).to_contain_text('周先生');result['report_A_slow_B_fast']=True
  # Browser-visible date validation, including inclusive end and no request for 93 days.
  old.go(page,'/plans');old.go(page,'/stats')
  def change_range(start,end):
   inputs=page.locator('.ant-picker-range input');inputs.nth(0).fill(start);inputs.nth(0).press('Enter');inputs.nth(1).fill(end);inputs.nth(1).press('Enter');page.locator('h1').click();page.wait_for_timeout(350)
  change_range('2026-11-02','2026-11-02');assert any(path=='/api/stats/overview' and q.get('from')==['2026-11-02'] and q.get('to')==['2026-11-03'] for _,path,q in f.reads);result['one_day_inclusive_range']=True
  change_range('2026-08-02','2026-11-01');expect(page.locator('.ml-team-summary')).to_be_visible();assert any(path=='/api/stats/overview' and q.get('from')==['2026-08-02'] and q.get('to')==['2026-11-02'] for _,path,q in f.reads);result['92_days_allowed']=True
  before=len([r for r in f.reads if r[1]=='/api/stats/overview']);change_range('2026-08-02','2026-11-02');expect(page.get_by_role('alert').filter(has_text='请选择 1–92 日')).to_be_visible();assert len([r for r in f.reads if r[1]=='/api/stats/overview'])==before;shot(page,'06-range-validation.png');result['93_days_blocked_before_request']=True
  result['uncaught_js_errors']=errors;assert not errors;(OUT/'stress-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=False));b.close()
if __name__=='__main__':main()
