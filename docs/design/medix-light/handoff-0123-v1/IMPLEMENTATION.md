# Medix Light 00–03 Implementation Plan
> For agentic workers: use superpowers:executing-plans task-by-task if available. 本任务由用户交给外部 coding Agent；不要自行创建用户聊天或启动额外 Agent。实施状态另存工作日志，冻结文档保持只读。

**Goal:** 在现有前端实现00共用系统、01登录、02工作台、03患者管理。
**Architecture:** 新增局部medix主题和外壳变体，只迁移指定路由；页面仍持有现有请求与操作状态，视觉组件不请求API。
**Tech Stack:** 已安装 React/TypeScript/Ant Design/React Router；不新增图表或UI库。
**Spec:** [设计系统](00-SYSTEM.md)、[规则](RULES.md)及三页规格。

## Global Constraints
本期只改01–03及必需弹窗；根字号16px；字号token+rem；无嵌套内容卡；原API权限有效；冻结文件只读；不得硬编码图片数字和日期。
没有自动提交或推送授权；代码写完先交用户验收。不得修改本包中的复选框，状态放到新的工作日志中。

## Review Focus
1. 局部主题/弹窗泄漏至旧页面：00拍迁移前后/患者详情与/admin截图。
2. 登录401和强制改密：01真实浏览器校验导航与错误。
3. 无到期时点/统计失败被显示为0：02检查四状态与部分失败。
4. 列表异步筛选竞态与页码不同步：03用延迟响应与第2页建档复现。
5. 现场评估型号和指导ID不一致：03抓body并验证后端接受正确组合。

## 任务00：共用外壳、主题与资产
文件：
- 新增 frontend-web/src/styles/medix-theme.ts、medix-light.css。
- 新增 frontend-web/src/components/medix/index.tsx（00列出的轻量组件）；必要时拆MedixThemeBoundary.tsx。
- 新增 frontend-web/src/assets/medix/ 的生产可用资产和来源清单。
- 修改 frontend-web/src/components/WebLayout.tsx、frontend-web/src/App.tsx、frontend-web/src/main.tsx（仅引入带作用域CSS）。
接口：WebLayout variant扩展medix；纯视觉组件输入按00；原comfort/standard保持可用。
- [ ] 记录git状态和build/lint基线；截现有三页及/admin、/patients/:id，保护用户改动。
- [ ] 准备本地素材与演示头像映射；验收没真实照片时的中性占位，不替真实患者造脸。
- [ ] 实现局部token与外壳；仅指定路由挂新变体；避免旧inline style压住medix CSS。
- [ ] 验证顶栏搜索、菜单高亮、退出；1440/1280/390及200%缩放。
- [ ] 验证Modal/Select弹层新主题和旧页不受影响；记录证据后进入01。

## 任务01：登录
修改 frontend-web/src/pages/auth/LoginPage.tsx；复用AuthContext/apiFetch，不改令牌存储。
消耗00主题与资产；产出使用旧契约的新登录页面。
- [ ] 重排品牌、单层表单、标签和按钮。
- [ ] 保留required、密码显隐、Enter、loading，防重复提交。
- [ ] 运行01验收矩阵：空输入、401、网络失败、医护/管理员/强制改密跳转。
- [ ] 截图及记录；无凭据时mock与真实联调必须分开标，不凭mock称后端通过。

## 任务02：工作台
修改 WorkbenchPage.tsx；局部适配 TaskCloseModal.tsx、MedicationBackfillModal.tsx 的medix class/主题。不全局改clinic组件。
消耗00外壳、PatientAvatar、Surface；保留todayCoverage.ts口径和现有弹窗回调。
- [ ] 布局上方2:1、下方全宽队列；删编号列和重复说明；保留任务ID。
- [ ] 规范四状态、关注项、任务数量口径、超6条展开与全部入口。
- [ ] 补登、处理成功触发刷新；错误与部分失败按规格显示。
- [ ] 验证N=0、M=0、0<M<N、M=N、统计不可用、同患者多任务及超过20条限制。
- [ ] 浏览器运行两个弹窗成功/失败/取消路径，保存截图与脱敏请求证据。
不把日志中复现的业务风险擅自扩大为后端重构。

## 任务03：患者管理
修改 PatientListPage.tsx。消耗00视觉组件，不改服务端筛选契约。
- [ ] 工具栏与四列表格重排；移除code显示、底部多余提示，保留搜索能力。
- [ ] 修复请求竞态、建档回第一页状态；保留诊断重复参数与账号全选语义。
- [ ] 修正现场评估device_model_id，切型号清旧指导，加提交中状态。
- [ ] 验证两个不同UUID型号/指导的成功请求，以及无指导、失败重试。
- [ ] 验证分页、组合筛选、同名、长名、无头像、空态/失败与触屏操作。

## 总验收和交付
- [ ] frontend-web目录执行 npm run build、npm run lint，保存完整输出；基线以开工时实测为准，仓库备注12warnings/0errors仅供比对。
- [ ] 运行[验收表](ACCEPTANCE.md)每条；与目标图按相同视口对照，标已批准差异。
- [ ] 更新 docs/planning/UI-OPTIMIZATION-LOG.md，附截图路径、测试方式、已知差异、未完成资产。
- [ ] 输出改动文件清单、实际截图、功能结果、未解决事项；等待用户视觉终验。
不要改本包为“代码已通过”；另建 docs/evidence/medix-0123/implementation-report.md。

