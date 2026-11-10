import json,hashlib,shutil,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path.cwd();out=ROOT/'output/playwright/medix-12131415';dest=ROOT/'docs/evidence/medix-12131415-alignment-v1';dest.mkdir(exist_ok=True)
names=['12-admin-guides','13-admin-accounts','14-admin-knowledge','15-admin-audit'];targets=names[:3]+['15-audit-overview']
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True);a=b.new_page(viewport={'width':1440,'height':480})
 for name,target in zip(names,targets):
  ref=ROOT/'docs/design/medix-light/handoff-final-v2/references'/f'{target}.png'
  s=f'<!doctype html><meta charset="utf-8"><style>*{{box-sizing:border-box}}body{{margin:0;background:#eee;font:14px sans-serif}}main{{display:flex}}section{{width:720px}}header{{height:30px;padding:5px 12px;background:white}}img{{display:block;width:720px;height:auto}}</style><main><section><header>冻结目标 · 业务数据以现有接口为准</header><img src="{ref.as_uri()}"></section><section><header>当前代码浏览器实拍 · {name}</header><img src="{(out/(name+'.png')).as_uri()}"></section></main>'
  f=out/f'compare-{name}.html';f.write_text(s,encoding='utf-8');a.goto(f.as_uri());a.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)');a.screenshot(path=str(out/f'compare-{name}.png'),full_page=True)
 b.close()
for f in out.glob('*.png'):
 if not f.name.startswith('debug-'):shutil.copy2(f,dest/f.name)
for f in out.glob('*checks.json'):shutil.copy2(f,dest/f.name)
for name in ['build.log','lint.log','rules.md']:shutil.copy2(out/name,dest/(name.upper() if name=='rules.md' else name))
before=json.loads((out/'before-hashes.json').read_text())
allowed={'frontend-web/src/App.tsx','frontend-web/src/components/medix/MedixLayout.tsx','frontend-web/src/pages/admin/AdminPage.tsx','frontend-web/src/pages/admin/AdminRoute.tsx'}
hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
preserved={p:hashfile(ROOT/p)==v for p,v in before.items() if p.startswith('frontend-web/') and p not in allowed};assert all(preserved.values()),[p for p,v in preserved.items() if not v]
(dest/'preserved-sources.json').write_text(json.dumps(preserved,indent=2),encoding='utf-8')
sourcepaths=allowed|{p.relative_to(ROOT).as_posix() for p in (ROOT/'frontend-web/src').rglob('*') if p.is_file() and p.relative_to(ROOT).as_posix() not in before}
hashes={p:hashfile(ROOT/p) for p in sorted(sourcepaths)};(dest/'source-hashes.json').write_text(json.dumps(hashes,indent=2),encoding='utf-8')
for path in sourcepaths:
 target=dest/'source-snapshot'/path;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/path,target)
