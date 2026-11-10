# 最后一批与整体集成 Implementation Plan

> For agentic workers: 使用 superpowers:executing-plans 逐项实施。本会话交付规格，用户指定的Coding Agent负责代码执行；不自动新建会话或派发外部消息。

**Goal:** 完成10及管理端11–15，补齐04契约，集成全部medix页面而不回退先前工作。

**Architecture:** 一个共享medix外壳与两个共享临床弹窗。AdminPage拆五个轻子视图，各自拥有列表/提交状态；审计使用已有分页API派生完整声明区间的数据，未读全不画全量统计。

**Tech Stack:** 现有React、TypeScript、Ant Design、ECharts、dayjs、apiFetch；不新建应用，不新增后端API。

**Spec:** [全页登记](PAGE-REGISTRY.md)、[最终规则](RULES.md)、[管理端公共契约](ADMIN-SYSTEM.md)与各页规格。

## Global Constraints

- token+rem，根字号不改；不套卡，删重复解释，不删业务操作。
- 所有业务日Asia/Shanghai；临床覆盖与审计事件次数分开。
- 真实ID、total、接口状态为权威；未知值不猜，错误不转0/空。
- 已冻结文件不原地修改；00–04其他Agent代码不回滚。
- 管理员无新增临床权限，前端新外观不冒充后端新功能。

## Review Focus

1. 跨患者/跨页签旧响应覆盖：任务1/2/5/6验收当前上下文。
2. 分页首100遗漏与审计部分聚合：任务2/3/6验真实total、边界和不完整状态。
3. 后端状态与截图不一致：任务3/4/5验草稿、审核、发布、must_change_password。
4. 写入结果未知与刷新失败：任务1/3/4/5禁自动重发，验输入保留。
5. 共享组件/样式回退与真实权限缺口：任务0/7验已有页面，权限缺陷明示不假修复。

## Task 0：锁定共享接口与现有进度

**读取：** frontend-web/src/App.tsx、components/WebLayout.tsx、components/MedicationBackfillModal.tsx、components/TaskCloseModal.tsx、pages/clinician/PatientDetailPage.tsx、已落地medix主题与资产。

- [ ] 检查当前git diff、用户指定另一Agent的已完成范围；记录组件真实props，禁止用SOURCE-BASELINE回滚。
- [ ] 按04规格对照已有代码，列差异而不重写；尤其Dayjs格式、plan状态、同刻多slot、读取失败与临时密码结果。
- [ ] 共用文件确定单一修改位置；管理子视图可先实现内部，路由外壳最后集成。

产物：实施报告中的差异与文件归属表。04改动由原负责方处理，若其已完成等价行为只记录通过。

## Task 1：10补登共享组件

**Modify:** frontend-web/src/components/MedicationBackfillModal.tsx；调用方仅需最小兼容变更。
**Consumes:** open,patientId,patientName,onClose,onSuccess；计划历史与daily-slots。
**Produces:** 一次真实登记POST和一次成功回调；02/04共同使用。

- [ ] 先记录旧问题用例：slots失败变空、当前计划不含历史但有旧slot；核对实际时间默认回填仍可编辑且清空后必填。
- [ ] 按10实现布局、历史计划分页、独立请求状态、上海窗口、已登记/未来禁选与受控实际时间。
- [ ] 验证slot.plan_id来自所选slot，PRN slot_id=null；同刻多计划、非上海时区、A慢B快、重复结果。
- [ ] 验证POST成功但父刷新失败只重读；02与04各实际操作一次并截图。

## Task 2：管理端外壳与11型号

**Modify:** frontend-web/src/pages/admin/AdminPage.tsx、components/WebLayout.tsx、App.tsx。
**Create/reuse:** pages/admin/DeviceModelsPanel.tsx、styles/medix-admin.css。
**Produces:** /admin?tab=model|guide|user|kb|audit导航与独立视图；型号目录缓存供12/14使用。

- [ ] 将旧fetchAll全有全无改为按视图请求，保持鉴权；菜单与URL单一状态源。
- [ ] 按11实现真实服务端分页与新建表单，类别/品牌/型号校验；目录超过100仍可读取。
- [ ] 验菜单直达、刷新、前进后退、未知tab回默认；一个API500不影响其他视图。
- [ ] 验重复提交、长型号/厂商、无假编辑删除；保存后刷新局部缓存。

