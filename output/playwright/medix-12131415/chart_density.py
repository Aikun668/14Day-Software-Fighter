from capture import *
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=CHROME,headless=True);c=b.new_context(viewport={'width':390,'height':844});f=Fixture();f.audits=[dict(f.audits[0],id='large-'+str(i)) for i in range(3000)];c.route('**/api/**',f.route);a=c.new_page();a.clock.set_fixed_time(datetime(2026,11,9,13,tzinfo=timezone.utc));signin(a);go(a,'audit');expect(a.locator('.ml-audit-charts')).to_be_visible(timeout=25000);shot(a,'15-large-mobile.png',True)
 a.set_viewport_size({'width':1440,'height':900});date=a.locator('.ant-picker-input input').first;date.fill('2026-08-11');date.press('Enter');date.press('Tab');expect(a.locator('.ml-audit-charts')).to_be_visible(timeout=60000);a.get_by_role('heading',name='审计日志',exact=True).click();a.keyboard.press('Escape');shot(a,'15-long-range.png')
 result=a.evaluate("async()=>{const e=await import('/node_modules/.vite/deps/echarts.js');return [...document.querySelectorAll('.ml-audit-chart')].map(el=>{const o=e.getInstanceByDom(el).getOption();return {labels:o.xAxis[0].data?.length,labelShown:o.series[0].label.show,right:o.grid[0].right}})}")
 assert result[0]['labels']>80 and not result[0]['labelShown'];(OUT/'chart-density-checks.json').write_text(json.dumps({'long_range':result,'large_count':3000}),encoding='utf-8');print('Chart large-count and long-range checks passed');b.close()

