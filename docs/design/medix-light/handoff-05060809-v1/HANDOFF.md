# Medix Light 下一批实施交接：05 / 06 / 08 / 09

版本 v1 · 2026-11-09。用户授权编写、检查并冻结规格；本包没有执行代码改造。冻结状态以 [FREEZE.json](FREEZE.json) 为准。

## 给接手 Coding Agent

按已批准的浅色 Medix 风格实现用药计划、统计与核查、随访中心、处理任务弹窗。00–04 由另一 Agent 实施，本包承接其公共框架，不重做外壳。编号沿用截图画廊：07 是统计内的患者报告视图，本次随 06 一起覆盖，不虚构独立路由。

阅读顺序：[规则](RULES.md) → [共享接口与协作边界](INTEGRATION.md) → 四页规格 → [实施任务](IMPLEMENTATION.md) → [验收表](ACCEPTANCE.md)。此前 [00 公共系统](../handoff-0123-v1/00-SYSTEM.md) 是共享 token、尺寸、头像和主题的唯一基础。

|编号|路由或入口|本包规格|唯一构图基准|
|---|---|---|---|
|05|/plans|[用药计划](05-PLANS.md)|[批准图](references/05-plans.png)|
|06|/stats，含团队与患者报告两个页签|[统计与核查](06-STATS.md)|[最新图表版](references/06-stats-charts.png)|
|08|/followups|[随访中心](08-FOLLOWUPS.md)|[批准的彩色标签版](references/08-followups.png)|
|09|工作台/随访中心的快速处理|[处理任务弹窗](09-TASK-CLOSE.md)|[批准图](references/09-task-close-modal.png)|

图是生成的视觉目标，不是应用截图。references 是批准原图的逐字节副本；来源、校验和见 [REFERENCE-MANIFEST.json](REFERENCE-MANIFEST.json)。05/08 来源的 selection.json、06/09 来源的 FREEZE.json 是批准证据，历史 review 状态不覆盖批准结果。

## 交付边界

本包明确：页面布局、组件尺寸、色彩职责、删留文案、接口映射、状态转换、失败处理、数据口径、响应式、实施顺序和验收证据。允许为这些页面修复已识别的前端竞态和表单上下文问题；不改数据库、接口权限、任务扫描规则或临床语义。

本包文字优先于图片中的示例数字、低对比度小字、重复编号和生成瑕疵。06 的患者报告、08 的完整表单、异常状态和小屏布局是为保留现有功能补齐的工程规格，并非另有用户批准截图。

只扩展 05/06/08/09 的迁移范围。原 00–03 文档中“/plans、/stats、/followups 暂不迁移”是上一批边界，本批实施后这三条转入 medix；其他条款继续有效。04 不归本包重新定义。不要将本包理解成全仓旧文档已经全部废止。

## 当前代码事实

工程在 frontend-web，React / TypeScript / Ant Design / ECharts。读取快照见 [SOURCE-BASELINE.json](SOURCE-BASELINE.json)。此时目标页面仍使用 clinic/comfort 组件；前一 Agent 的改动可能随后进入，开工先重新核对，禁止恢复快照覆盖新代码。

运行应用端口 5180，5188 是截图画廊；后端 8010，PostgreSQL 5432。代码实施者交实际浏览器截图、API 行为证据、build/lint 结果，并更新 UI-OPTIMIZATION-LOG；不能用这些目标图代替运行验收。

本包自检见 [REVIEW.md](REVIEW.md)。后续修正规格另建 v2，保留本包和上一批只读原件。
