# 01 登录
目标：[冻结图](../approved-batch-01/01-login.png)。路由 /login；实现文件 frontend-web/src/pages/auth/LoginPage.tsx。

## 视觉
浅灰全屏中央一层白色表单，宽31.5rem（504px）、padding2.25rem、8px边角、薄边无重阴影；小屏宽 calc(100% - 2rem)。
上部品牌图形+“吸入治疗管理”；保留一次产品正式名称“吸入治疗指导与依从性辅助管理软件”，它是产品识别，不扩写说明。
下方“医护端登录”，账号、密码两个可见label，两个输入与紫色满宽登录按钮。密码显示切换保留。左下小医生插画，不增加欢迎长文或功能卖点。
默认表单居中；错误出现可长高，不能压住按钮。输入高2.5rem、字段间1.25rem；品牌到表单约2rem。
不加记住密码、注册、忘记密码、第三方登录等无后端功能。

## 行为契约
保持 useAuth.login(account,password)，POST /api/auth/login；令牌仅内存保存，不改localStorage。
空账号/空密码由Form required拦截；错误凭据保留在登录页，给后端错误或“账号或密码错误”，不要触发会话过期循环。
提交中按钮loading且阻止重复请求；Enter可提交；失败保留账号，允许重试，密码不得写日志或证据。
成功跳转优先级：must_change_password→/change-password；否则 ADMIN→/admin；否则按当前成功流程→/workbench。不擅自开放患者端入口；若测试遇PATIENT角色落Web，按权限缺陷独立记录，不能假称已有角色守卫。
401登录接口设置skipAuthRedirect；其他API401仍走现有会话过期处理。
/change-password 本期只做回归可达，不改版。

## 验收
登录表单正常/必填错误/错误凭据/提交中四状态截图；验证CLINICIAN、ADMIN、首次改密三种跳转。
无新增暗色背景、大渐变按钮、额外说明。宽390与200%缩放不裁切字段。

