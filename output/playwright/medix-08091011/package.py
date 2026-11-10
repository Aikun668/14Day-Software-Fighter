import json,hashlib,shutil,html
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path.cwd();out=ROOT/'output/playwright/medix-08091011';dest=ROOT/'docs/evidence/medix-08091011-alignment-v1';dest.mkdir(exist_ok=True)
refs={'08-followups':'handoff-05060809-v1/references/08-followups.png','09-task-close-modal':'handoff-05060809-v1/references/09-task-close-modal.png','10-medication-backfill-modal':'handoff-final-v2/references/10-medication-backfill-modal.png','11-admin-devices':'handoff-final-v2/references/11-admin-devices.png'}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True);a=b.new_page(viewport={'width':1440,'height':480})
 for name,ref in refs.items():
  doc=f'<!doctype html><meta charset="utf-8"><style>*{{box-sizing:border-box}}body{{margin:0;background:#eee;font:14px sans-serif}}main{{display:flex}}section{{width:720px}}header{{height:30px;padding:5px 12px;background:white}}img{{display:block;width:720px;height:auto}}</style><main><section><header>冻结目标 · 09位置以用户新要求为准</header><img src="{(ROOT/"docs/design/medix-light"/ref).as_uri()}"></section><section><header>当前代码浏览器实拍 · {name}</header><img src="{(out/(name+".png")).as_uri()}"></section></main>'
  file=out/f'compare-{name}.html';file.write_text(doc,encoding='utf-8');a.goto(file.as_uri());a.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)');a.screenshot(path=str(out/f'compare-{name}.png'),full_page=True)
 b.close()
# Only selected production evidence, never debug or superseded probes.
for f in out.glob('*.png'):
 if not f.name.startswith('debug-'):shutil.copy2(f,dest/f.name)
for f in out.glob('*checks.json'):shutil.copy2(f,dest/f.name)
for name in ['build.log','lint.log','rules.md']:shutil.copy2(out/name,dest/name.upper() if name=='rules.md' else dest/name)
before=json.loads((out/'before-hashes.json').read_text())
allowed={'frontend-web/src/App.tsx','frontend-web/src/components/MedicationBackfillModal.tsx','frontend-web/src/components/TaskCloseModal.tsx','frontend-web/src/components/medix/MedixLayout.tsx','frontend-web/src/pages/admin/AdminPage.tsx','frontend-web/src/pages/clinician/FollowupPage.tsx','frontend-web/src/pages/clinician/PatientDetailPage.tsx','frontend-web/src/pages/clinician/WorkbenchPage.tsx'}
preserved={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==v for p,v in before.items() if p.startswith('frontend-web/') and p not in allowed}
assert all(preserved.values())
(dest/'preserved-sources.json').write_text(json.dumps(preserved,indent=2),encoding='utf-8')
sourcepaths=allowed|{str(p.relative_to(ROOT)).replace('\\','/') for p in (ROOT/'frontend-web/src').rglob('*') if p.is_file() and str(p.relative_to(ROOT)).replace('\\','/') not in before}
hashes={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sorted(sourcepaths)}
(dest/'source-hashes.json').write_text(json.dumps(hashes,indent=2),encoding='utf-8')
for path in sourcepaths:
 target=dest/'source-snapshot'/path;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/path,target)
# Gallery main images only. Preserve 01–07 and 12–15 hashes.
gallery=ROOT/'docs/evidence/medix-light-full-ui'
mapping={'08-followups':'08-followups','09-task-close-modal':'09-task-close-modal','10-medication-backfill-modal':'10-medication-backfill-modal','11-admin-devices':'11-admin'}
for src,target in mapping.items():shutil.copy2(dest/(src+'.png'),gallery/(target+'.png'))
unchanged={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==v for p,v in before.items() if p.startswith('docs/evidence/') and Path(p).stem not in mapping.values()}
assert all(unchanged.values())
(dest/'unchanged-gallery.json').write_text(json.dumps(unchanged,indent=2),encoding='utf-8')
p=gallery/'index.html';s=p.read_text(encoding='utf-8-sig').replace('00–07 产品代码与截图已分批校准','00–11 产品代码与截图已分批校准')
s=s.replace('00–03 已获用户通过；04–07 本轮代码和实拍已对齐冻结目标，独立子 Agent 复验通过。08–15 保留此前批次，尚未计入本轮代码验收。','00–07 已获用户通过；08–11 已按冻结目标完成代码与实拍，09按整个视口居中。12–15 保留此前批次，未计入本轮验收。')
s=s.replace('00–03 用户已通过 · 04–07 子 Agent 复验通过','00–07 用户已通过 · 08–11 本轮交付')
s=s.replace('<span>1440 桌面主图 · 另附390/1280实拍</span>','<span><a href="../medix-08091011-alignment-v1/index.html">08–11 对照与验收记录</a></span><span>1440 桌面主图 · 另附390/1280实拍</span>')
for name in mapping.values():
 import re
 s=re.sub(r'class="shot[^"]*" href="'+re.escape(name)+r'.png"',f'class="shot revised" href="{name}.png"',s)