gallery=ROOT/'docs/evidence/medix-light-full-ui'
for name in names:shutil.copy2(dest/(name+'.png'),gallery/(name+'.png'))
unchanged={p:hashfile(ROOT/p)==v for p,v in before.items() if p.startswith('docs/evidence/') and Path(p).stem not in names};assert len(unchanged)==11 and all(unchanged.values())
(dest/'unchanged-gallery.json').write_text(json.dumps(unchanged,indent=2),encoding='utf-8')
p=gallery/'index.html';s=p.read_text(encoding='utf-8-sig');s=s.replace('00–11 产品代码与截图已分批校准','00–15 产品代码与截图已分批校准')
s=s.replace('00–07 已获用户通过；08–11 已按冻结目标完成代码与实拍，09按整个视口居中。12–15 保留此前批次，未计入本轮验收。','00–11 已获用户通过；12–15 已完成代码与实拍。07单独列图，09按整个视口居中，全部页面齐全。')
s=s.replace('00–07 用户已通过 · 08–11 独立复验通过','00–11 用户已通过 · 12–15 本轮收尾')
s=s.replace('<span>1440 桌面主图 · 另附390/1280实拍</span>','<span><a href="../medix-12131415-alignment-v1/index.html">12–15 对照与验收记录</a></span><span><a href="../medix-light-implementation-final-v1/index.html">整体交付与代码交接</a></span><span>1440 桌面主图 · 另附390/1280实拍</span>')
for name in names:s=re.sub(r'class="shot[^"]*" href="'+re.escape(name)+r'.png"',f'class="shot revised" href="{name}.png"',s)
for n,oldname,name in zip(['12','13','14','15'],['guides','accounts','knowledge','audit'],names):s=s.replace(f'{n} docs/evidence/medix-final/screenshots/{n}-{oldname}-1440.png',f'{n} docs/evidence/medix-12131415-alignment-v1/{name}.png')
s=s.replace('01–11 已分批更新为当前代码实拍；本轮08–11通过独立复验。12–15保留历史批次。独立复验不替代你的最终确认。','01–15 全部使用分批交付的代码实拍。00为公共框架。完整记录、源码快照和校验文件见整体交付；本轮独立复验与用户最终视觉确认分别记录。')
s=s.replace('/* 01–03 按实拍比例完整展示','/* 01–15 按实拍比例完整展示');p.write_text(s,encoding='utf-8')
rows=[]
for name,title in zip(names,['12 指导版本','13 账号管理','14 知识内容','15 审计日志']):
 n=name[:2];rows.append(f'<section><h2>{title}</h2><p><a href="{name}.png">完整实拍</a> · <a href="{n}-live.png">真实后端只读实拍</a> · <a href="{n}-mobile.png">390手机</a> · <a href="{n}-1280.png">1280桌面</a></p><a href="compare-{name}.png"><img src="compare-{name}.png" alt="左冻结目标，右当前代码"></a></section>')
style='*{box-sizing:border-box}body{margin:0;background:#f6f6f6;color:#424650;font:16px/1.7 "Microsoft YaHei",sans-serif}header,main{max-width:1500px;margin:auto;padding:24px}h1{font-size:24px;font-weight:500}h2{font-size:20px;font-weight:500}a{color:#7340d4}section{margin:24px 0;padding:20px;background:white;border-radius:8px}img{display:block;width:100%;height:auto}nav{display:flex;gap:20px;flex-wrap:wrap}@media(max-width:700px){header,main{padding:12px}}'
(dest/'index.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Medix Light 12–15 对齐交付</title><style>'+style+'</style><header><h1>12–15 代码对齐与验收</h1><p>12指导版本 · 13账号管理 · 14知识内容 · 15审计日志。00–11批准版保留。</p><p>左冻结目标，右浏览器实拍。审计按真实接口展示“其他”类别，不编造账号操作；图表只在区间数据完整时显示。</p><nav><a href="../medix-light-full-ui/index.html">全站画廊</a><a href="../medix-light-implementation-final-v1/index.html">整体交付</a><a href="ACCEPTANCE.md">验收报告</a><a href="INDEPENDENT-REVIEW.md">独立复验</a><a href="interaction-checks.json">12项交互</a><a href="stress-checks.json">16项边界</a><a href="live-checks.json">真实后端</a></nav></header><main>'+''.join(rows)+'<section><h2>边界证据</h2><p><a href="15-partial-read.png">读取不完整</a> · <a href="15-detail-safe.png">安全详情</a> · <a href="15-large-mobile.png">手机3000条</a> · <a href="15-long-range.png">长日期区间</a> · <a href="13-neutral-avatars.png">无照片回退</a> · <a href="13-short-mobile.png">短屏弹窗</a></p><p>主图使用隔离演示接口。真实后端只读检查，未提交业务变更。临时密码未进入截图、日志或存储。</p></section></main></html>',encoding='utf-8')
print('Prepared batch; preserved source files',len(preserved),'source snapshot',len(hashes),'unchanged gallery',len(unchanged))
