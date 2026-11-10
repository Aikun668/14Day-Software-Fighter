from pathlib import Path
import json,shutil,hashlib
root=Path.cwd();final=root/'docs/evidence/medix-light-implementation-final-v1';final.mkdir(exist_ok=True)
files=[p for p in (root/'frontend-web/src').rglob('*') if p.is_file()]
files += [root/'frontend-web'/s for s in ['package.json','pnpm-lock.yaml','index.html','vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json','.oxlintrc.json','.env.example']]
hashes={}
for p in files:
 rel=p.relative_to(root);target=final/'source-snapshot'/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target);hashes[rel.as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
(final/'source-hashes.json').write_text(json.dumps(hashes,indent=2),encoding='utf-8')
(final/'HANDOFF.md').write_text('''# Medix Light 已实现代码总交接 v1

日期：2026-11-10。范围：00公共系统、01–15全部页面/弹窗。

## 当前入口与权威

1. 实际产品在项目 `frontend-web`。本目录 `source-snapshot/frontend-web` 是本次整体收尾的完整前端源码与配置快照，不含node_modules、密钥或后端数据。
2. [全站画廊](../medix-light-full-ui/index.html) 是各批最终代码实拍，包含15张；00是公共系统，不单列截图。07独立存在，不与06共用截图。
3. [设计总HANDOFF](../../design/medix-light/handoff-final-v2/HANDOFF.md) 与各冻结图继续约束视觉。它们是当时的设计交付，描述“尚未实现”的历史状态不代表现在。
4. 本交接和四份实施验收记录说明已落实的接口、交互与必要差异。旧批源码快照只能用于回溯，不能整包覆盖当前代码。修改冻结目标须另建版本；不覆盖已批准图。
5. 00–11已获用户批准。12–15独立子Agent验收通过，用户视觉确认待后续反馈。旧包里的pending是封包时状态，保留历史原件，通过本总表更新当前状态。

## 页面到代码

路径相对快照 `frontend-web/src`。

|编号|页面/路由|主要代码与职责|
|---|---|---|
|00|公共外壳/组件|components/medix/MedixLayout.tsx、Medix.tsx、ClinicalUI.tsx、clinical.ts、useClinicalQuery.ts；styles/medix-light.css与medix-theme.ts|
|01|/login|pages/auth/LoginPage.tsx；真实登录、角色去向、首次改密|
|02|/workbench|pages/clinician/WorkbenchPage.tsx；趋势、关注患者、待核查、共享弹窗入口|
|03|/patients|PatientListPage.tsx；服务端搜索/分页、建档/评估、写实演示头像|
|04|/patients/:id|PatientDetailPage.tsx；摘要、七日矩阵、任务与账号绑定|
|05|/plans|PlanEditPage.tsx；患者/型号选择、新建与历史版本、生效区间|
|06|/stats团队|StatsPage.tsx；团队趋势/分布、登记口径与核查|
|07|/stats患者报告|StatsPage.tsx内患者模式；独立报告、来源/重复核查/随访摘要|
|08|/followups|FollowupPage.tsx；核查队列、完整随访、历史记录|
|09|处理任务弹窗|components/TaskCloseModal.tsx；全视口居中，提交锁与未知结果核对|
|10|补登弹窗|components/MedicationBackfillModal.tsx；真实时点、历史计划、PRN、上海时间|
|11|/admin?tab=model|pages/admin/DeviceModelsPanel.tsx；型号分页、新建|
|12|/admin?tab=guide|ContentPanel.tsx kind=guide；指导新建、查看、全文审核、确认发布|
|13|/admin?tab=user|AccountsPanel.tsx；账号分页、新建、启停、一次性密码结果|
|14|/admin?tab=kb|ContentPanel.tsx kind=kb；知识新建、完整片段、审核发布、安全来源|
|15|/admin?tab=audit|AuditPanel.tsx、auditData.ts；完整区间读取、两幅图、分组事件和只读详情|

## 不要破坏的实现约束

- 公共颜色/字体走token与rem；根rem保持16px。沿用本地Noto字体，不导入旧主题。平面行与细分隔线，不再套灰色子卡。
- `PatientAvatar`优先真实照片。演示人像来自已批准虚构素材；无照片真实用户用中性图标。禁止为真实用户按姓名随机配脸。
- `useClinicalQuery`把请求身份、Abort与状态绑定，切患者/时间/页码不能显示上一份响应。错误不是零值，不显示虚假成功。
- 登记覆盖不是实际服药依从性。保留未知值、历史版本与真实slot/plan归属；不据UI修改临床规则。
- 管理端按页面独立请求。AdminRoute处理合法tab/角色；AdminNavigation放在Routes外，锁定进行中的管理端写入与一次性密码结果，不能改回仅阻止侧栏。
- `useAdminAction`区分已知拒绝、未知结果、成功写入后的读取失败。不要把刷新按钮接成第二次POST。临时密码只在内存里等用户点完成，不能放toast、URL、存储、日志或截图。
- 12没有单条指导GET；当前页重读并按ID查找，找不到要求刷新。14有单条详情GET。审核前重读并比较完整内容，不审核用户未读的新版本。
- 15只用后端实际支持的审计GET分页。没有date/action聚合参数，也没有账号管理审计动作；未知类别为其他。首尾/总量/顺序/重复校验不通过则不画全量图。
- 审计单轮最多48个100条数据页，加最多2次首尾校验；低于原规格50请求/5000条上限。并发变化整轮重试一次，仍变动则提示重试；不宣称数据库快照。
- 按日统计必须一次聚合，缓存上海日期格式器；不要恢复按天扫描全部事件并不断新建Intl格式器。柱顶标签按可用宽度隐藏，精确数值保留tooltip和展开表。

## 运行与验收

从项目根目录运行：

```powershell
pnpm --dir frontend-web install --frozen-lockfile
pnpm --dir frontend-web dev --host 127.0.0.1 --port 5180 --strictPort
pnpm --dir frontend-web build
pnpm --dir frontend-web lint
```

后端8010、PostgreSQL5432仍使用原项目。快照没有后端或账号凭据，不是脱离项目即可登录的独立演示服务。

仅看截图：直接打开相邻全站画廊index.html，不需要服务。源码运行与静态画廊不是同一种验证。

本轮实际结果：build通过；lint4条既有警告、0错误；大bundle提示保留。12项交互、16项边界、90天/3000条图表、桌面/手机、真实后端只读检查通过。真实业务没有被测试写入。

[12–15验收与限制](../medix-12131415-alignment-v1/ACCEPTANCE.md) · [整体报告](DELIVERY.md)
''',encoding='utf-8')
(final/'DELIVERY.md').write_text('''# 全部页面实施收尾

01–15已完成代码与实拍，00公共系统已接入。07独立交付，09位于整个视口中央。当前四个实施包保持原件，整体代码以本目录完整快照为准。

|范围|当前状态|证据|
|---|---|---|
|00–03|用户已通过|[第一批](../medix-0123-alignment-v1/index.html)|
|04–07|用户已通过|[第二批](../medix-04050607-alignment-v1/index.html)|
|08–11|用户已通过|[第三批](../medix-08091011-alignment-v1/index.html)|
|12–15|独立验收通过；用户视觉确认待反馈|[最后一批](../medix-12131415-alignment-v1/index.html)|

本轮独立子Agent退回了完整路由退出保护、分页回退、刻度字号和手机大数值裁切，修复后复测通过。补测长区间性能并修复按日重复扫描。未关闭的P0/P1/P2为0。

12项交互、16项边界、90天/3000条图表检查通过，真实后端四页只读通过；JS页面异常0。1440/1280/390均有实拍，390根页面没有横向溢出，宽表在内部横滚。旧01–11画廊图片11张哈希不变；53个已有源文件/素材未改。11重拍逐像素一致，09中心回归通过。

工程：build通过，lint4条既有警告/0错误。原设计103个冻结条目核验通过。构建大bundle提示仍在，未为此扩大重构。测试写操作均由隔离fixture接收，真实后端仅登录/读取/退出。

验收口径：不声明所有图片逐像素100%相同，不伪造账号审计数据，不以独立Agent签字代替用户视觉批准。真实账号无照片时中性占位。历史包里的待验状态是当时记录，不改历史文件；当前状态以本表为准。

交付包括：15图全站画廊、四个验收包、本次完整前端快照、逐文件SHA256、设计原件、总HANDOFF及可离线打开的HTML入口。最终压缩包在docs/evidence目录，附SHA256文件；zip校验清单见delivery-checks.json。

[全站画廊](../medix-light-full-ui/index.html) · [代码交接](HANDOFF.md) · [最后一批独立复验](../medix-12131415-alignment-v1/INDEPENDENT-REVIEW.md)
''',encoding='utf-8')
names=['01-login','02-workbench','03-patients','04-patient-detail','05-plans','06-stats','07-patient-report','08-followups','09-task-close-modal','10-medication-backfill-modal','11-admin','12-admin-guides','13-admin-accounts','14-admin-knowledge','15-admin-audit']
titles=['登录','工作台','患者管理','患者详情','用药计划','团队统计','患者报告','随访中心','处理任务','补登用药','装置型号','指导版本','账号管理','知识内容','审计日志']
cards=''.join(f'<a href="../medix-light-full-ui/{n}.png"><img src="../medix-light-full-ui/{n}.png" alt="{t}"><strong>{n[:2]} · {t}</strong></a>' for n,t in zip(names,titles))
(final/'index.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Medix Light 整体实施交付</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f6f6;color:#424650;font:16px/1.7 "Microsoft YaHei",sans-serif}header,main{max-width:1440px;margin:auto;padding:28px}h1{font-size:26px;font-weight:500}p{margin:10px 0}nav{display:flex;gap:18px;flex-wrap:wrap}a{color:#7340d4}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}section a{display:block;background:white;border-radius:8px;overflow:hidden;text-decoration:none}img{display:block;width:100%;height:auto}strong{display:block;padding:12px 16px;font-weight:500}@media(max-width:700px){header,main{padding:16px}section{grid-template-columns:1fr}}</style><header><h1>Medix Light · 全部页面实施交付</h1><p>00公共系统 + 01–15页面与弹窗，已全部落实到代码。07单独列图，09全视口居中。</p><p>00–11用户已通过；12–15独立Agent复验通过，用户视觉确认待反馈。本次构建通过、lint4警告/0错误。</p><nav><a href="HANDOFF.md">代码总交接</a><a href="DELIVERY.md">整体报告</a><a href="../medix-12131415-alignment-v1/index.html">12–15逐页对照</a><a href="../medix-light-full-ui/index.html">原全站画廊</a><a href="source-hashes.json">源码校验</a><a href="delivery-checks.json">交付校验</a></nav></header><main><section>'''+cards+'''</section><p>图片为代码实拍，演示数据与真实后端实拍分别存档。完整前端快照位于source-snapshot/frontend-web，历史批次快照不覆盖当前版本。</p></main></html>''',encoding='utf-8')
print('Full frontend snapshot files',len(files))
