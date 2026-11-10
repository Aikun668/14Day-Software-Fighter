# 下一批四页 Implementation Plan

> For agentic workers: 使用 superpowers:executing-plans 逐任务执行。当前交付只包含规格，代码由用户指定的 Coding Agent 实施。

**Goal:** 将05/06/08/09落地到已有应用，保持批准的浅色设计与真实业务逻辑。

**Architecture:** 复用00–04的局部 medix 主题与共享组件；三个页面保留各自请求状态，09共享一个弹窗。纯日期/比例/状态转换集中在小型模块，使用现有API，不重建业务后端。

**Tech Stack:** React、TypeScript、Ant Design、ECharts、dayjs、现有 apiFetch。

**Spec:** [HANDOFF](HANDOFF.md)、[RULES](RULES.md)、四份页面规格与 [INTEGRATION](INTEGRATION.md)。文件路径以下均相对仓库根。

## Global Constraints

- 字号 token + rem，html 不设字号；不嵌套内容卡。
- 蓝趋势、青绿登记、杏色未发现登记；紫为品牌/选中/主操作。
- N=0不等于无计划，登记覆盖不等于实际服药依从性。
- 日期按上海业务时区；统计API左闭右开，最大92日。
- 不覆盖00–04新代码，不改全局theme或权限，不添加图表框架。

## Review Focus

1. 慢请求与跨患者/日期切换：最终只渲染当前上下文，测试归任务1/2/3。
2. 首50/100条不等于全量：total/分页真实，任务1/2/3覆盖。
3. N=0、M=0、M>N与重复事件：任务2分别验证，不能统一画0%。
4. 写入成功但响应/刷新失败：任务3/4验证不自动重发，保存与刷新状态独立。
5. 共享弹窗portal主题与02回归：任务4/5实际浏览器验证。

## Task 0：确认共享基线

**读取/有限集成：** frontend-web/src/App.tsx、frontend-web/src/components/WebLayout.tsx、frontend-web/src/styles/medix-light.css、frontend-web/src/styles/medix-theme.ts、frontend-web/src/components/TaskCloseModal.tsx、frontend-web/src/components/CoverageTrendChart.tsx。medix 文件若由前批新建，以落地后的实际位置为准。

- [ ] 阅读本包与00公共规范，检查git diff，记录00–04已实现的组件接口；禁止恢复SOURCE-BASELINE中的旧内容。
- [ ] 确定09已有实现的唯一修改位置；共享文件尚在改动时先做页面内部工作，待其落地再集成。
- [ ] 创建本批局部样式入口和纯转换模块；保留旧主题分支。

完成证据：记录共享组件实际路径、调用签名和冲突处理，不用另一个demo壳绕过。

## Task 1：05 表单与计划历史

**Modify:** frontend-web/src/pages/clinician/PlanEditPage.tsx。
**Create/reuse:** frontend-web/src/components/medix/DailyTimesEditor.tsx、frontend-web/src/pages/clinician/medixClinicalModel.ts、frontend-web/src/styles/medix-clinical.css。
**Produces:** derivePlanPhase(plan:{starts_at:string;ends_at:string|null}, now:number):'pending'|'active'|'ended'|'invalid'；DailyTimesEditor value/onChange。

- [ ] 先用可复现fixture记录原错误：未来ends_at被标关闭、A慢B快串数据、PRN残留时点；这些是修复前后的行为用例，不新建CSS镜像测试。
- [ ] 实现两列布局、时点编辑器与日期序列化，所有字段映射按05规格。
- [ ] 加受控患者选择、状态重置、请求序号、分页、独立错误与提交锁。
- [ ] 验证未来开始pending、未来结束active、边界now=end为ended、非法区间invalid；验证上海同日起止转换成24小时区间。
- [ ] 浏览器验证REGULAR/PRN真实请求体、创建失败不清输入、成功后历史刷新，保存05证据。

完成后只提交/记录本任务相关文件；是否git commit遵循用户当前工作方式，不能把别的Agent文件一并提交。

