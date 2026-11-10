# 12 指导版本

目标：[12](references/12-admin-guides.png)。入口/admin?tab=guide。API在device_models.py，类型GuideOut/GuideCreate。

## 布局与内容

标题“指导版本”+右上“新建指导草稿”。白表列：型号 / 版本 / 标题 / 状态 / 操作，建议24/10/34/12/20%。版本如1.1-demo是业务值，不能一律删demo子串；标题可换行两行，“查看”读完整内容。删审核流程常驻说明、页签计数和重复“已发布不可改”。

状态：DRAFT草稿灰、REVIEWED已审核淡蓝、PUBLISHED已发布浅绿；操作查看灰描边。草稿额外“审核通过”灰按钮；已审核“发布”紫按钮；已发布仅查看。未知状态只查看、不猜下一动作。图上已发布操作列—由文字规格补为查看，保证内容可验。

## 查询与表单

GET /api/admin/device-guides?page=…&page_size=20，可带device_model_id/review_status；默认不过滤。型号映射来自完整管理目录；请求分开，某页失败不影响其他管理页。

新建弹窗宽37.5rem，单列表单：型号、版本、标题、操作步骤（每行一步），皆必填。去掉占位符中的具体医疗操作示例，只用“第一步…”。steps_text逐行trim、过滤空行，至少一项，映射{step_no:index+1,text}。POST /api/admin/device-guides传device_model_id/version/title/steps。

不自动编号进text；step_no单独字段。已有error_notes/image_path/source_title/source_url通过GuideOut只读详情保留显示，不能重建步骤时丢字段。本期新建界面沿用已有简表单，不新加图片上传、AI生成步骤或批量审核。

409 VERSION_EXISTS留在版本字段，保留整份输入，不自动改版本重试。版本唯一性为同型号+版本，服务端裁决。

## 查看、审核、发布

查看用40rem弹窗，首行型号+版本+状态，完整标题，步骤按step_no排序；步骤用序号+段落细分隔，不套卡。已存在错误提示/来源保留在相关步骤或详情中，只在需要看内容时出现。图片路径按项目已有安全资源访问方式展示，不能猜外站链接；资源失败显示不可用，不丢步骤文字。

现有列表GET已返回steps，可展示行快照；没有admin单条指导GET，不发不存在的请求。执行审核/发布前刷新该页/筛选集合确认目标当前状态；目标消失则提示刷新，不按旧快照提交。

审核必须先展示完整内容供人核对，人工点击“确认审核通过”后PATCH /api/admin/device-guides/{id} body {review_action:'APPROVE'}。记录真实审核人/时间由后端处理，不前端填。

发布只在REVIEWED，确认弹窗点名标题与版本，POST /api/admin/device-guides/{id}/publish。成功刷新该行状态及审计缓存；409 NOT_REVIEWED/ALREADY_PUBLISHED显示服务端状态冲突，刷新，不自动连跳审核。DRAFT→REVIEWED→PUBLISHED，不提供撤回/删除/编辑已审核版本。

## 必验

空白步骤阻止提交，顺序编号连续；同型号版本冲突不丢草稿；审核查看完整步骤；发布前未审核禁止；已审核也不可编辑；已发布查看可达；未知状态无写动作；双击锁；发布成功但刷新失败不再POST；非管理员无法操作；详情长步骤/键盘/窄屏无截断。
