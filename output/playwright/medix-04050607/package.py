from pathlib import Path
import shutil,json,hashlib,html
root=Path.cwd();out=root/'output/playwright/medix-04050607';dest=root/'docs/evidence/medix-04050607-alignment-v1';gallery=root/'docs/evidence/medix-light-full-ui'
names=['04-patient-detail','05-plans','06-stats','07-patient-report']
# Keep snapshots and manifests self-contained; original design freezes remain untouched.
for f in out.glob('*.png'):shutil.copy2(f,dest/f.name)
for f in out.glob('*checks.json'):shutil.copy2(f,dest/f.name)
shutil.copy2(out/'preserved-0123.json',dest/'preserved-0123.json')
for n in names:shutil.copy2(dest/(n+'.png'),gallery/(n+'.png'))
p=gallery/'index.html';s=p.read_text(encoding='utf-8-sig')
s=s.replace('00–03 产品代码与截图已在本轮校准。','00–07 产品代码与截图已分批校准；00为公共框架，不单列页面图。')
s=s.replace('04 docs/evidence/medix-0123/screenshots/04-patient-detail-still-comfort-mock.png','04 docs/evidence/medix-04050607-alignment-v1/04-patient-detail.png').replace('05 docs/evidence/medix-05060809/screenshots/05-plans-1440.png','05 docs/evidence/medix-04050607-alignment-v1/05-plans.png').replace('06 docs/evidence/medix-05060809/screenshots/06-stats-1440.png','06 docs/evidence/medix-04050607-alignment-v1/06-stats.png').replace('07 docs/evidence/medix-final/screenshots/07-patient-report-1440.png','07 docs/evidence/medix-04050607-alignment-v1/07-patient-report.png')
s=s.replace('07 使用 medix-final 的独立截图，不复用 06-stats-report-1440.png。','07 使用本轮独立浏览器截图，不复用06。')
s=s.replace('00–03 本轮对齐已完成：写实头像、本地黑体、公共外壳与排版。01–03 为最新浏览器实拍；04–15 保留此前批次，未计入本轮验收。','00–03 已获用户通过；04–07 本轮代码和实拍已对齐冻结目标，独立子 Agent 复验通过。08–15 保留此前批次，尚未计入本轮代码验收。')
s=s.replace('<span>00–03 独立子 Agent 视觉复验通过</span>','<span>00–03 用户已通过 · 04–07 子 Agent 复验通过</span>')
s=s.replace('查看目标对照与验收记录','00–03 对照与验收记录')
s=s.replace('<span>1440 桌面主图</span>','<span><a href="../medix-04050607-alignment-v1/index.html">04–07 对照与验收记录</a></span><span>1440 桌面主图 · 另附390/1280实拍</span>')
for n in names:
 s=s.replace(f'class="shot tall" href="{n}.png"',f'class="shot revised" href="{n}.png"').replace(f'class="shot" href="{n}.png"',f'class="shot revised" href="{n}.png"')
s=s.replace('仍是 Clinic Comfort 页，未按 Medix 冻结稿重做。问候、四格摘要、近 7 日时点。','写实头像、三段摘要、七日登记矩阵、轻量待办；本轮代码实拍。')
s=s.replace('medix-final 独立截图。李先生 85.7%，未登记时点、来源、随访摘要、重复登记。','本轮独立实拍：85.7% 登记覆盖、未登记时点、来源、随访摘要、重复核查。')
s=s.replace('  .shot.revised .thumb::after { display: none; }','  .shot.revised .thumb::after { display: none; }\n  .shot.revised[href="07-patient-report.png"] .thumb { aspect-ratio: 1440 / 1112; }')
p.write_text(s,encoding='utf-8')
# Preservation checks cover the approved batch and still-unmodified later images.
keep={}
for f in gallery.glob('*.png'):
 if f.stem not in names:keep[f.name]=hashlib.sha256(f.read_bytes()).hexdigest()
old=json.loads((root/'docs/evidence/medix-0123-alignment-v1/unchanged-gallery.json').read_text(encoding='utf-8-sig'))
for n,sha in keep.items():
 if n[:2] in ['01','02','03']:assert sha==hashlib.sha256((root/'docs/evidence/medix-0123-alignment-v1'/n).read_bytes()).hexdigest()
 elif n in old:assert sha==old[n]
(dest/'unchanged-gallery.json').write_text(json.dumps(keep,ensure_ascii=False,indent=2),encoding='utf-8')
rows=[]
for n,title in zip(names,['04 患者详情','05 用药计划','06 团队统计','07 患者报告']):
 prefix=n[:2];rows.append(f'''<section><h2>{title}</h2><a href="{n}.png">打开完整实拍</a> · <a href="{n}-live.png">真实后端</a><a href="compare-{n}.png"><img src="compare-{n}.png" alt="{title} 左冻结目标右当前实拍"></a><details><summary>1280 / 390 响应式</summary><div class="responsive"><a href="{prefix}-1280.png"><img loading="lazy" src="{prefix}-1280.png" alt="1280实拍"></a><a href="{prefix}-390.png"><img loading="lazy" src="{prefix}-390.png" alt="390实拍"></a></div></details></section>''')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Medix Light 04–07 对齐验收</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f6f6;color:#424650;font:16px/1.7 "Microsoft YaHei",sans-serif}header,main{max-width:1500px;margin:auto;padding:24px}h1{font-size:24px;font-weight:500}h2{font-size:20px;font-weight:500}p{margin:8px 0}a{color:#7340d4}section{margin:28px 0;padding:20px;background:white;border-radius:8px}section>a>img{display:block;width:100%;height:auto;margin:12px 0}.responsive{display:grid;grid-template-columns:3fr 1fr;gap:16px;align-items:start}.responsive img{width:100%;height:auto}summary{cursor:pointer}nav{display:flex;gap:20px;flex-wrap:wrap}.note{color:#697180}@media(max-width:700px){header,main{padding:12px}section{padding:12px}.responsive{grid-template-columns:1fr}}</style><header><h1>04–07 代码对齐与验收</h1><p>独立子 Agent 复验通过；00–03 已批准文件保持不变。</p><p class="note">对照图左为冻结目标，右为实际浏览器。数据、日期、状态名依接口及已确认契约；不使用生成图代替产品截图。</p><nav><a href="../medix-light-full-ui/index.html">全站画廊</a><a href="ACCEPTANCE.md">验收报告</a><a href="interaction-checks.json">交互检查</a><a href="stress-checks.json">边界检查</a><a href="live-checks.json">真实后端检查</a></nav></header><main>'''+''.join(rows)+'''<section><h2>边界与错误状态</h2><p><a href="04-multi-slot.png">同刻多计划</a> · <a href="04-account-password.png">一次性密码</a> · <a href="04-record-pagination.png">登记分页</a> · <a href="06-no-due.png">无到期时点</a> · <a href="06-mismatch.png">数据不一致</a> · <a href="07-many-missing.png">大量未登记</a> · <a href="07-partial-failure.png">报告局部失败</a> · <a href="07-390-data-table.png">手机完整数据表</a></p><p class="note">主图及写入交互使用隔离演示数据。真实后端只做登录、读取和退出。所有照片为已批准的虚构演示头像；非演示患者无照片时使用中性人物占位。</p></section></main></html>'''
(dest/'index.html').write_text(page,encoding='utf-8');print('Evidence copied; gallery 04-07 updated; other image hashes preserved:',len(keep))
