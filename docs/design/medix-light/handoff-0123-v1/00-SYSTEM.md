# 00 公共设计系统与外壳

## 基准与尺寸
图片文件实际分辨率以 PNG 元信息为准；验收视口统一 1440×900。对照时按宽高等比归一。
桌面侧栏 15rem（240px），满高白底；主区从 x=240 开始。顶栏高 5rem（80px），仅跨主区。品牌在侧栏顶部，不重复在主区顶栏。
主内容 padding 1.75rem（28px），区块间距 1.25rem（20px）。工作台左/右上区约 2:1，间距 1rem。
页标题 1.25rem/500；区块标题 1.0625rem/500；正文 0.9375rem/400，行高 1.5；辅助标签 0.8125rem/400。品牌 1.25rem/600。禁止粗黑 32px 页面标题。
控件高 2.5rem；表格表头 2.75rem，常规行 3.5rem；头像 2.25rem，圆角 .5rem；行操作按钮 2rem 正方形，触屏目标最小 2.75rem。
边角：内容面 .5rem、输入/按钮 .375rem、轻状态标签 .25rem。内容面无阴影，弹层允许单层轻阴影。

## Token（在新作用域内定义，禁止覆盖全局 :root）
|建议变量|值|使用|
|---|---|---|
|--ml-bg|#F6F6F6|画布|
|--ml-surface|#FFFFFF|表格/表单/外壳|
|--ml-head|#FAFAFA|表头|
|--ml-ink|#424650|正文|
|--ml-muted|#697180|辅助文字，不再调浅|
|--ml-line|#EEF0F3|细分隔|
|--ml-border|#D7DAE2|输入和按钮边框|
|--ml-brand|#8146FF|主动作/选中|
|--ml-brand-soft|#F4F0FF|导航选中底|
|--ml-blue|#4C91ED|连续趋势|
|--ml-teal|#43B7A0|已登记图形|
|--ml-apricot|#E8B77E|缺口图形|
|--ml-success-bg / ink|#EDF9F1 / #287442|已绑定|
|--ml-warn-bg / ink|#FFF3E9 / #92532C|未绑定|
|--ml-fs-body / title / caption|.9375rem / 1.25rem / .8125rem|字号|

状态格：M=N且N>0 用青绿填充+勾；0<M<N 用青绿半填充+部分图形；M=0且N>0 用杏色淡填充+短横；N=0 用白底灰描边。每格提供日期、M/N、语义的 aria-label 和可聚焦说明。不能让无到期时点等同未发现登记。
图表颜色不用于小字正文。按钮白字与紫底、正文与背景在运行页面测对比，目标常规文字至少4.5:1；必要时仅加深文字色，不改整个品牌。
不要把“图表要多色”理解成给 01–03 任意增加装饰色块。01 无图表；02 只迁移状态格；03 只用账号状态色。

## 外壳与路由迁移
在 WebLayout 新增 variant='medix'，保留 standard/comfort 分支。只在 App.tsx 的 /workbench 与 /patients 使用 medix；登录由独立 MedixThemeBoundary 包裹。/patients/:id 以及 /plans、/stats、/followups、/admin 本期继续旧分支。
新增 styles/medix-light.css，所有规则以 .ml-shell、.ml-page 或 .ml-auth 限定；新增 styles/medix-theme.ts 导出 medixTheme。保留全局 theme.ts 与旧 CSS，避免污染未迁移页面。
Ant Design ConfigProvider 在 MedixThemeBoundary 内使用局部主题；浮层主题继承 React context，补充浮层 classNames/rootClassName（以安装版本类型为准）。禁止全局 .ant-* 覆盖。
Antd 数字型 fontSize 只能在主题适配文件由 rem×16 计算，业务组件仍用 CSS rem token；不得在 JSX 硬编码字号 px。
外壳保留现有全局搜索逻辑：医护按姓名/编号搜索、选择跳 /patients/:id。知道它当前只加载前100个且最多展示8个命中；不得宣称全库搜索。本期不新建搜索 API。
菜单五项：工作台 / 患者管理 / 用药计划 / 统计与核查 / 随访中心；删分组标题、导航计数徽标。当前路由选中背景为淡紫，无左侧竖线。其他目标导航仍可达。
右上显示真实登录账号与退出；退出走 useAuth.logout 后 /login。移除侧栏底用户重复信息，底部改装饰插画。
不因“只有一个菜单”改变管理员权限；本期不移植新管理端菜单。

## 组件契约（建议集中 components/medix，避免泛化组件库）
|组件|输入/职责|约束|
|---|---|---|
|MedixThemeBoundary|children|局部主题+样式作用域，含弹窗|
|PatientAvatar|name, patientId, src?, demoSrc?|有真实src才代表真人；仅显式演示模式启用demoSrc，无图时中性人物图标|
|Surface|title?, actions?, children|一层白底，内容不得再包 Surface|
|StatusTag|kind: bound或unbound, label|文字始终可见|
|RowAction|label, icon, onClick, disabled?|真实button，tooltip+aria-label，stopPropagation避免串触行导航|
|PatientIdentity|name, avatar|单行姓名，无编号/副标题|
|MedixPageHeading|title, actions?, date?|一行标题及操作，无旧HeroBar副文案|

现有 clinic 组件被其他页使用，不全局改 PatientRow/QueueRow/HeroBar；01–03 用新组件或局部 DOM。API 状态仍由各页面持有，不把请求放进纯视觉组件。

## 资产交付
参考图的插画和头像不是独立生产素材。本包提供视觉目标，不假装已提供透明 PNG/头像套装。
实施者需准备 frontend-web/src/assets/medix/ 下本地 logo、doctor-assistant、演示头像；新增资产清单记来源、用途、授权或生成方式。
品牌建议沿用 BrandMark 的自有图形语义，颜色形状向目标校准；不得复制 Medix 商标文字。
插画目标尺寸约9rem×6rem，侧栏底部离边1.5rem；登录页可放左下。资产不得带截图白边/文字。不要截整页伪装可交互页面。
演示头像固定按演示 fixture ID 映射；生产无头像时的占位规则单独拍图。不可随机给真实患者分配一张脸。
资产未齐时可开发功能；视觉验收应标“资产未齐”，不得宣称最终还原完成。

## 响应式与交互
>=1200px 用完整240px侧栏。768–1199px 侧栏收为64px，菜单可读屏；主区可用宽度不足时工作台上下堆叠。
<768px 用顶栏菜单按钮打开抽屉，隐藏底插画，内容 padding1rem；筛选控件换行，列表动作保持触达。表格可在自身容器横向滚动，页面本身不得横向溢出。
键盘 Tab 顺序跟视觉顺序；focus-visible 2px品牌色轮廓；图标按钮tooltip支持键盘；头像装饰 alt为空（姓名已旁置）；空态和请求错误用简短文字。
短屏侧栏菜单可滚动，装饰不能挤掉菜单；不锁死主区内容高度。

