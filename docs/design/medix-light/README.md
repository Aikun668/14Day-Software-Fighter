# Medix Light 整体设计交付

**接手Coding Agent从 [总HANDOFF](handoff-final-v2/HANDOFF.md) 开始。**

00–15全部编号已映射到唯一规格。07是统计内患者报告，已补独立效果图、规格与验收，09/10为共享弹窗，11–15为管理端五视图。当前交付是设计与实施规格；本会话没有执行代码改造，不代报其他Agent实现进度。

|入口|内容|
|---|---|
|[全页登记](handoff-final-v2/PAGE-REGISTRY.md)|每页规格、图、路由、旧文档替换范围、共享组件归属|
|[最终规则](handoff-final-v2/RULES.md)|统一风格与跨批冲突裁决|
|[第一批](handoff-0123-v1/HANDOFF.md)|00公共系统、01登录、02工作台、03患者管理|
|[第二批](handoff-05060809-v1/HANDOFF.md)|05计划、06统计含07、08随访、09处理任务|
|[07独立补充](handoff-07-v1/HANDOFF.md)|07新版图、独立实现规格、静态自检；用户视觉确认已通过|
|[最后一批](handoff-final-v2/HANDOFF.md)|04补充契约、10补登、11–15管理端及整体集成|
|[整体验收](handoff-final-v2/ACCEPTANCE.md)|全页与跨页功能、视觉、工程证据要求|
|[文档终验报告](handoff-final-v2/REVIEW.md)|本轮自检结论、已裁决差异、尚待代码阶段事项|

旧DESIGN.md/UI_DESIGN.md/PRODUCT.md在本表覆盖范围内不再作为视觉权威；业务约束保留。前两批只读原件不改，最终RULES只对明确列出的跨批条款更新。

指定图：01–03用approved-batch-01；04/05/08用approved-batch-02选择记录；09–12用approved-batch-03；06/15用approved-charts-v2。13/14保留review-batch-04来源，未找到单独逐张批准记录，文字规格按本次授权冻结。其他review文件仅历史，不依据修改时间自动升级基准。

当前总交付为v2，已更正v1漏交07新图的问题。07代理静态自检及用户视觉验收均已通过。v1压缩包与冻结文档保留历史。

冻结状态以各FREEZE.json为准；历史review.json保留当时状态。只读属性防误覆盖，SHA256检测变动。后续修订另存新版本，实际代码截图存implementation-evidence目录，不覆盖目标图。

完整性复核：`python docs/design/medix-light/handoff-final-v2/verify.py`。如核对本轮阅读基线，加`--check-source`；代码实施开始后基线漂移需检查，不能恢复旧文件覆盖新工作。
