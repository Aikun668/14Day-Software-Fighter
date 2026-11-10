from pathlib import Path
import json,shutil,hashlib,html,re
from playwright.sync_api import sync_playwright
ROOT=Path.cwd();OUT=Path(__file__).resolve().parent;DEST=ROOT/'docs/evidence/patient-app-current-preview-v1';DEST.mkdir(exist_ok=True)
meta=json.loads((OUT/'capture-checks.json').read_text(encoding='utf-8'));screens=meta['screens']
notes={
 '01-login':'表单清楚；品牌识别较弱，大片空白。',
 '02-change-password':'流程集中；标题较长，与网页登录的字体层级不同。',
 '03-today':'下一步明确；编号、小字和重复提醒偏多，颜色集中在紫色。',
 '04-guide':'图文步骤完整；六步长页，操作入口在末尾。',
 '05-training':'三种自检状态明确；重复大图使页面较长，底部才可提交。',
 '06-medication':'登记与历史齐全；每条记录单独成卡，多种标签并排拥挤。',
 '07-assistant':'提问入口直接；首屏像表单，缺少容易开始的提问入口。',
 '08-training-history':'能查看历史；多个“完成”连续铺开，不易快速识别困难步骤。',
 '09-revoke-sheet':'底部确认符合当前手机布局；说明可精简，撤销后果需要保留。',
 '10-assistant-result':'明确区分资料不足；这是隔离示例响应，不是模型真实回答。',
}
for screen in screens:
 for suffix in ['.png','-full.png']:shutil.copy2(OUT/(screen['id']+suffix),DEST/(screen['id']+suffix))
shutil.copy2(OUT/'capture-checks.json',DEST/'capture-checks.json')
shutil.copy2(OUT/'source-before.json',DEST/'source-hashes.json')
cards=[]
for i,s in enumerate(screens):
 key=s['id'];extra='core' if i<7 else 'extra';mark='示例反馈' if s['mode']=='fixture-response' else '当前代码实拍'
 cards.append(f'''<article data-group="{extra}" id="{key}"><div class="card-head"><h3>{key[:2]} · {s['title']}</h3><span>{mark}</span></div><a href="{key}.png" target="_blank"><img src="{key}.png" width="390" height="844" alt="{s['title']}当前页面"></a><div class="card-foot"><p>{notes[key]}</p><div><a href="{key}.png" target="_blank">首屏原图</a><a href="{key}-full.png" target="_blank">完整长图</a></div></div></article>''')
