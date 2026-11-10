# 04 患者详情补充契约

目标：[04](references/04-patient-detail.png)。路由/patients/:id；文件frontend-web/src/pages/clinician/PatientDetailPage.tsx。实施仍归用户已指派的00–04 Agent，本文件补齐全包规格缺口，不授权本轮修改其代码。

## 视觉结构

页首小面包屑“患者管理 / 患者详情”。患者身份行：约4rem头像、姓名1.25rem/500、诊断正文；演示标识仅显式演示模式。右侧一个当前主动作+更多，不保留“你好”、英文星期日期、系统正常、介绍段。无姓名下编号。

下一行全宽白摘要条，三个横向项目：近7日登记覆盖率 / 已登记M、应记录N / 待随访数。细竖线分隔，不变成四个套卡。窄屏自然折行。正文深灰，数值突出，待随访浅杏标签。

主区左约3fr登记记录矩阵，右1fr待办，gap1.25rem；不足60rem上下排。矩阵顶部标题和明确日期区间+口径信息入口，七列日期、行按计划时点；行间细线。待办为普通头像以外的功能图标+文字行“补登用药”“记录随访”，保留真实计数，禁用无意义的“暂无需关注/正常”假任务卡。

操作优先级继承当前任务逻辑：未绑定账号→绑定账号；否则有已到期未登记→补登；否则有待随访→去随访；无主动作可只显示更多。更多保留编辑档案、绑定装置、修订时点、查看登记和其他未占用的操作。未来计划不误判当前生效。

## 数据与矩阵

GET /api/patients/{id}是主资源，404/403不可访问；并行读取medication-plans(include_history=true)、medication-events、stats、daily-slots、tasks(patient_id=id)。每块独立错误，不能catch失败后把计划/事件/任务改成空并宣称正常。请求返回前检查路由id与序号，旧load内部直接setState的竞态须消除。

近7日含上海今天及前6日，API统计to为明日日期；标题显示实际起止，不能照图固定11/02–11/08。stats覆盖只含已到期有效REGULAR时点，M去重；N0→—/无到期时点，失败→不可用。待随访OPEN+IN_PROGRESS，若请求有分页必须取齐或明确总量，不仅前50条计数。

当前计划按[start,end)判断，复用05 derivePlanPhase；不能用ends_at===null作为唯一活跃条件。摘要无需重复药物解释；真实药物/时点与计划版本在更多→计划/修订上下文保持可查。计划装置与当前绑定装置不是同一字段，若需要显示绑定装置，取/api/patients/{id}/devices，不由最新药物名猜测。

同一日期+时间可能有多个计划slot，现有Map覆盖写法会丢一个。改为Map<day|time, Slot[]>，同格已到期集合按M/N呈现：全登记青绿勾、部分青绿半填、全未登记杏短横；未到期中性时钟、无此时点中性空白。每格可聚焦说明日期、真实slot数量与登记状态，必要时展开多个计划项，不合并错ID。

未来slot不能因无登记显示缺失；混合格说明到期和未到期数量，覆盖率只按到期集合。矩阵不替代统计接口的总体口径。图中灰/淡紫旧格色由全包最新青绿/杏规则覆盖。日期与时点均可滚动查看，不缩小成难读小字。

## 次级流程保留

|操作|契约与实现要求|
|---|---|
|编辑档案|PATCH /api/patients/{id}，display_name必填，diagnosis_label/note选填；不把诊断标签说成系统诊断。|
|绑定账号|POST /api/patients/{id}/account，account必填、initial_password可空；临时密码单次结果弹窗参照13，不能toast闪过。|
|绑定装置|GET /api/device-models后POST /api/patients/{id}/devices，device_model_id与effective_from；DatePicker Dayjs显式format并转上海零点，不能字符串插值Dayjs对象。|
|修订时点|选定真实plan.id后POST /api/medication-plans/{id}/revisions，starts_at上海时刻，药物可选，REGULAR合法不重复daily_times；PRN不带固定时点。多个计划时先选择，不静默修最新一个。|
|补登|共享10；onSuccess刷新登记、slots、stats，不自动关闭任务。|
|去随访|/followups?patientId=当前ID，避免丢患者上下文。|
|查看登记|抽屉约30rem，接口分页，事件时间/来源/备注/状态，按实际字段；未知source显示原值，不把一切未知都映射成医护观察。|
|撤销登记|POST /api/medication-events/{id}/revoke，trim非空reason；确认说明记录保留但不计覆盖，已REVOKED无重复撤销按钮。409刷新。|

绑定装置/修订有实际生效影响，应在提交确认里简短说明；不常驻上方大段解释。已发布指导等不是本页修改对象。新建计划与修订不是同一个API；不要为了简化菜单把修订替换成create。

计划/表单错误保留输入，date field类型Dayjs与提交string转换明确；新开上下文resetFields；双击单请求、保存成功刷新失败仅重读。若现有已实现等价功能，只核对，不推倒重写。

## 必验

路由A→B不串资料；统计/任务失败不出现0/正常；未来结束计划仍生效；同刻两个slot不丢；未到期与缺失不同；同名患者按ID；绑定账号临时密码可取；绑定装置/修订日期带正确时区；撤销后M变化且原记录保留；51条登记可分页；共享10不回退02行为。
