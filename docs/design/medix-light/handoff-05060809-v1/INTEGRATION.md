# 共享组件和并行交付边界

## 与 00–04 实施者的接口

|对象|已有负责方|本批怎么接|
|---|---|---|
|WebLayout / App 路由 / MedixThemeBoundary / token / 头像 / 侧栏|00–04 实施者|直接复用，最后仅补三个路由的 medix 接入；不重建 shell。|
|TaskCloseModal，02 已使用|共享，已有实现优先|核对现有版本后一次性补齐 09 契约，02 与 08 均回归。不要并行写两份。|
|CoverageTrendChart，04 可能使用|共享，保留原调用|优先增加可选 medix 变体或复用已新增的图表；不能改默认外观影响 04。|
|05/06/08 页面与专属样式|本批实施者|局部实现；不批量替换 clinic 目录或旧 CSS。|
|API client / useAuth / 权限路由|现有实现|复用；不迁移 token、修改角色或数据库。|

共同文件尚未完成时，可以完成本批页面逻辑和局部组件；共享文件集成等前一批落地后进行。提交前检查 git diff，与当前实际接口对齐。文件名建议不是要求强行覆盖另一 Agent 已完成的等价组件。

## 主题接入

使用上一包的 styles/medix-light.css 与 styles/medix-theme.ts；本批专属规则建议放 styles/medix-clinical.css，由相应页面加载，类名前缀 .ml-plans / .ml-stats / .ml-followups / .ml-task-close。不得覆盖全局 .ant-*。

弹窗渲染到 portal 时必须带 medix class/局部主题，不能依靠父 DOM 的 .ml-page 选择器生效。Ant Design 属性按当前安装类型检查，不凭旧版本写 API。

复用 PatientIdentity、PatientAvatar、Surface、MedixPageHeading、RowAction。普通表格动作可用文字按钮，避免凭空增加含义不清的彩色图标。

StatusTag 旧契约仅 bound/unbound，不把计划状态强塞其中。可在页面写 PlanPhaseTag，或在共享维护者允许时扩展有语义的枚举。随访 NarrativeTag 是文字类别标识，独立于状态组件。

## 本批建议新增的小单元

|文件（相对 frontend-web/src）|职责与契约|
|---|---|
|pages/clinician/medixClinicalModel.ts|纯数据转换：derivePlanPhase(plan, now)、makeStatsWindow(startDay, inclusiveEndDay)、aggregateDailyCoverage(matrix)。类型从现有接口抽取，字段名与后端一致。|
|components/medix/DailyTimesEditor.tsx|value: string[]，onChange(times)，disabled?；HH:mm、无重复、按时间排序；不发请求。|
|components/medix/RegistrationCharts.tsx|接收已加载的 points / M / N / loading / error；蓝趋势、青绿杏环图；负责图表生命周期，不偷偷获取数据。|
|styles/medix-clinical.css|本批页面网格、表格、表单和弹窗的局部布局；字号仅引用 rem token。|

不要求建立通用低代码表单、全局状态库、额外图表库。ECharts 已存在；复用 init、ResizeObserver、dispose。数字型图表字体从 token 的 rem 值与根字号换算，仅适配边界用数值。

## 状态与刷新契约

列表区分别维护 idle/loading/success/error；items=[] 只有成功返回才代表空。所有患者对象以 ID 关联，姓名只展示，同名搜索用编号消歧。

09 成功后由调用者刷新待核查列表及相关随访列表；工作台还刷新自己的近期随访/任务摘要。接口保存成功但刷新失败，显示“已保存，列表刷新失败”并允许刷新，禁止再次发送同一保存请求。

统计页面不得为生成时点而调用 daily-slots 写入型 GET；直接读取既有统计 API。如发现物化时点缺失，记录为后端数据问题，不在展示层偷偷补数据。

头像生产规则、资产来源表、键盘焦点和小屏外壳均继承 [00](../handoff-0123-v1/00-SYSTEM.md)。真实数据没有头像字段的事实不能用随机图片掩盖。
