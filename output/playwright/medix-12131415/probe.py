from capture import *
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=CHROME,headless=True);c=b.new_context();f=Fixture();c.route('**/api/**',f.route);a=c.new_page();signin(a);go(a,'guide');a.wait_for_timeout(800)
 print(a.locator('.ml-table td').first.evaluate('e=>({font:getComputedStyle(e).fontFamily,theme:getComputedStyle(e.closest(".ml-theme")).fontFamily,fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),body:getComputedStyle(document.body).fontFamily})'))
 b.close()
