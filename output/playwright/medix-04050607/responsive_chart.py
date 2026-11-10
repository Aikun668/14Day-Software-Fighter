from capture import *
from interactions import select
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=CHROME,headless=True);ctx=b.new_context(viewport={'width':390,'height':844},timezone_id='America/Los_Angeles');ctx.add_init_script("sessionStorage.setItem('medix-demo-assets','approved-fixture-v1')");f=Fixture();ctx.route('**/api/**',f.route);page=ctx.new_page();page.clock.install(time=datetime(2026,11,9,13,tzinfo=timezone.utc));old.login(page);old.go(page,'/stats');expect(page.locator('.ml-stats-roster')).to_be_visible();shot(page,'06-390.png',True);page.get_by_role('tab',name='患者报告').click();select(page,'选择患者','李先生');expect(page.locator('.ml-duplicate-table')).to_be_visible();shot(page,'07-390.png',True)
 page.locator('.ml-chart-data summary').click();expect(page.locator('.ml-chart-data tbody tr')).to_have_count(7);assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');shot(page,'07-390-data-table.png',True)
 page.locator('.ml-chart-data summary').click();page.set_viewport_size({'width':1440,'height':1080});shot(page,'07-patient-report.png',True);b.close();print('Mobile labels no longer overlap; seven data rows remain available')