style='''*{box-sizing:border-box}body{margin:0;background:#f6f6f6;color:#424650;font:16px/1.65 "Microsoft YaHei",sans-serif}header,main,footer{max-width:1500px;margin:auto;padding:28px}header{padding-bottom:8px}h1{font-size:26px;font-weight:500;margin:0 0 10px}h2{font-size:22px;font-weight:500}h3{font-size:17px;font-weight:500;margin:0}p{margin:8px 0}a{color:#7340d4}nav{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}.muted{color:#697180;font-size:14px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}article{background:white;border:1px solid #e7e9ef;border-radius:10px;overflow:hidden}.card-head{padding:12px 14px}.card-head span{font-size:12px;color:#697180}.card-foot{padding:12px 14px}.card-foot p{font-size:14px;min-height:3.3em}.card-foot div{display:flex;gap:20px}img{display:block;width:100%;height:auto}.card-foot a{font-size:14px}.filters{display:flex;gap:10px;margin:0 0 20px}.filters button{border:1px solid #dedee7;background:white;border-radius:7px;padding:9px 16px;font:inherit;color:#697180;cursor:pointer}.filters button[aria-pressed=true]{background:#f2ecff;color:#7340d4;border-color:#cdbcfa}.proposals{background:white;padding:24px;margin:32px 0;border-radius:10px}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:680px}th,td{text-align:left;vertical-align:top;padding:14px;border-bottom:1px solid #eceef2}th{background:#fafafa;font-weight:500}td:first-child{width:16%}[hidden]{display:none!important}footer{font-size:14px;color:#697180;padding-top:0}@media(max-width:1000px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:720px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}header,main,footer{padding:16px}.card-foot p{min-height:0}}@media(max-width:430px){.grid{grid-template-columns:1fr}.proposals{padding:16px}}'''
proposals='''<section class="proposals" id="options"><h2>两套优化方向 · 讨论稿</h2><p>共同基底：沿用网页的浅灰底、白色内容区、字体和图标。紫色突出主操作，蓝色用于趋势，青绿表示已登记，杏色表示需关注。去掉姓名后的编号与重复小字；必要风险提示和资料来源保留。</p><div class="table-wrap"><table><thead><tr><th>位置</th><th>方案一：保留结构，统一视觉</th><th>方案二：按手机操作重排（推荐）</th></tr></thead><tbody><tr><td>导航与首页</td><td>保留“今日／指导／记录”；首页减掉重复描述，今日时点紧凑排列，七日数据用小图呈现。</td><td>仍用三个底栏；首页优先展示“现在要做什么”，下一次用药和登记按钮最突出，学习、提醒、趋势按优先级下移。</td></tr><tr><td>指导与自检</td><td>保留连续阅读；图片缩小，步骤合并为平面列表，减少每步一张卡。</td><td>每屏看一步、做一步，显示当前进度；底部固定“上一步／下一步”，减少长距离滚动。</td></tr><tr><td>记录与助手</td><td>记录按日期分组，用细线隔开；助手精简说明、出处收起，保持现有提问流程。</td><td>记录改为周日期选择＋当天时间线；助手增加常见问题入口，答案与出处分层呈现。</td></tr><tr><td>调整幅度</td><td>较小，原有操作路径最熟悉。</td><td>较大，改排布和阅读节奏，单手操作更集中。</td></tr></tbody></table></div><p>两套均保留三项底栏。网页继续侧栏＋表格，APP采用纵向信息和底部操作；危险确认保留底部弹层。七日逐日图使用真实数据，缺数据时不画假趋势。</p><p class="muted">本轮只有当前截图与文字提案，尚未实施任一方案。下一步先选方向，再做关键页面效果图。</p></section>'''
doc='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>APP 当前页面预览</title><style>'''+style+'''</style></head><body><header><h1>APP 当前页面预览</h1><p>7个页面 + 3个展开状态。全部重新运行当前 patient-app 源码截取。</p><p class="muted">390 × 844 手机视口，浏览器实拍；不包含 Android 原生状态栏、软键盘和系统返回行为。连接本地真实后端；仅“助手反馈”使用隔离示例响应。产品代码未修改。</p><nav><a href="#screens">查看截图</a><a href="#options">两套简短方案</a><a href="overview.png">7页总览图</a><a href="states.png">3个展开状态</a><a href="../medix-light-full-ui/index.html">对照已完成的网页</a></nav></header><main><div class="filters"><button data-filter="all" aria-pressed="true">全部 10 张</button><button data-filter="core" aria-pressed="false">7 个页面</button><button data-filter="extra" aria-pressed="false">3 个展开状态</button></div><section class="grid" id="screens">'''+''.join(cards)+'''</section>'''+proposals+'''</main><footer>每张图可打开首屏原图或完整长图。未执行用药登记、撤销、改密、自检提交或真实 AI 调用。原始演示资料与历史测试内容保持原样。</footer><script>document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('[data-group]').forEach(c=>c.hidden=b.dataset.filter!=='all'&&c.dataset.group!==b.dataset.filter)});</script></body></html>'''
(DEST/'index.html').write_text(doc,encoding='utf-8')
# Contact sheets use the exact captured viewport screenshots in ordinary HTML.
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 for subset,name,cols,title in [(screens[:7],'overview',4,'APP 当前 7 个页面'),(screens[7:],'states',3,'APP 展开状态')]:
  cards=''.join(f'<section><h2>{s["id"][:2]} · {s["title"]}</h2><img src="{(DEST/(s["id"]+".png")).as_uri()}"></section>' for s in subset)
  page=OUT/(name+'.html');page.write_text(f'<!doctype html><meta charset="utf-8"><style>*{{box-sizing:border-box}}body{{margin:0;padding:24px;background:#f6f6f6;color:#424650;font:16px "Microsoft YaHei",sans-serif}}h1{{font-size:26px;font-weight:500;margin:0 0 8px}}p{{color:#697180;font-size:14px;margin:0 0 22px}}main{{display:grid;grid-template-columns:repeat({cols},1fr);gap:20px}}section{{background:white;border:1px solid #e7e9ef;border-radius:8px;overflow:hidden}}h2{{font-size:17px;font-weight:500;margin:0;padding:12px 14px}}img{{display:block;width:100%;height:auto}}</style><h1>{title}</h1><p>当前源码浏览器实拍 · 390 × 844 · '+('助手反馈使用隔离示例响应' if name=='states' else '完整长图见预览页面')+'</p><main>'+cards+'</main>',encoding='utf-8')
  a=b.new_page(viewport={'width':1320 if cols==4 else 1200,'height':900});a.goto(page.as_uri());a.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)');a.screenshot(path=str(DEST/(name+'.png')),full_page=True);a.close()
 a=b.new_page(viewport={'width':1440,'height':1000});a.goto((DEST/'index.html').as_uri());a.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)');assert a.locator('article').count()==10
 a.get_by_role('button',name='7 个页面',exact=True).click();assert a.locator('article:visible').count()==7;a.get_by_role('button',name='3 个展开状态',exact=True).click();assert a.locator('article:visible').count()==3;a.get_by_role('button',name='全部 10 张',exact=True).click();a.screenshot(path=str(DEST/'gallery-preview.png'),full_page=True)
 a.set_viewport_size({'width':390,'height':844});assert a.evaluate('document.documentElement.scrollWidth')==390;b.close()
broken=[]
for ref in re.findall(r'(?:src|href)="([^"]+)"',doc):
 if ref.startswith(('http','#')):continue
 if not (DEST/ref).exists():broken.append(ref)
assert not broken,broken
checks={'screens':10,'page_routes':7,'source_unchanged':meta['product_source_unchanged'],'widths_valid':all(s['document_width']==390 for s in screens),'pageerrors':meta['pageerrors'],'missing_links':broken,'gallery_filters':'10/7/3 passed','native_android_verified':False,'proposals':'draft only, not implemented'}
(DEST/'preview-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
(DEST/'MANIFEST.json').write_text(json.dumps({'scope':'read-only current app visual preview','files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in DEST.iterdir() if p.is_file() and p.name!='MANIFEST.json'}},indent=2),encoding='utf-8')
print(json.dumps(checks,ensure_ascii=False))