## Task 2：06 图表与保留的核查功能

**Modify:** frontend-web/src/pages/clinician/StatsPage.tsx。
**Create/reuse:** frontend-web/src/components/medix/RegistrationCharts.tsx、medixClinicalModel.ts、局部样式；CoverageTrendChart若改只增加兼容变体。
**Produces:** makeStatsWindow(startDay:string,inclusiveEndDay:string):{from:string;to:string}（非法或>92日抛可呈现校验错误）；aggregateDailyCoverage(matrix):{day:string;N:number;M:number;coverage_rate:number|null}[]。

- [ ] 固定数据用例：A1/1+B1/9应20%；N0→null；M0/N2→0%；M3/N2→异常；11/02—11/08→to11/09；93日拒绝。
- [ ] 接入overview+matrix同区间查询，完成摘要、趋势、环图和患者表；数据异常和两源不一致按06处理。
- [ ] 将矩阵放登记明细入口；保留患者报告、来源、缺失时点、随访与重复登记，按06规格重排。
- [ ] 验证日期切换竞态、部分请求失败、患者不在前100的查看动作、来源事件多于M、随访跨页。
- [ ] 检查ECharts resize/dispose、空图、数据表键盘访问和所有图表配色，保存06证据。

## Task 3：08 列表与完整随访

**Modify:** frontend-web/src/pages/clinician/FollowupPage.tsx、局部样式。
**Consumes:** PatientIdentity、已存在apiFetch、09组件契约。
**Produces:** 两个独立分页列表、一个页面内完整随访表单、09成功后刷新回调。

- [ ] 先复现表单A→B残留、任务可跨患者关联、失败被显示空列表的问题并记录用例。
- [ ] 实现两张同级表格、轻标签、长文展开、真实total分页与URL患者预选。
- [ ] 实现完整表单重置、患者任务归属校验、无关联任务禁用close_task、提交锁。
- [ ] 验证新增/任务填写/取消三个路径及失败恢复；保存后的刷新失败只重读。
- [ ] 用51条任务/记录fixture验证第二页可达，用同名患者验证按ID关联，保存08证据。

## Task 4：09 共享弹窗

**Modify:** frontend-web/src/components/TaskCloseModal.tsx、FollowupPage的调用，以及WorkbenchPage的最小兼容调用修改（若实际尚未传taskType）。
**Consumes:** task{id,patientId,patientName,taskType?}。
**Produces:** 单次POST随访事务、一次成功通知、作用域正确的medix弹窗。

- [ ] 核对02已实现代码，保留有效改动，只补09差距；不要重写另一Agent的组件。
- [ ] 实现头像/短触发说明/textarea/复训checkbox/灰紫按钮与portal主题。
- [ ] 验证空格、200/201字、双击、切任务、未知类型、409、网络结果未知和刷新失败的路径。
- [ ] 验证POST只有一个且close_task=true，取消零请求，复训开关影响后端返回reminder。
- [ ] 在02与08分别操作并拍图，不能只在组件孤立预览里验收。

## Task 5：集成与交付

**Modify:** frontend-web/src/App.tsx（仅三路由medix接入）、docs/planning/UI-OPTIMIZATION-LOG.md。

- [ ] 前批外壳已完成后集成 /plans /stats /followups；回归01–04导航、退出和共享组件。
- [ ] frontend-web工作目录执行 `npm run build` 与 `npm run lint`，保存真实输出；旧基线12 warnings/0 errors需现场核对，不能照抄为本次结果。
- [ ] 按ACCEPTANCE在1440×900、1280×800、390×844与200%缩放完成视觉/键盘检查；mock和真实接口证据分别标注。
- [ ] 写实现报告：变更文件、实际截图、测试输出、未解决项、资产来源；更新UI日志。

本包没有建立额外测试框架。上述纯函数/状态修复采用项目现有测试能力或最小可复现断言脚本，不为静态样式写实现镜像测试。任何脚本必须记录运行命令与真实输出；通过编译不代替浏览器交互验收。
