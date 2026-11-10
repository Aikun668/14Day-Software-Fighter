import json,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path.cwd();OUT=ROOT/'output/playwright/medix-04050607'
refs={
 '04-patient-detail':'handoff-final-v2/references/04-patient-detail.png',
 '05-plans':'handoff-05060809-v1/references/05-plans.png',
 '06-stats':'handoff-05060809-v1/references/06-stats-charts.png',
 '07-patient-report':'handoff-07-v1/references/07-patient-report.png'}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True);pg=b.new_page(viewport={'width':1440,'height':480})
 for name,ref in refs.items():
  html=f'''<!doctype html><meta charset="utf-8"><style>*{{box-sizing:border-box}}body{{margin:0;background:#eee;font:14px sans-serif}}main{{display:flex}}section{{width:720px}}header{{height:30px;padding:5px 12px;background:white}}img{{display:block;width:720px;height:auto}}</style><main><section><header>冻结目标 · 数据按真实口径落地</header><img src="{(ROOT/'docs/design/medix-light'/ref).as_uri()}"></section><section><header>本轮浏览器实拍 · {name}</header><img src="{(OUT/(name+'.png')).as_uri()}"></section></main>'''
  file=OUT/f'compare-{name}.html';file.write_text(html,encoding='utf-8');pg.goto(file.as_uri());pg.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)');pg.screenshot(path=str(OUT/f'compare-{name}.png'),full_page=True)
 b.close()
previous=json.loads((ROOT/'docs/evidence/medix-0123-alignment-v1/source-hashes.json').read_text(encoding='utf-8-sig'))
results={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==sha for name,sha in previous.items() if name not in ['frontend-web/src/App.tsx','frontend-web/src/components/medix/MedixLayout.tsx']}
assert all(results.values());(OUT/'preserved-0123.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');print('4 comparisons; approved 00-03 components/styles/assets unchanged:',len(results))
