# 00–03 还原验收

结论：独立子 Agent 视觉复验通过；等待用户查看交付。范围仅00–03。

|规则|结果|证据|
|---|---|---|
|1 目标与视口对齐|通过|compare-01-login.png、compare-02-workbench.png、compare-03-patients.png；目标1586×992等比归一，实拍1440×900|
|2 外壳、表格和颜色|通过|03-patients.png；侧栏240、顶栏80、表内距20、行高56；checks.json含测量|
|3 token/rem与字体|通过|medix-light.css、medix-theme.ts；Chrome实际字体NotoSansSC-Regular/Medium，isCustomFont=true|
|4 头像身份与回退|通过|03-patients.png、03-no-demo-portraits.png；非演示fixture无DEMO标记、无avatar_url，断言0个演示头像|
|5 去冗余文字|通过|三个主图；无编号列、蓝点、姓名下小字、重复筛选提示|
|6 登记口径|通过|02-workbench.png、02-no-due.png、02-stats-failure.png；N=0与请求失败独立呈现|
|7 业务入口|通过|interaction-checks.json：组合服务端过滤、型号/指导不同ID、切型号清旧指导、关闭任务POST随访后刷新|
|8 不裁数据|通过|02-stress.png；同一患者不同task保留；03-twenty-rows.png与分页断言|
|9 用户画廊更新|通过|../medix-light-full-ui/index.html 的01–03与本包主图hash一致|
|10 响应式和异常|通过|01-login-390.png、02/03的1280和390图、00-mobile-navigation.png、03-service-error.png|
|11 独立复验|通过|下方退回记录及独立复核结论；不代表用户最终签字|
|12 工程与证据|通过|build.log、lint.log、UI-OPTIMIZATION-LOG；unchanged-gallery.json保留04–15的12张图hash|

## 退回与修正记录

|轮次|退回项|修正与复验|
|---|---|---|
|原预览初审|P1全员紫色占位、扁平插画、表格贴边；P2图标/字号过小、搜索与密码框56px|生成固定写实头像图集及3D插画，重建局部外壳与白表内距，控件40px；before目录保留原图|
|实现第一轮|P1实际字体偏细宋体观感；P2图例“无排程”、无头像回退证据仍带DEMO、导航tooltip残留|加载本地Noto Sans SC；改无到期时点；使用真正非演示fixture；移除重复导航tooltip；iteration-1保存该轮截图|
|实现第二轮|无P0/P1/P2|三张新组合图、两张局部对照、桌面/1280/390通过；字体子集化后的封包复核再次通过|

独立复核者：本任务子 Agent `/root/visual_acceptance`。其实际查看截图并提交视觉结论，功能回归由主 Agent 操作。结论没有虚构“相似度百分比”。

## 剩余差别与边界

- P3：登录按钮字重略重；品牌及部分导航图标轮廓与生成图不完全相同。生成的人像/插画保持题材和画风，不承诺生成图中人物身份逐像素相同。
- 工作台计数、日期以数据为准；图中编号和解释按后续确认删除；登记格按正式语义配色。这些为已确认差异，不是漏做。
- 主图和交互写操作由隔离API响应支持，没有向真实患者库建档或提交训练/随访记录。真实后端只做登录、读取工作台/患者与退出，见live-checks.json及两张live图。
- 验证了无未捕获JavaScript异常。故意触发的401/404/503是错误状态验证，不将它们描述为“所有网络请求成功”。
- 构建仍提示主JS分块体积较大；本轮未改全站拆包。字体常用字首屏两档合计约2.8MiB，罕用字才加载完整字体。

## 旧冻结包与代码基线

旧交接包 `verify.py` 完整性检查通过：56份Markdown、201条链接、103项冻结条目没有改动。带 `--check-source` 时会报告 App.tsx、index.css、LoginPage.tsx、PatientListPage.tsx、WorkbenchPage.tsx 五处旧代码基线漂移；它们正是本轮用户授权修改的文件，不是设计冻结文件受损。保留原基线，不改校验器、不自动回滚。本轮源文件hash另记 source-hashes.json。
