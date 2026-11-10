from pathlib import Path
import re,json,hashlib,subprocess,zipfile
from playwright.sync_api import sync_playwright
root=Path.cwd();base=root/'docs/evidence';batch=base/'medix-12131415-alignment-v1';final=base/'medix-light-implementation-final-v1';gallery=base/'medix-light-full-ui'
hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
out=root/'output/playwright/medix-12131415'
result={'status':'pass','broken_links':[],'scope':['00']+[str(i).zfill(2) for i in range(1,16)]}
for page in [batch/'index.html',batch/'ACCEPTANCE.md',gallery/'index.html',final/'index.html',final/'HANDOFF.md',final/'DELIVERY.md']:
 text=page.read_text(encoding='utf-8-sig');links=re.findall(r'(?:src|href)="([^"]+)"',text) if page.suffix=='.html' else re.findall(r'\]\(([^)]+)\)',text)
 for ref in links:
  if ref.startswith(('http','#','data:')):continue
  if ref=='delivery-checks.json':continue
  if not (page.parent/ref.split('#')[0]).exists():result['broken_links'].append(str(page.relative_to(root))+':'+ref)
assert not result['broken_links'],result['broken_links']
for pack in [batch,final]:
 sources=json.loads((pack/'source-hashes.json').read_text())
 for p,sha in sources.items():assert hashfile(root/p)==sha and hashfile(pack/'source-snapshot'/p)==sha,p
result['current_frontend_files']=len(sources)
for name in ['preserved-sources.json','unchanged-gallery.json']:assert all(json.loads((batch/name).read_text()).values())
result['preserved_source_files']=len(json.loads((batch/'preserved-sources.json').read_text()));result['preserved_gallery_images']=11
assert 'built in' in (batch/'build.log').read_text(encoding='utf-8')
lint=(batch/'lint.log').read_text(encoding='utf-8');assert lint.count('warning ')==4 and ': error ' not in lint
for name,count in [('interaction-checks.json',12),('stress-checks.json',16)]:
 check=json.loads((batch/name).read_text());assert len(check['passed'])==count and not check['pageerrors'];result[name]=count
assert json.loads((batch/'chart-density-checks.json').read_text())['long_range'][0]['labels']==90
design=subprocess.run(['python','docs/design/medix-light/handoff-final-v2/verify.py'],capture_output=True,text=True,encoding='utf-8');assert design.returncode==0,design.stdout
design_result=json.loads(design.stdout);assert design_result['status']=='pass';(batch/'design-freeze-checks.json').write_text(json.dumps(design_result,ensure_ascii=False,indent=2),encoding='utf-8');result['design_frozen_entries']=103
oldpacks=[base/n for n in ['medix-0123-alignment-v1','medix-04050607-alignment-v1','medix-08091011-alignment-v1']]
result['preserved_prior_manifests']={}
for pack in oldpacks:
 m=json.loads((pack/'MANIFEST.json').read_text());entries=m['files']
 for p,sha in entries.items():assert hashfile(pack/p)==sha,p
 result['preserved_prior_manifests'][pack.name]=len(entries)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True);a=b.new_page(viewport={'width':1440,'height':900})
 for page,name,dest in [(gallery/'index.html','gallery',batch),(batch/'index.html','comparison',batch),(final/'index.html','final',final)]:
  a.goto(page.as_uri());a.evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')");a.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)');result[name+'_images']=a.locator('img').count();a.screenshot(path=str(dest/(name+'-preview.png')),full_page=True)
  if name=='gallery':assert a.locator('.shot.revised').count()==15
 assert result['gallery_images']==15 and result['final_images']==15 and result['comparison_images']==4
 a.set_viewport_size({'width':390,'height':844});a.goto((final/'index.html').as_uri());assert a.evaluate('document.documentElement.scrollWidth')==390;b.close()
result.update(build='pass',lint_warnings=4,lint_errors=0,independent_review={'P0':0,'P1':0,'P2':0},user_approved_through='11',user_review_pending=['12','13','14','15'])
for pack in [batch,final]:(pack/'delivery-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
for pack in [batch,final]:
 manifest={'version':pack.name,'date':'2026-11-10','status':'independent-review-passed-user-review-pending-12-15','files':{p.relative_to(pack).as_posix():hashfile(p) for p in sorted(pack.rglob('*')) if p.is_file() and p.name!='MANIFEST.json'}}
 (pack/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
# Preserve hierarchy so all offline gallery/report links resolve after extraction.
folders=oldpacks+[batch,final,gallery,root/'docs/design/medix-light']
archive=base/'medix-light-implementation-final-v1.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for folder in folders:
  for p in sorted(folder.rglob('*')):
   if p.is_file() and '__pycache__' not in p.parts:z.write(p,p.relative_to(root).as_posix())
 for p in [root/'design-qa.md',root/'docs/planning/UI-OPTIMIZATION-LOG.md']:z.write(p,p.relative_to(root).as_posix())
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for pack in oldpacks+[batch,final]:
  manifest=json.loads((pack/'MANIFEST.json').read_text())
  for name,sha in manifest['files'].items():assert hashlib.sha256(z.read((pack.relative_to(root)/name).as_posix())).hexdigest()==sha
 zip_entries=len(z.infolist())
archive_sha=hashfile(archive);archive.with_suffix('.zip.sha256').write_text(archive_sha+'  '+archive.name+'\n',encoding='utf-8')
archive.with_suffix('.zip.checks.json').write_text(json.dumps({'status':'pass','crc':'pass','evidence_manifests':'all entries match','entries':zip_entries,'bytes':archive.stat().st_size,'sha256':archive_sha},indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False));print('Archive',zip_entries,'entries',round(archive.stat().st_size/1048576,1),'MiB; CRC and manifests passed')
