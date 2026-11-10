# 管理端公共实现契约

## 外壳与导航

复用00的WebLayout medix分支，新增管理员导航配置，不创建另一套近似外壳。白侧栏五项：装置型号、指导版本、账号管理、知识内容、审计日志；无顶部重复Tabs、数量徽标或总项目数Hero。顶栏左“内容与账号管理”，右真实账号、头像、退出；管理员不显示患者搜索框。

保留单一路由/admin，使用查询参数保存五个视图：?tab=model / guide / user / kb / audit。默认model，未知值回model并replace；菜单点击更新URL，刷新/前进后退正确恢复。Query不会改变鉴权；非ADMIN仍由现有路由/接口拒绝。原来只有一个“管理端”菜单的分支在此扩展，不影响医护五项菜单。

页内容：标题+右上主按钮；下方一张平面白表。页名不重复放表内，说明段直接删除。表面padding1.25–1.5rem，头行2.75rem、数据行至少3.5rem，细分隔；短列表保留自然留白，不为填满屏幕虚构卡片。审计例外见15的图表+事件流。

<768px菜单抽屉；表格独立横滚、工具栏换行；弹窗max-width calc(100vw - 2rem)。复用00的焦点、对比、头像与本地资产规则。

## 文件组织与共用行为

AdminPage.tsx目前一个文件容纳五Tabs。可按职责拆为pages/admin/DeviceModelsPanel.tsx、GuidesPanel.tsx、AccountsPanel.tsx、KnowledgePanel.tsx、AuditPanel.tsx；AdminPage只持URL视图和共用model目录。不要同时为每页新增一套router/shell。

局部styles/medix-admin.css限定.ml-admin/.ml-admin-modal。portal用rootClassName/局部ConfigProvider继承，禁止全局.ant-*。复用前批Surface/Heading/RowAction；新ReviewStatusTag区分DRAFT灰、REVIEWED淡蓝、PUBLISHED浅绿，字色足够深。

替换旧fetchAll的Promise.all一处失败全页失效：每个视图独立idle/loading/success/error、分页和重试。只有指导/知识依赖型号映射。型号未加载成功显示“型号信息不可用”并可重试，不把UUID当人类可读名称；目录读取全部分页或懒加载到所需ID，不能限定首100。

列表默认服务端page_size=20，可选20/50/100；保持total与页码。新增成功刷新所在列表及相关目录/审计缓存，不每次重拉五个页面。修改后当前页空而page>1退一页再请求；错误保留上次数据时明确“刷新失败”，不能当新结果。

每个提交动作有独立busy锁，提交期间禁止上下文切换/关闭；取消清空草稿与错误，失败保留。成功后的GET失败只重试读取，不重复POST/PATCH。无幂等键，超时先读取核对，再由用户决定重试。

## 状态、只读与安全边界

指导/知识：DRAFT可审核，REVIEWED可发布，PUBLISHED只读。已审核亦不允许编辑，当前后端PATCH只接受DRAFT。列表可随时查看完整内容；审核前必须能阅读内容，不实现盲目一键批量批准。发布操作点名标题+版本确认，只有人工确认才POST。409刷新状态，不自动跳过审核重试。

本期不新增删除按钮、患者分配页、重置密码API或发布回滚。管理端有五视图不等于能访问患者详情；审计可展示其已获授权的日志，但不生成临床入口。

展示从API原值映射，不重写存储标题/厂商。列表可省略明确的演示后缀和重复型号前缀，但详情保持完整原文；无法可靠识别的长标题只换行/展开，不猜短标题。

原始内容按文本渲染，不dangerouslySetInnerHTML；来源链接只允许http/https并安全新窗口打开。账号临时密码是例外的敏感结果，详见13，不通过审计详情或toast暴露。

## 状态用例

五URL直达/刷新/后退；某页500不拖垮另四页；型号101条仍映射；服务器第2页可达；未知状态无误导按钮；重复点击只有一次写入；已发布内容只能查看；所有浮层主题一致；非管理员直达不可操作。
