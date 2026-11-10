# Medix Light 00–03 设计验收

final result: passed

本轮完成公共外壳、登录、工作台、患者管理的代码校准。独立子Agent已退回两类主要问题并复验通过；本结论不替代用户最终确认。

## 视觉基准与实拍

- Source visual truth：`docs/design/medix-light/approved-batch-01/01-login.png`、`02-workbench.png`、`03-patients.png`，原始1586×992。
- 实拍：`docs/evidence/medix-0123-alignment-v1/01-login.png`、`02-workbench.png`、`03-patients.png`，Chrome1440×900、DPR1。
- 归一：目标按1440/1586等比缩放（高度约900.7），对照图左右各显示720宽；原比例局部见focus图。
- State：医护登录、1位关注/7条任务、10位患者。固定虚构头像按演示patient_code映射。正式列表仍使用20条服务端分页；另外验证25条、多任务、长名和同名。
- 文字条款优先：隐藏编号/解释、青绿杏色状态、N=0无到期时点。日期、数据及文案差异不按像素错误处理。

|检查面|结果|证据|
|---|---|---|
|字体/层级|通过。实际加载本地Noto Sans SC，正文17、标题22、区块/导航18，均rem token|focus-01-login.png、focus-03-patients.png、font-checks.json|
|布局/间距|通过。240侧栏/80顶栏，白表20内距、56行高，7条队列首屏完整|checks.json、compare-02-workbench.png|
|颜色/token|通过。浅灰画布白外壳、紫主动作、灰行操作，非全紫状态格|compare-02-workbench.png、compare-03-patients.png|
|资产/画质|通过。写实头像固定映射、完整头部、3D插画、透明品牌资产；非演示无图用中性人物|03-patients.png、03-no-demo-portraits.png|
|业务文案|通过。无姓名蓝点/编号列/冗余解释；N=0和失败分别呈现|02-no-due.png、02-stats-failure.png|

所有对照证据均在 [验收目录](docs/evidence/medix-0123-alignment-v1/index.html)。三张compare图为同一画面内左右组合，不用分别查看冒充并排比较。focus图检查表头、姓名、操作与登录标签。

## 比较历史

1. 原预览：P1头像/插画/表格贴边；P2导航过密、细小字号、搜索和密码高度不一。已修；原始图存before。
2. 第一轮实现：P1字体观感不符；P2无到期时点语义、头像回退fixture、悬停残留。已修；证据存iteration-1。
3. 第二轮：独立Agent逐张检查主图、局部、1280/390后通过；字体子集分发后再次打开最新组合图和局部确认无回退。

## 实际操作与检查

浏览器回归覆盖：登录必填/错误、角色及首次改密去向、服务端搜索/组合筛选、25条分页、第二页建档后回第一页、现场评估型号/指导不同ID提交、切型号清旧指导、关闭指定task并刷新、补登弹窗可达、状态失败、N=0、同名多任务、手机抽屉、局部横滚。

真实8010后端验证登录、读取两页、退出，10位种子演示患者显示固定写实头像。写操作使用隔离fixture。未捕获JavaScript异常为0；故意触发的HTTP错误作为异常态验证。

工程检查：build通过，lint为11条既有文件警告、0错误；当前改动文件没有新增lint警告。最终记录见验收目录的build.log、lint.log。

## P3与限制

登录按钮字重略重，品牌/少数导航图标轮廓与生成图并非逐像素一致。人像为新生成演示素材。保留这些微小差别，不声明100%像素一致。04–15不属于本轮验收。

# Medix Light 04–07 设计验收 · 2026-11-09

final result: passed (independent agent review; awaiting user visual confirmation)

04患者详情、05用药计划、06团队统计、07患者报告已按各自冻结图实现。桌面、1280和390实拍均经独立子Agent查看。首轮布局/数据边界问题及第二轮手机图表标签碰撞已修复；当前无需退回的P0/P1/P2。00–03已由用户批准，本轮未改变其页面/样式/素材。

完整对照、退回记录、行为边界和实际检查见 [04–07验收报告](docs/evidence/medix-04050607-alignment-v1/ACCEPTANCE.md)；图见 [对照画廊](docs/evidence/medix-04050607-alignment-v1/index.html)。写操作仅使用隔离fixture；真实后端只读验证与用户批准分别记录，未冒充同一验收。

# Medix Light 08–11 设计验收 · 2026-11-10

final result: passed (independent agent review; awaiting user visual confirmation)

08随访中心、09处理任务、10补登用药、11装置型号完成本轮代码对齐。09覆盖旧图偏上构图，按整个viewport居中；稳定桌面和手机实测误差<0.01px。08手机操作可见，09/10恢复清晰遮罩与多行输入；逐项修复未知结果误判、上下文切换、时点归属和Radio提交锁。最后一次子Agent复验P0/P1/P2均为0。

18项交互、10项边界、真实后端只读均通过；build通过，lint 5条既有警告/0错误。43个原有源文件/素材保持不变；02/04只补共享弹窗元数据。画廊仅替换08–11，其余11张图哈希不变。设计冻结103条目完整。本轮用户批准尚待确认，00–07已获用户通过。

完整证据：[08–11验收目录](docs/evidence/medix-08091011-alignment-v1/index.html)、[验收报告](docs/evidence/medix-08091011-alignment-v1/ACCEPTANCE.md)、[独立复验](docs/evidence/medix-08091011-alignment-v1/INDEPENDENT-REVIEW.md)。


# Medix Light 12–15 与整体收尾 · 2026-11-10

final result: passed (independent agent review; awaiting user visual confirmation for 12–15)

12指导、13账号、14知识、15审计已完成。独立Agent逐页检查1440/1280/390并另行复测连续后退、分页缩减、手机3000条以及90天/3000条统计一致性。所有退回项关闭，P0/P1/P2均0。日期浮层已收起后重拍长区间证据。

12项交互、16项边界、长区间密度、真实后端只读通过。build通过；lint4条既有警告/0错误。原设计103条目完整，53个原有源码/素材与01–11画廊11张图片不变。11重拍逐像素一致，09全视口居中回归通过。

00–11用户已通过，历史包保留封包时状态；12–15用户最终视觉确认待反馈。全部01–15实拍和00公共框架由[整体交付](docs/evidence/medix-light-implementation-final-v1/index.html)统一索引，当前完整源码快照优先于历史批次快照。
