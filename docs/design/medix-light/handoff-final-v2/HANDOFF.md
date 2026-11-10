# Medix Light 整体交付与最后一批实施入口

版本 v2 · 2026-11-09。交付类型：设计规格、Coding Agent 实施交接与文档终验。本版补回07独立效果图、独立规格及独立验收，替代v1作为当前总入口；v1保留历史。程序实现不在本轮执行范围。

## 接手 Agent 先读

1. [全页登记与规则优先级](PAGE-REGISTRY.md)：00–15 每项唯一入口；07虽共用/stats路由，必须单独设计、拍图和验收。
2. [本包规则与冲突裁决](RULES.md)，再读 [00 公共设计系统](../handoff-0123-v1/00-SYSTEM.md)。
3. 按负责范围读页面规格，不从历史review目录自行选图。
4. [实施计划](IMPLEMENTATION.md) → [整体验收](ACCEPTANCE.md) → [文档终验报告](REVIEW.md)。

|本包交付|入口|
|---|---|
|04 患者详情补充契约，实施仍归原Agent|[04-PATIENT-DETAIL](04-PATIENT-DETAIL.md)|
|07 患者报告独立交付，本次补齐|[07 HANDOFF](../handoff-07-v1/HANDOFF.md)、[07效果图](references/07-patient-report.png)|
|10 补登用药，共享于02/04|[10-BACKFILL](10-BACKFILL.md)|
|管理端外壳、五页导航、状态与数据模式|[ADMIN-SYSTEM](ADMIN-SYSTEM.md)|
|11 装置型号|[11-DEVICES](11-DEVICES.md)|
|12 指导版本|[12-GUIDES](12-GUIDES.md)|
|13 账号管理|[13-ACCOUNTS](13-ACCOUNTS.md)|
|14 知识内容|[14-KNOWLEDGE](14-KNOWLEDGE.md)|
|15 审计日志与图表|[15-AUDIT](15-AUDIT.md)|

前两批冻结包继续有效：[00–03](../handoff-0123-v1/HANDOFF.md)、[05/06/08/09](../handoff-05060809-v1/HANDOFF.md)。其中06内患者报告布局由[07独立规格](../handoff-07-v1/07-PATIENT-REPORT.md)替代，06的数据口径继续有效。本包不改旧原件。旧规则中“后续页面继续旧主题”是当时批次限制，后续范围按各包接入medix。

## 任务交给谁、改到哪里

00–04已由用户交另一Agent实施；本包04用于核对功能和视觉映射，10为共享组件详细契约。不得拿这里的代码阅读快照回滚对方正在完成的代码。02/04只需要核对共享10接口与本包明确的跨页修正。

最后一批主要改 frontend-web/src/pages/admin/AdminPage.tsx 及其拆分后的管理端子视图、MedicationBackfillModal、局部样式和管理导航。继续使用React、TypeScript、Ant Design、ECharts、apiFetch。不要创建新工程，不改鉴权、数据库和患者App。

审计图数据由现有接口真实记录派生，详见15；不虚构日期查询参数、账号操作审计或全量统计接口。必要的后端缺口单独记录，不在视觉改造中悄悄改业务。

## 图与冻结状态

references中保存8张图的逐字节副本。07为本次image_gen新生成并局部修正的独立效果图，代理静态自检通过、用户已明确批准，见[批准记录](../handoff-07-v1/APPROVAL.md)。04/10/11/12/15有既有批准记录；13/14仍标“留存参考图”。归档和文档冻结不等于图片获用户批准。后续修改另存版本，不覆盖历史。

最新15图替代旧纯文字审计表目标；最新06仍由前一包指定。生成图里的乱码厂商、固定日期、数字和示例姓名不是数据权威。

查看 [REFERENCE-MANIFEST.json](REFERENCE-MANIFEST.json)、[SOURCE-BASELINE.json](SOURCE-BASELINE.json)、[FREEZE.json](FREEZE.json)。只读属性防误覆盖，SHA256用于检测变动；修订另存版本。

[逐张视觉清单](VISUAL-INVENTORY.json)登记01–15每张图、独立规格及审批状态；避免只检查编号、漏查图片。

## 完成定义

本版补齐了07独立设计交付缺口；图片已提交用户查看，已获得用户明确通过并按本版归档。接手Agent还须实施、build/lint、真实浏览器截图、接口交互和权限回归，07必须单独截图，按ACCEPTANCE交证据。不得再以路由共用为由跳过07视觉验收。
