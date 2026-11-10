# 14 知识内容

参考：[14](references/14-admin-knowledge.png)。源图状态同13，保留参考而不虚构逐张批准。入口/admin?tab=kb，API backend/app/api/knowledge.py，schema knowledge.py。

## 布局

标题“知识内容”+“新建知识草稿”；单张白表：型号 / 标题 / 版本 / 片段数 / 状态 / 操作，建议22/28/9/9/12/20%。标题可两行，详情有原文；片段数来自chunks.length，缺失字段是数据异常而不是默认为0。版本完整显示。状态与12一致。

所有行有灰色查看；DRAFT另有审核通过、REVIEWED另有紫色发布、PUBLISHED仅查看。删除重复“已发布（不可改）”及整段AI检索原理说明。禁止套卡和每行小副标题。

## 查询与新建

GET /api/admin/knowledge-documents?page=…&page_size=20，可带device_model_id/review_status。查看详情重新GET /api/admin/knowledge-documents/{id}，显示当前内容与状态，旧响应不能覆盖新点的文档。

新建40rem弹窗：适用型号、标题、版本（默认1.0）、来源链接选填、正文。POST相同字段device_model_id/title/version/source_url/text；guide_id若界面无选择则省略，不凭型号推断指导版本。

正文trim非空，保留段内换行，段落以空行分隔。后端_split_chunks按空行分块，客户端不把每一行当一个chunk。表单只保留一条有用提示“空行分段”，删除“供AI检索引用”的开发说明和具体医疗操作占位文案。source_url空则null，非空只允许http/https；客户端判断格式，不假称来源已审核。

当前后端没有像指导版本那样检查同型号+version唯一，不能声称一定409去重；若同名同版本存在，可提示核对，但以实际API结果处理，不编造不存在的版本冲突响应。

成功后根据返回chunks显示真实数量并刷新；不弹“AI即刻可引用”的长提示，简单“草稿已创建”。超时先查重核对，不自动再次POST相同正文。

## 查看与审核发布

详情40rem弹窗/抽屉：完整标题，型号、版本、状态一行；来源URL按可用安全链接显示；正文按chunk_no有序段落，分隔线，不嵌套卡。完整内容不得永久省略；长文滚动，返回焦点。source_url无值不显示空来源段。

人工阅读后PATCH /api/admin/knowledge-documents/{id} {review_action:'APPROVE'}；REVIEWED人工确认标题/版本后POST /api/admin/knowledge-documents/{id}/publish。成功变更状态由返回值为准。非DRAFT不可PATCH编辑，非REVIEWED不可发布；409刷新并保留可读详情，不自动批准后重试发布。

本期保留既有新建/审核/发布/查看，不新增批量发布、删除、重建向量、AI自动审核或审核者替签。即使接口允许修改DRAFT，界面不必为此扩张编辑器范围。草稿与未发布资料不应被当作已发布检索内容，具体检索回归由真实链路证据证明。

## 必验

空白正文不提交；空行分块与返回数量一致；来源可空且安全；同标题不同ID不会串详情；长文完整可读；已审核/已发布不出现编辑；审核→发布次序真实；非管理员失败；新增、审核、发布结果与审计真实事件一致；GET失败不显示旧文档为当前文档。
