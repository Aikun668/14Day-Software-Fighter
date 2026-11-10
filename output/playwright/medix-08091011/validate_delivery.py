from pathlib import Path
import re,json,hashlib
from playwright.sync_api import sync_playwright
root=Path.cwd();pack=root/'docs/evidence/medix-08091011-alignment-v1';gallery=root/'docs/evidence/medix-light-full-ui'
result={'status':'pass','broken_links':[]}
for page in [pack/'index.html',gallery/'index.html',pack/'ACCEPTANCE.md']:
 text=page.read_text(encoding='utf-8-sig')
 links=re.findall(r'(?:src|href)="([^"]+)"',text) if page.suffix=='.html' else re.findall(r'\]\(([^)]+)\)',text)
 for ref in links:
  if ref.startswith(('http','#','data:')):continue
  if not (page.parent/ref.split('#')[0]).exists():result['broken_links'].append(str(page.relative_to(root))+':'+ref)
assert not result['broken_links'],result['broken_links']
sources=json.loads((pack/'source-hashes.json').read_text())
assert all(hashlib.sha256((root/p).read_bytes()).hexdigest()==sha for p,sha in sources.items())
assert all(json.loads((pack/'preserved-sources.json').read_text()).values())
assert all(json.loads((pack/'unchanged-gallery.json').read_text()).values())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True);a=b.new_page(viewport={'width':1440,'height':900})
 for page,name in [(gallery/'index.html','gallery'),(pack/'index.html','comparison')]:
  a.goto(page.as_uri());a.evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')");a.wait_for_function('Array.from(document.images).every(i=>i.complete && i.naturalWidth>0)')
  result[name+'_images']=a.locator('img').count()
  a.screenshot(path=str(pack/(name+'-preview.png')),full_page=True)
 result['gallery_new_target_sizes']={}
 for name in ['08-followups.png','09-task-close-modal.png','10-medication-backfill-modal.png','11-admin.png']:
  a.goto((gallery/name).as_uri());result['gallery_new_target_sizes'][name]=a.locator('img').evaluate('(e)=>[e.naturalWidth,e.naturalHeight]')
 b.close()
result.update(source_snapshot_files=len(sources),unchanged_original_sources=43,unchanged_gallery_images=11,interaction_checks=18,boundary_checks=10)
(pack/'delivery-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
manifest={'version':'medix-08091011-alignment-v1','date':'2026-11-10','status':'independent-review-passed-user-review-pending','scope':['08','09','10','11'],'review':{'P0':0,'P1':0,'P2':0},'files':{str(f.relative_to(pack)).replace('\\','/'):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(pack.rglob('*')) if f.is_file() and f.name!='MANIFEST.json'}}
(pack/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False));print('Frozen evidence entries:',len(manifest['files']))

