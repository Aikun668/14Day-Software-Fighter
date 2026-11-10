from capture import *
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=CHROME,headless=True);c=b.new_context(viewport={'width':1440,'height':900});c.add_init_script("sessionStorage.setItem('medix-demo-assets','approved-fixture-v1')");f=Fixture();c.route('**/api/**',f.route);a=c.new_page();signin(a);expect(a.locator('.ml-admin-models tbody tr')).to_have_count(3);shot(a,'11-regression.png')
 from PIL import Image,ImageChops
 left=Image.open('docs/evidence/medix-light-full-ui/11-admin.png').convert('RGB');right=Image.open(OUT/'11-regression.png').convert('RGB');same=ImageChops.difference(left,right).getbbox() is None
 print('11 screenshot pixel identical:',same);import numpy as np
 d=np.any(np.asarray(left)!=np.asarray(right),axis=-1);rects=a.locator('.ml-brand img,.ml-account .ml-avatar,.ml-doctor').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})')
 for x,y,w,h in rects:d[max(0,int(y)-2):int(y+h)+2,max(0,int(x)-2):int(x+w)+2]=False
 outside_identical=not bool(d.any());assert outside_identical
 c.close();c=b.new_context(viewport={'width':1440,'height':900});f=prev.Fixture();c.route('**/api/**',f.route);a=c.new_page();prev.signin(a)
 for path,title in [('/workbench','工作台'),('/patients','患者管理'),('/followups','随访中心')]:
  old.go(a,path);expect(a.get_by_role('heading',name=title,exact=True)).to_be_visible()
 old.go(a,'/followups');a.get_by_role('button',name='快速处理',exact=True).first.click();a.wait_for_timeout(550);r=a.get_by_role('dialog').bounding_box();assert abs(r['y']+r['height']/2-450)<1
 (OUT/'preserved-ui-checks.json').write_text(json.dumps({'11_pixel_identical':same,'11_content_outside_unchanged_asset_boxes_identical':outside_identical,'clinician_routes':['workbench','patients','followups'],'09_viewport_center':True}),encoding='utf-8');b.close()

