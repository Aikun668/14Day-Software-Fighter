# 代表页原型：清晰的医疗工作空间

这是 M01 医护工作台与 P01 患者今日首页的可操作首轮原型，用于评审内容主次、布局和主要交互。

## 打开原型

在项目根目录启动本地静态服务器：

```powershell
py -3 -m http.server 4173 --bind 127.0.0.1
```

打开 [评审入口](http://127.0.0.1:4173/prototype/)。也可以直接打开[医护工作台](http://127.0.0.1:4173/prototype/web.html)或[患者首页](http://127.0.0.1:4173/prototype/app.html)。

评审入口可切换空结果、读取失败、加载中、提交失败和提交结果待核对等情形。Web 任务可以筛选；选择任务后查看患者摘要并进入关联随访。App 可填写实际发生时间和备注；来源显示为患者自述。

## 截图与走查记录

- [Web 1440px](evidence/web-final-current-1440/page.png) 与 [Web 1280px](evidence/web-final-current-1280/page.png)：选中患者摘要在宽屏侧栏显示，在 1280px 时展开在选中任务行内。
- [1280px 任务筛选结果](evidence/web-filter-1280/page.png)：筛选后患者、状态和摘要保持对应。
- [App 390×844 学习帮助区](evidence/app-help-390/page.png)、[390×844 首页](evidence/app-final/page-390x844.png)、[360×800 首页](evidence/app-final/page-360x800.png)。
- Web 随访[失败状态](evidence/web-flow/motion-failed-end.jpg)与[重试成功状态](evidence/web-flow/motion-recovered-end.jpg)：失败时保留已填反馈；重试成功后任务状态更新。录屏分别为 `record-failed.mp4` 与 `record-recovered.mp4`。
- App [未确认结果核对状态](evidence/app-flow/motion-unconfirmed-end.jpg)及[登记失败后重试结果](evidence/app-retry-390/page-retry.png)：结果待确认时要求先核对；可重试后成功登记，首页随之更新。
- 空结果、错误、加载状态：[Web](evidence/web-states/empty.png)、[App](evidence/app-states/empty.png)；同目录也有 error 与 loading 截图。

截图来自本地真实浏览器。已检查 1440×900、1280×900、390×844 和 360×800 视口；上述截图走查未发现浏览器控制台错误、横向溢出或图片加载失败。独立静态复核给出 7/10，当前截图没有需要继续调整的具体问题；此评分不是产品负责人验收。

## 原型边界

样本姓名、编号、计划和记录均为虚构数据；操作只保存在当前页面内存，刷新后恢复。原型没有连接 API，也不包含正式登录、完整患者管理/统计/内容管理页面、已发布医学指导内容、真实 AI 问答或 Android 安装包。记录表示患者自述，未由设备验证；“未发现登记”不等同于确定漏用药。

当前截图和交互走查不覆盖真实 Android 系统返回键、软键盘、无障碍设备和安装验收。`@2x` 截图只提高像素密度，不代表 200% 缩放后的重排验收。视觉方向及配色数值仍待产品负责人评审，详见 [UI_DESIGN.md](../../UI_DESIGN.md)。
