# 全页规格登记与旧文档替换范围

这是v2总入口的唯一编号表；编号沿用截图集合，不等于路由数量。00是系统，07与06共用路由但独立设计/验收，09/10是共享弹窗，11–15是/admin的五个视图。

|编号|对象/入口|唯一实施规格|目标图|
|---|---|---|---|
|00|公共框架|[00](../handoff-0123-v1/00-SYSTEM.md) + [最终规则](RULES.md)|各页共同外壳|
|01|/login|[01](../handoff-0123-v1/01-LOGIN.md)|[01图](../approved-batch-01/01-login.png)|
|02|/workbench|[02](../handoff-0123-v1/02-WORKBENCH.md) + 最终日期修正|[02图](../approved-batch-01/02-workbench.png)|
|03|/patients|[03](../handoff-0123-v1/03-PATIENTS.md)|[03图](../approved-batch-01/03-patients.png)|
|04|/patients/:id|[04补充契约](04-PATIENT-DETAIL.md)，原Agent实施|[04图](references/04-patient-detail.png)|
|05|/plans|[05](../handoff-05060809-v1/05-PLANS.md)|[05图](../handoff-05060809-v1/references/05-plans.png)|
|06|/stats团队概览|[06](../handoff-05060809-v1/06-STATS.md)|[最新06](../handoff-05060809-v1/references/06-stats-charts.png)|
|07|/stats患者报告页签|[07独立规格](../handoff-07-v1/07-PATIENT-REPORT.md)、[独立验收](../handoff-07-v1/ACCEPTANCE.md)|[07新图，用户已确认](references/07-patient-report.png)|
|08|/followups|[08](../handoff-05060809-v1/08-FOLLOWUPS.md)|[彩标08](../handoff-05060809-v1/references/08-followups.png)|
|09|处理任务|[09](../handoff-05060809-v1/09-TASK-CLOSE.md)|[09图](../handoff-05060809-v1/references/09-task-close-modal.png)|
|10|补登用药|[10](10-BACKFILL.md)|[10图](references/10-medication-backfill-modal.png)|
|11|/admin?tab=model|[11](11-DEVICES.md)|[11图](references/11-admin-devices.png)|
|12|/admin?tab=guide|[12](12-GUIDES.md)|[12图](references/12-admin-guides.png)|
|13|/admin?tab=user|[13](13-ACCOUNTS.md)|[13留存参考](references/13-admin-accounts.png)|
|14|/admin?tab=kb|[14](14-KNOWLEDGE.md)|[14留存参考](references/14-admin-knowledge.png)|
|15|/admin?tab=audit|[15](15-AUDIT.md)|[最新15](references/15-audit-overview.png)|

## 旧文件怎么用

|来源|保留价值|不得再用于|
|---|---|---|
|根目录DESIGN.md、UI_DESIGN.md、PRODUCT.md|业务对象、已有流程；与后端矛盾时核实|本表覆盖范围的视觉token/旧大标题/编号小字/布局。|
|prototype/styles.css、旧theme.ts、clinic组件|未迁移页面兼容与历史实现|作为medix唯一设计权威或全局强制套用。|
|approved-batch-02/06-stats.png|旧矩阵方案历史|06主屏；矩阵功能在登记明细入口保留。|
|review-charts-v1、review-batch-04/15-admin-audit.png|历史提案与出处|覆盖最新06/15图表和减法规则。|
|review-batch-04/13、14|原图来源|伪称已有独立逐张批准；实现准则以本包文字为准。|
|前包00的“后续不迁移”、02本地日期|历史批次边界|限制本次全部覆盖或使用浏览器时区构造业务窗口。|
|v1总包称07无独立新图、06患者报告布局段|保留历史交付记录，数据口径仍有效|不能再作为跳过07出图或独立验收的依据；07以新独立包为准。|

不删除旧文件，以版本化裁决消除实施冲突；不要让Coding Agent从多个文档“任选喜欢的风格”。本表覆盖现有Web截图集合，不声称患者App、/change-password等未设计流程已经全部改版；改密必须回归可达。

## 共享组件唯一所有权

|组件|首次负责范围|本批补充|集成要求|
|---|---|---|---|
|medix shell、token、头像、资产|00–04|ADMIN-SYSTEM扩管理菜单|一个WebLayout/局部主题，不双份外壳。|
|TaskCloseModal|02|09详细行为|02/08共用，补类型参数兼容旧调用。|
|MedicationBackfillModal|02/04|10详细行为|一个组件，两个调用者分别回归。|
|图表与状态格|00/04/06|15审计使用ECharts|保留默认调用兼容；临床百分比与审计次数不共用误导口径。|
|临时密码结果展示|03/04绑定、13创建|13定义单次展示|复用已存在等价组件，不修改令牌存储。|

实施顺序：先00外壳 → 01/02/03/04 → 05/06/08/09 → 10共享补齐 → 管理外壳与11–15 → 全链路回归。既有已完成实现不必重做；按当前差异补齐。共享文件一次只有一个修改归属，其他页面先写内部逻辑，集成时再改路由/外壳。
