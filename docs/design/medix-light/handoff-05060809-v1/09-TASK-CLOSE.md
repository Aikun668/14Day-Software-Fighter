# 09 处理任务弹窗

目标：[09-task-close-modal.png](references/09-task-close-modal.png)。共享实现 frontend-web/src/components/TaskCloseModal.tsx；调用方包括工作台与随访中心。不是新路由。

## 构图

桌面宽 35rem，最大 calc(100vw - 2rem)，居中白面，圆角 .5rem，单层轻阴影；内边距 1.5rem。遮罩约 rgba(25,30,45,.28)。这是工程尺寸，不是截图像素测量。

标题“处理任务”，使用公共 section 字号 1.0625rem/500，右侧关闭按钮。下一行头像 2.25rem+姓名；其下最多一句真实任务类型说明，无编号、时间元数据和说明大段。内容垂直间距 1rem。

“处理说明”字段必填，textarea 默认约6行、最大200字，右下计数；placeholder“填写处理说明”，不预写医学建议。下面一行 checkbox“安排操作复训提醒”。底部右对齐“取消 / 确认处理”，主按钮紫，次按钮灰。不加蓝点、彩色操作图标或底部教程。

小屏宽度留1rem外边距，长内容滚动在弹窗内，标题与按钮可触达；键盘焦点陷阱、Escape取消、关闭后返回发起按钮。提交期间 Escape/遮罩/关闭/取消都禁用，防止结果被当成已取消；提供 loading 与 aria-busy。

## 组件契约

沿用 open、task、onClose、onSuccess。task 至少 {id,patientId,patientName}，新增可选 taskType，兼容前批02调用。不要拆成两套外观相同的 Modal。

已知 taskType==='MISSED_MEDICATION' 才显示“连续3个到期时点未发现登记”。该映射来源是 task_service.py 的当前阈值3，表述为任务触发原因，不代表此刻仍缺这3次登记。类型缺失或未知写“待核查任务”，不套用3次。扩展 FollowupPage 的 Task 接口接收后端 task_type，工作台同步传递；不要用患者姓名推断原因。

open 从 false 到 true 或 task.id 改变时重置 note/retrain/error。task=null 禁用提交；不显示上一任务残留。有未保存输入时切换任务由调用方先确认；提交期间禁止切任务。

## 唯一写入事务

POST /api/followups：

```json
{
  "patient_id": "task.patientId",
  "task_id": "task.id",
  "followed_at": "提交时刻，带时区的ISO时间",
  "feedback": "note.trim()",
  "close_task": true,
  "create_retraining_reminder": false
}
```

上例字符串代表运行时值，不可按字面提交。checkbox 决定最后一项。feedback 必填校验 trim 后1–200字；输入组件计数与验证口径一致。action_taken/next_plan 不自行填推断内容。

后端同事务保存随访、关闭任务、可选创建复训提醒。PATCH /api/tasks/{id} 仅支持 IN_PROGRESS，不能用于关闭；不串联“创建随访 + 另调关闭”两请求。提示文案“已处理”即可，不需额外一段解释。

## 状态转换与重试

idle → editing → submitting → success：立即置提交锁，阻止双击/回车重复请求；服务成功后只触发一次 onSuccess，清理并关闭。调用方异步刷新失败不是提交失败，应提示“已保存，列表刷新失败”并允许仅刷新。

submitting → failure：解除锁，保留说明与勾选，字段下显示简短错误。空白说明“请填写处理说明”；422任务不匹配要求返回列表重新选择；403/404资源不可访问，禁用再次提交并可返回。

409 ALREADY_CLOSED：提示“任务已关闭”，刷新列表、允许关闭；不再次自动新增随访，不宣称当前说明已保存。超时或断网响应未知：提示“结果未确认，请刷新核对”，暂不自动重发；读取任务和随访确认本次写入后再决定。当前接口没有请求幂等键，不声称已获得端到端 exactly-once。

普通取消/关闭清理输入，不调用 onSuccess，不修改任务。关闭与成功清理逻辑分离，避免 onClose 引起重复刷新。聚焦错误字段，错误区 aria-live，不仅 toast 一闪而过。

## 必验

空格说明不提交；200字可提交、201字受限；双击一个请求；checkbox true/false 对应提醒创建；失败保留内容；A→B不串文本；未知任务类型无虚构触发原因；409不重复保存；保存成功但刷新失败不重复POST；02与08各验证一次；提交中不能通过遮罩造成“取消成功”的错觉。
