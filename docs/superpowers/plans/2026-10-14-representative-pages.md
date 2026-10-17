# M01 / P01 代表页原型执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付方向一的可查看 M01 工作台、P01 今日首页及必要主动作演示。
**Architecture:** 独立 prototype 目录、两张 HTML、共用视觉样式及本地 Alpine.js；内存模拟数据、地址参数切换状态，不接业务 API。
**Tech Stack:** HTML / CSS / Alpine.js，oil-ui 自带浏览器截图工具。
**Spec:** UI_DESIGN.md、UX_DESIGN.md、PRD 1.5。

## Global Constraints

- Web 在 1440px 和 1280px 可用；App 检查 390×844、360×800。
- 对象、来源、状态、记录覆盖率与实际依从性的区别始终清楚。
- 仅为原型：无离线同步、持久患者数据或真实医学内容。
- 数据、未接 API 与其他页面覆盖范围在评审入口及 README 披露。
- Ruling: 当前目录没有 Git 仓库；使用独立 prototype 目录隔离，不初始化 Git 或建立工作树。
- Ruling: 当前任务为可逆的视觉原型；验证采用真实浏览器操作与截图，不另建单元测试套件。

## Review Focus

- 1280px 时患者摘要重排，列表仍能阅读。
- 手机长文字、底部栏及表单滚动不遮挡动作。
- 失败保留输入，未经确认不能显示提交成功。
- 选中患者与摘要一致；随访处理需实际填表。
- 模拟成功、空结果、失败和加载状态可以单独查看。

### Task 1: 页面与主动作

**Files:** archive/prototype-v1-codex/index.html、archive/prototype-v1-codex/web.html、archive/prototype-v1-codex/app.html、archive/prototype-v1-codex/styles.css、archive/prototype-v1-codex/vendor/alpine.min.js、archive/prototype-v1-codex/README.md。

- [x] 建立共享样式和本地依赖，制作评审入口。
- [x] 制作 M01 列表/摘要、任务筛选及简化关联随访上下文。
- [x] 制作 P01 今日动作/计划、只读信息及简化关联登记上下文。
- [x] 提供 normal/empty/error/loading 状态，模拟失败与结果确认。

### Task 2: 实际查看与交付

- [x] 用 oil-ui 工具取代表视口截图，亲自查看并修正布局。
- [x] 浏览器走查任务筛选、随访失败后重试、登记失败后重试及未确认结果的核对流程。
- [x] 记录实际证据、未验证的真机范围和必要的布局取舍。
- [x] 提供本地预览入口与截图，保持 UI 文档为待产品负责人视觉评审的初稿。