## Task 3：12指导版本

**Create/reuse:** pages/admin/GuidesPanel.tsx；局部共用ReviewStatusTag/内容详情。
**Consumes:** 完整型号目录、GuideOut.steps、真实review_status。

- [ ] 新建步骤转换与校验：空白行过滤、step_no连续、至少一步；版本409保留输入。
- [ ] 建完整内容只读查看、人工审核确认、人工发布确认，严格DRAFT→REVIEWED→PUBLISHED。
- [ ] 验已审核不可编辑、已发布无写动作、未知状态仅查看、409刷新不自动批准。
- [ ] 验实际POST/PATCH与审核/发布返回字段，并截图长内容详情。

## Task 4：13账号与临时密码

**Create/reuse:** pages/admin/AccountsPanel.tsx；components/medix/TemporaryCredentialResult.tsx（若前批已有则复用）。
**Interface:** 结果组件接收account:string、temporaryPassword:string、onDone:()=>void；不自行请求账号API，不持久保存。

- [ ] 账号2–80、密码可空/非空≥8、角色仅两项；空密码省略。
- [ ] 成功后根据temporary_password显示单次结果，关闭清内存，不toast泄漏。
- [ ] 实现稳定ID启停、点名确认、每行锁、当前账号停用后退出。
- [ ] 验ACCOUNT_EXISTS、must_change_password=true、未知status、刷新失败与重复点击。
- [ ] 用专用测试账号验证停用后实际鉴权拒绝；不能在验收中擅自停用唯一管理员或真实业务账号。

## Task 5：14知识内容

**Create/reuse:** pages/admin/KnowledgePanel.tsx；复用状态标签和局部内容详情。

- [ ] 新建表单保留原text空行段落、合法source_url；不写死分块数量。
- [ ] 详情按ID重新GET，文本安全渲染、完整chunk按序显示。
- [ ] 人工审核/发布与12同规则，各自使用knowledge接口；不混用guide.id。
- [ ] 验多段/长文/空段、跨ID竞态、同名不同文档、失败输入保留、已发布只读。

## Task 6：15审计图表

**Create/reuse:** pages/admin/AuditPanel.tsx、pages/admin/auditModel.ts；ECharts组件可用现有图表生命周期封装。
**Interfaces:** AuditEvent{id,created_at,action,resource_type,resource_id,actor_id,detail}；loadAuditWindow(startDay,endDay,signal)返回{events,complete,reason?,readAt}；summarizeAudit(events,window,type)返回{days,groups,total,visibleEvents}。业务日边界与类别表按15，不猜未知action。

- [ ] 数据用例先固定：101事件跨两页、同时间戳、未知action、窗口边界、零事件；断页/5000上限必须complete=false。
- [ ] 实现顺序分页、ID去重、区间截取、取消/竞态、并发变化有限重试和完整性门槛。
- [ ] 只有complete=true计算图；验证总数=日合计=分类合计=列表条数，类别筛选同步。
- [ ] 实现蓝柱/分类条、日期事件流、只读详情；原始乱码可查，不生成账号停用事件。
- [ ] 验错误/不完整不显示假0；无任何POST/PATCH/DELETE；两次换日期只呈现最后结果。

## Task 7：全包集成、记录差异、交实际证据

- [ ] 按PAGE-REGISTRY检查00–15均有实现入口，07留在06；/change-password仍可达但不声称本次改版。
- [ ] 按ACCEPTANCE做跨页矩阵，尤其新建计划→补登→统计→随访→任务关闭，及型号→指导/知识→审核→发布。
- [ ] frontend-web中执行 `npm run build`、`npm run lint`，记录退出码与输出，旧12/0基线现场核对；边界逻辑使用现有测试能力或小型断言脚本，记录可重跑命令，不为CSS加镜像测试。
- [ ] 拍1440×900、1280×800、390×844以及200%缩放、关键弹窗/错误状态；实际截图与fixture分开标注。
- [ ] 更新docs/planning/UI-OPTIMIZATION-LOG.md，提交文件表、行为记录、资产出处、未完成项。用户视觉确认列留待用户，不代签。

本计划是规格，不自动执行发布/启停真实账号或发布医学内容。真实写操作验收使用隔离演示数据；不把代码任务授权解释为操作真实业务记录。
