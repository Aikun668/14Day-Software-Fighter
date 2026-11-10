from capture import *
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=CHROME,headless=True);c=b.new_context();f=Fixture();c.route('**/api/**',f.route);pg=c.new_page();old.login(pg);old.go(pg,'/patients/'+PID);pg.get_by_role('button',name='更多患者操作').click();pg.get_by_text('绑定装置',exact=True).click();pg.wait_for_timeout(500);print(pg.locator('body').aria_snapshot());b.close()