s=s.replace('  .shot.revised[href="07-patient-report.png"]', '  .shot.revised[href="08-followups.png"] .thumb { aspect-ratio: 1440 / 984; }\n  .shot.revised[href="07-patient-report.png"]')
s=s.replace('处理说明必填，最多 200 字，品牌紫确认','整个视口居中；200字处理说明，提交中锁定')
for old,new in [('08 docs/evidence/medix-05060809/screenshots/08-followups-1440.png','08 docs/evidence/medix-08091011-alignment-v1/08-followups.png'),('09 docs/evidence/medix-05060809/screenshots/09-task-close-1440.png','09 docs/evidence/medix-08091011-alignment-v1/09-task-close-modal.png'),('10 docs/evidence/medix-final/screenshots/10-backfill-1440.png','10 docs/evidence/medix-08091011-alignment-v1/10-medication-backfill-modal.png'),('11 docs/evidence/medix-final/screenshots/11-devices-1440.png','11 docs/evidence/medix-08091011-alignment-v1/11-admin-devices.png')]:s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
rows=[]
live=['08-followups-live.png','09-task-close-live.png','10-backfill-live.png','11-admin-devices-live.png']
mobile=['08-followups-mobile.png','09-task-close-mobile.png','10-backfill-mobile.png','11-admin-devices-mobile.png']
for i,(name,title) in enumerate(zip(refs,['08 随访中心','09 处理任务','10 补登用药','11 装置型号'])):
 rows.append(f'<section><h2>{title}</h2><p><a href="{name}.png">完整实拍</a> · <a href="{live[i]}">真实后端只读实拍</a> · <a href="{mobile[i]}">手机实拍</a> · <a href="{name[:2]}-1280.png">1280实拍</a></p><a href="compare-{name}.png"><img src="compare-{name}.png" alt="左冻结目标，右当前实现"></a></section>')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Medix Light 08–11 对齐交付</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f6f6;color:#424650;font:16px/1.7 "Microsoft YaHei",sans-serif}header,main{max-width:1500px;margin:auto;padding:24px}h1{font-size:24px;font-weight:500}h2{font-size:20px;font-weight:500}p{margin:8px 0}a{color:#7340d4}section{margin:28px 0;padding:20px;background:white;border-radius:8px}img{display:block;width:100%;height:auto;margin:12px 0}nav{display:flex;gap:20px;flex-wrap:wrap}.note{color:#697180}@media(max-width:700px){header,main{padding:12px}section{padding:12px}}</style><header><h1>08–11 代码对齐与验收</h1><p>09按整个视口居中。00–07已获用户批准；本轮保留原页面与素材。</p><p class="note">左侧为冻结目标，右侧为当前代码浏览器截图。数据、五行展开、临床语义与用户新要求优先；不声明逐像素100%一致。</p><nav><a href="../medix-light-full-ui/index.html">全站画廊</a><a href="ACCEPTANCE.md">验收报告</a><a href="interaction-checks.json">18项交互检查</a><a href="stress-checks.json">10项边界检查</a><a href="live-checks.json">真实后端检查</a></nav></header><main>'''+''.join(rows)+'''<section><h2>异常与边界</h2><p><a href="10-locked-slots.png">补登时点提交锁</a> · <a href="10-unknown-result.png">未知结果核对</a> · <a href="09-short-mobile.png">短屏居中与底部按钮</a> · <a href="08-neutral-avatars.png">普通患者缺照片回退</a></p><p class="note">写操作使用隔离演示接口。真实后端未提交临床修改。演示人像为已批准虚构素材，普通患者没有照片时显示中性占位。剩余12–15保持原实现。</p></section></main></html>'''
(dest/'index.html').write_text(page,encoding='utf-8')
print('Pack prepared; preserved source files:',len(preserved),'unchanged gallery images:',len(unchanged),'snapshot sources:',len(hashes))

