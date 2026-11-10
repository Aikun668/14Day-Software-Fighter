import json,hashlib,re
from pathlib import Path
from urllib.parse import urlparse,unquote
from playwright.sync_api import sync_playwright
root=Path.cwd();folder=root/'docs/evidence/medix-04050607-alignment-v1';gallery=root/'docs/evidence/medix-light-full-ui';checks={}
for file in [folder/'index.html',gallery/'index.html']:
 missing=[]
 for link in re.findall(r'(?:href|src)="([^"]+)"',file.read_text(encoding='utf-8-sig')):
  if not urlparse(link).scheme and not link.startswith('#') and not (file.parent/unquote(link.split('#')[0])).exists():missing.append(link)
 assert not missing,(file,missing)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True);pg=b.new_page(viewport={'width':1440,'height':900})
 for file in [folder/'index.html',gallery/'index.html']:
  pg.goto(file.as_uri());pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true);document.querySelectorAll('img').forEach(i=>i.loading='eager')");pg.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)',timeout=10000)
  checks[str(file.relative_to(root))]={'images':pg.locator('img').count(),'all_loaded':True,'broken_links':0}
 b.close()
for f in ['04-patient-detail.png','05-plans.png','06-stats.png','07-patient-report.png']:assert (folder/f).read_bytes()==(gallery/f).read_bytes()
checks['new_gallery_images_match_evidence']=True
(folder/'delivery-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
files=['frontend-web/src/App.tsx','frontend-web/src/pages/clinician/PatientDetailPage.tsx','frontend-web/src/pages/clinician/PlanEditPage.tsx','frontend-web/src/pages/clinician/StatsPage.tsx','frontend-web/src/pages/clinician/FollowupPage.tsx','frontend-web/src/components/CoverageTrendChart.tsx','frontend-web/src/styles/medix-clinical.css']+[str(p.relative_to(root)).replace('\\','/') for p in (root/'frontend-web/src/components/medix').glob('*')]
(folder/'source-hashes.json').write_text(json.dumps({f:hashlib.sha256((root/f).read_bytes()).hexdigest() for f in files},indent=2),encoding='utf-8')
print(json.dumps(checks,ensure_ascii=False))
