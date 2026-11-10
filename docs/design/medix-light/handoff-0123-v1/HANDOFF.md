# Medix Light：00–03 实施交接
版本 v1 · 2026-11-09 · 本包是可执行设计规范；程序尚未实现。归档状态以 FREEZE.json 为准。

## 给接手 Agent 的任务
在现有 React Web 项目中实现 01 登录、02 工作台、03 患者管理及其共用外壳。00 是公共规范任务，不是新增业务页面。以冻结图片为构图基准，以本包文字为最新修正；保留 API、权限和业务语义。不要重新设计整套风格。

用户已确认总体风格，并要求本包自行验收后冻结；不需要重新问用户是否使用这套风格。代码实施由用户交给另一 Agent，本会话未启动实施，也未提交代码。

## 必读顺序
1. [规则与冲突裁决](RULES.md)
2. [00 公共设计与组件](00-SYSTEM.md)
3. [01 登录](01-LOGIN.md)、[02 工作台](02-WORKBENCH.md)、[03 患者管理](03-PATIENTS.md)
4. [实施计划](IMPLEMENTATION.md)
5. [验收规范](ACCEPTANCE.md)
6. [本包文档自检](REVIEW.md)

## 唯一视觉入口
|编号|冻结图片|用途|
|---|---|---|
|01|[登录](../approved-batch-01/01-login.png)|登录布局|
|02|[工作台](../approved-batch-01/02-workbench.png)|外壳、上下内容分区、行操作|
|03|[患者管理](../approved-batch-01/03-patients.png)|筛选工具栏、头像表格、状态与图标按钮|
|06|[统计配色](../approved-charts-v2/06-stats-charts.png)|仅提供最新数据配色纪律，不实施此页|
|15|[审计减法](../approved-charts-v2/15-audit-overview.png)|仅提供单行内容与配色纪律，不实施此页|
|09|[处理任务](../approved-batch-03/09-task-close-modal.png)|02 必需弹窗的视觉参照|
|10|[补登用药](../approved-batch-03/10-medication-backfill-modal.png)|02 必需弹窗的视觉参照|

图片是生成的目标效果，非运行证据。人物、数字、日期是示意；不能写死进业务代码。早期图片中的编号列、小字及色彩冲突，按 RULES.md 处理。

## 已核对的代码基线
仓库：D:/My_Grand_Projects2026/14Day-Software-Fighter
HEAD：f26bedfe5abf0e3537f5e13063259e815aad08de
读取时已有 AGENTS.md 未提交改动；保留，不能覆盖。
前端：frontend-web。React 19、TypeScript、Ant Design 6、Router 7、ECharts 已在 package.json 中。
Vite 配置端口 5180；/api 代理到 8010。5188 是旧截图画廊，不是待验收的运行应用。
PostgreSQL 5432 由 pg_ctl 管理；出现后端 500 先检查服务，不用造假数据掩盖错误。

## 边界
可修改：本包列出的前端页面、局部样式、共享外壳、新增视觉资产及相关缺陷。
不修改：患者 App、数据库模型、API 契约、登录令牌存储方案、统计口径、其他页面内容布局。
不要为了统一外观把全局主题切换到新色后连带修改 04–15；以 medix 变体隔离迁移。
无需创建新工程、增加 UI 框架、重写鉴权或重新绘制全部图表。
不得把整张效果图当背景覆盖真实 UI。

## 交付约定
按 00→01→02→03 顺序完成；每项给实际浏览器截图和功能证据。最后交 build/lint 输出、改动文件表、缺陷状态和验收报告。技术通过与用户视觉认可分开写。
下一次修改规范必须新建 v2，本包不得原地改写。

