# 03 患者管理
目标：[冻结图](../approved-batch-01/03-patients.png)，最新文字修正优先。路由 /patients。
文件 frontend-web/src/pages/clinician/PatientListPage.tsx。

## 页面布局
标题“患者管理”左侧，右侧同一行：搜索、诊断标签、账号状态、新建患者。控件高40px；窄屏工具栏换行，不压成小字。
下方一层白表，取消重复“患者列表”标题。列为患者（30%）、诊断（36%）、账号状态（18%）、操作（16%）；允许按内容微调，不加编号列。
姓名前36px真实/演示头像，姓名单行，长名称可换行，不再下挂编号或诊断。诊断在自己的列，一般字号，不改成小字。
账号“已绑定”薄荷淡底深绿字，“未绑定”杏色淡底深棕字。操作两个32px灰描边图标：查看详情（人物）、现场评估（记录板）；hover/focus给tooltip，aria-label含动作和患者名，触屏44px点击区。
底部左“共 X 位”（接口total），右分页。删除“本页8位未绑定”“筛出未绑定”等重复入口；账号状态筛选已经承担该任务。
删除原系统正常、解释性sub、引导段落。空态用“暂无患者”或“没有匹配患者”，保留新建按钮或清除筛选。
白表依内容长高，超过视口可滚动；禁止把20条分页缩成10条静态截图。

## 请求契约
Patient保留id、patient_code、display_name、diagnosis_label、assigned_clinician_id、account_user_id。
列表GET /api/patients，page从1开始，page_size=20，search可含姓名或编号。
诊断多选以重复diagnosis_label查询参数传递，任一匹配；账号只选一项时account_status=bound或unbound；全选/全不选省略该参数，不能空字符串引发422。
诊断选项GET /api/patients/filter-options，全库标签，不从当前页统计。
搜索提交、筛选变更、清除筛选都回第一页；保持服务端过滤，不用当前页数组filter伪装搜索。
快速连续请求以最后一次为准，使用请求序号或AbortController防旧响应覆盖；不要因useEffect+手动fetch产生跨页竞态。
名称和编号只作为展示/检索，操作始终用id。列表隐藏编号不改变搜索兼容性。
cleanDemo仅去掉界面里的DEMO后缀，不改数据库内容；演示数据标签由显式演示模式控制。

## 新建患者
复用当前Modal+Form。patient_code必填、display_name必填；diagnosis_label/note选填。POST /api/patients，成功提示并关闭、清表单、setPage(1)后刷新；不能只fetchList(1)而分页状态仍停在第2页。
失败保留输入，禁止假成功或双击重复建档。表单不能因为用户说删编号而删掉契约必填编号。
弹窗用局部medix主题；明确label与校验，不加示例长篇；备注保留可选。
新建/评估弹窗未有独立确认效果图，按00共享表单规范实现并在交付截图中单列。

## 现场评估
点击行图标→原评估弹窗；加载GET /api/device-models?page_size=100；选择型号后GET /api/device-models/{modelId}/guide。
选择指导版本、输入结论，POST /api/training-sessions。
必须修正已核实的提交错误：当前submitEval把guide.id写到device_model_id。应读取表单选中的device_model_id，guide_id仍是guide.id；后端training.py会校验指导所属型号。
切换型号时先清guide_id与旧guides，防止旧版本残留；没有已发布指导显示短空态并禁提交。
当前代码把指导所有步骤标DONE，属于既有评估业务行为；本轮不擅自设计逐步评估新流程，也不能宣称该业务语义已经完整审查。若产品方要改，另开任务。
提交中锁按钮，失败保留弹窗内容，成功才关闭/提示。对象id传正确，不能让按钮串触患者详情。
不新增后台接口，不修改指导发布流程。

## 03 明确缺陷处理
|问题|实施动作|验证|
|---|---|---|
|型号ID误填为指导ID|前端提交取选中型号值|两个不同UUID的型号/指导仍提交成功，抓请求body|
|建档后只拉第1页但页码未同步|setPage(1)，统一触发加载|从第2页建档后页码和列表均为第1页|
|旧指导残留|型号变化清空指导与异步结果|从有指导型号切无指导型号不可提交旧指导|
|请求竞态|仅最后请求可更新data/total/loading|慢请求A后快请求B，最终显示B|

## 验收
组合搜索+多诊断+账号状态、清空筛选、跨页筛选、21条以上分页、重复名称、空诊断、未绑定、超长姓名、无头像、服务失败、创建与现场评估完整闭环。
不能为还原头像表格而删除功能；不能引入姓名下面的小号patient_code。

