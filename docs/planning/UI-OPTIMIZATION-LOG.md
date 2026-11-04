# UI 优化日志 · 吸入治疗医护 Web

> 仓库：`Aikun668/14Day-Software-Fighter`  
> 分支参考：`feat/ui-upgrade-2026-10`（本地 WIP 已推 `3bac6ab`）  
> 更新：2026-11-03（America/New_York）

---

## 我们现在到哪一步

| 阶段 | 内容 | 状态 |
|------|------|------|
| 0 | 仓库上公网 GitHub、确认 Cursor SCM / Origin | ✅ 完成 |
| 1 | 定产品范式：PRODUCT.md + Impeccable Operate | ✅ 完成 |
| 2 | 锁样板页：图4 患者详情（不先铺全站） | ✅ 进行中 · 预览已过「还算可以」 |
| 2.1 | 静态 HTML 高保真预览（决策台结构） | ✅ 完成 |
| 2.2 | 去元话术 / 去脚注噪音 | ✅ 完成 |
| 2.3 | 横向拉满主栏（去掉窄 max-width） | ✅ 完成 |
| 2.4 | 主人签字 → 落 `PatientDetailPage` React | ⏳ **下一步** |
| 3 | 图7 报告页，按同一范式 | ⏸ 未开始 |
| 4 | 工作台 / 列表等同范式 rollout | ⏸ 未开始 |

**一句话定位：**  
范式和样板预览已立住；**还没进生产 React**。本轮停在「图4 静态预览认可 → 准备落代码」的门口。

---

## 本轮做了哪些事（图4）

1. 用 Impeccable（Operate）写清产品目的 / 情绪 / 克制度 / 风格，再动 UI。  
2. 落盘：`PRODUCT.md`、`.impeccable/surfaces/patient-detail.md`。  
3. 出静态预览：`redesign-preview` / `Desktop\ui-evidence-tmp\04-patient-detail-redesign.html`（及 png）。  
4. 结构改成决策台：身份 + 主操作 → 绑定告警 → 治疗摘要 + 7 日刻度 → 需关注 → 近期变化；全量流水进「历史」。  
5. 按反馈删掉「默认折叠」类元说明和多余脚注。  
6. 按反馈**横向拉长**：去掉内容区 `max-width: 1080px`，主栏铺满；双栏左固定 / 右刻度自适应。

---

## 已钉死的规范（后续页必须跟）

### A. 产品与口径

| 规范 | 约定 |
|------|------|
| 访客模式 | **Operate**（完成任务），不是展览 / 说服 |
| 首屏目标 | 3 秒内：是谁 / 怎样 / 下一步 |
| 覆盖口径 | **登记覆盖率 ≠ 依从性**；缺格文案只用「未发现登记」 |
| 禁止用语 | 「漏药」；用红做惩罚色 |
| 业务边界 | 只动信息架构与表达；**不改 PRD / API / 统计定义** |
| DEMO | 演示数据必须明示 |

### B. 视觉（方向 B「刻度」）

| Token | 值 |
|-------|-----|
| bg | `#F8F9FC` |
| surface | `#FFFFFF` |
| line | `#E6E9F1` |
| ink / ink-2 / muted | `#0F0D27` / `#3D3D56` / `#6B6E7F` |
| brand / brand-soft | `#573BF4` / `#EFECFE` |
| missed（未发现登记） | `#24243E`（深墨形态，非告警红） |

- 白底、无渐变、无重阴影；细线分割。  
- 组件底：**Ant Design**，不另起第三套皮。  
- 主栏内容**横向铺满**（不要人为窄栏留大片右空）。

### C. 信息架构与交互

1. **决策台优先**：档案表、无限时间线不得占首屏。  
2. **签名件**：近 7 日 × 计划时点（如 08:00 / 20:00）刻度格。  
3. **分段**：概览｜历史；历史按日折叠，默认只展开首日。  
4. **动作克制**：每屏 **一个** 实心主按钮；其余进「更多」。未绑定场景主按钮 =「绑定账号」。  
5. **删冗余**：默认只露异常与有意义变更；流水账进历史。  
6. **Anti-goals**：顶栏多颗实心紫钮并排；卡片套卡片；营销 eyebrow；紫左边框装饰墙；指标展览。

### D. 工作流（怎么优化）

1. 先范式（PRODUCT + surface brief），再单页样板。  
2. **先静态 HTML 预览 → 主人点头 → 再 CloudAgent 落 React**。  
3. 一步一页：图4 →（确认）→ 图7 → 再 rollout。  
4. 反馈优先「删」而不是「堆」；改完同步 Desktop `ui-evidence-tmp` 给人眼验。

---

## 产物索引

| 产物 | 位置 |
|------|------|
| PRODUCT.md | 仓库根 |
| Surface brief | `.impeccable/surfaces/patient-detail.md` |
| 预览 HTML / PNG | `Desktop\ui-evidence-tmp\`（及仓库 `redesign-preview/`，若目录可写） |
| 证据底图 | `docs/evidence/full-ui-2026-10-26/`（图4 / 图7） |
| 本日志 | `docs/planning/UI-OPTIMIZATION-LOG.md` |

---

## 下一步（建议顺序）

1. **落图4 React**：`frontend-web` 的 `PatientDetailPage`，对齐本预览与 token。  
2. 真数据 / DEMO 标注走查一遍。  
3. 开图7 报告页：同一口径、同一把刻度尺。  
4. 列表 / 工作台按同一规范扫一遍冗余。

---

## 修订记录

| 日期 | 记事 |
|------|------|
| 2026-11-03 | 建日志；阶段停在「图4 预览认可、待落 React」。规范汇总自 PRODUCT / surface brief / 本轮预览反馈（去元话术、横向拉满）。 |

## 修订记录（续）

| 日期 | 记事 |
|------|------|
| 2026-11-03 | 用户要求删除 `.agents/skills/oil-ui` 整包；已删净。 |
| 2026-11-03 | 正式安装 Impeccable 到项目：`npx impeccable install -y --providers=cursor --scope=project --force` → `.cursor/skills/impeccable` + agents + hooks。引擎 v0.1.18。`impeccable context` 已跑通；缺 `DESIGN.md`（WORLD_DISCOVERY_REQUIRED）。下一棒：按 new-work 立视觉世界后再重做图4。 |

## 2026-11-03 复盘节点 · Clinic Comfort 图4

### 本段结论
- 观感范式改为参考 Aurelia：大欢迎区 + 摘要卡 + 主双栏，**只要两层内容带**。
- 冗余信息删除：固定方案、版本号、装置空态、底栏治疗/近期卡。
- 底空处理：禁止硬拉组件；采用 **收页高**（内容多高页多高）。
- 刻度配色：弃用青绿+深墨对撞；改为色板内 **软蓝已登记 / 浅灰未发现登记**。

### 节奏教训（季度复盘可记）
1. 先钉 DESIGN 观感，再动画面；忌先堆模块。
2. 如无必要，直接删字段，不「解释性堆砌」。
3. 平衡留白用结构（收页高），不用粗暴 `stretch`/`min-height` 拉格。
4. 同带内状态色必须同色温，禁止青+黑硬对比。

### 产物
- `DESIGN.md`（根目录）
- `redesign-preview/04-patient-detail-aurelia.html`
- 参考图：`docs/planning/design-refs/ref-aurelia-health-overview.png`


### 2026-11-03 · DESIGN.md 定稿
- 主人确认图4 Clinic Comfort 预览。
- 根目录 DESIGN.md 按样板定稿；同步 patient-detail surface brief。
- 下一步：待下令落 PatientDetailPage React。

### 2026-11-03 · 抽 Clinic Comfort 共享层（铺开其它屏的前置）

**为什么做**

图4 认可后要铺工作台（图7）等屏。原状态下范式被锁死在患者详情页里：

- 29 个结构 class 全写成 `.patient-detail-page .cc-*`，换个页面就选不中。
- 外壳靠 `pathname.startsWith('/patients/')` 判断自己是谁，再决定侧栏/顶栏/padding 长什么样。
- 再铺一屏就得再抄一份 `.workbench-page .cc-*`，抄到第三屏就是三套，改阴影要改三处。

**做了什么**

1. **CSS 全局化**：`index.css` 里的 Clinic Comfort 规则整块搬到新文件 `frontend-web/src/styles/clinic-comfort.css`，选择器去掉页面作用域（`.patient-detail-page .cc-hero` → `.cc-hero`）。外壳规则从 `.patient-detail-layout` 改名 `.cc-shell`。视觉零变化——逐条比对改前改后构建产物，全部共有规则体完全一致。
2. **抽共享组件** `frontend-web/src/components/clinic/index.tsx`：
   - `HeroBar` — 留白问候区（眉题 / 标题 / 一句说明 / 一个主操作）
   - `StatBand` — 第一层摘要卡带（最多四张）
   - `Card` — 白底圆卡 + 卡头标题与提示
   - `TwoColumn` — 第二层唯一布局（左主右次，同排等高）
   - `AttentionPanel` — 需关注面板（少而准）
   - `TimeScale` — 刻度（软蓝已登记 / 浅灰未发现登记 / 未到时点描边）
   组件只定**结构**（几列、间距、等高）；**显示哪几个指标由各页自己决定**。
3. **外壳改为显式变体**：`WebLayout` 新增 `variant?: 'standard' | 'comfort'` 与 `crumb` 参数，不再靠 URL 猜。`App.tsx` 新增 `ComfortShell` 包裹组件。
   - 新页面要上 Clinic Comfort → 传 `variant="comfort"`，**不再加路径判断**。

**顺带修掉**：`patient-detail-header / -brand / -search / -content` 这些其实是外壳元素、跟患者详情无关的命名，改成 `cc-shell-*`。

**验证**

- `pnpm run build`（tsc -b && vite）通过；`pnpm run lint` 11 warnings / 0 errors，与改前完全一致（均为既有 `set-state-in-effect`）。
- 端到端截图 `docs/evidence/clinic-comfort-shared-layer/`：患者详情页 `ccPage/ccHero/ccStats/ccStat×4/ccSplit/ccCard×2/ccScale/ccCell×14` 全部落 DOM；旧选择器 `patient-detail-page` / `patient-detail-layout` 计数为 0。
- 收页高与等高实测：第二排两卡同为 263px、顶边同为 407，整页高 710px < 视口 900px（未被拉满）。
- 标准变体页面（工作台 / 患者列表 / 统计）不受影响，`ccShell` 计数为 0。

**产物**

| 产物 | 位置 |
|------|------|
| 共享样式 | `frontend-web/src/styles/clinic-comfort.css` |
| 共享组件 | `frontend-web/src/components/clinic/index.tsx` |
| 外壳变体 | `frontend-web/src/components/WebLayout.tsx`（`variant` + `crumb`） |
| 截图脚本 | `docs/evidence/clinic-comfort-shared-layer/capture_shared_layer.py` |
| 截图证据 | `docs/evidence/clinic-comfort-shared-layer/*.png` |

**下一步**：可以铺图7 工作台了——用 `ComfortShell` + `HeroBar`/`StatBand`/`TwoColumn`，不要新写一套 CSS。

### 2026-11-03 · 图1 登录页按 Clinic Comfort 重做

**为什么做**

共享层抽完后开始逐屏铺。图1 登录页是全站第一屏，也是唯一还没上 Clinic Comfort 的屏。原状态：antd 默认卡（无阴影、8px 圆角）、紫主按钮、品牌标是实心色块，跟图4 的 Clinic Comfort 不是一套。

**范式怎么落到登录页**

登录页只有一件事，**没有第二层内容带**，所以不套 `HeroBar` / `TwoColumn`。落的是同一套视觉语汇：

| 范式要素 | 登录页落法 |
|---|---|
| 浅底大留白 | 整屏 `--bg #F4F6F9`，卡片浮在上方 |
| 白底圆卡 + 轻阴影 | 20px 圆角、`0 8px 24px rgba(26,29,38,0.06)`（原 antd 默认卡无阴影） |
| 诊所蓝主色 | 主按钮 `#5B7CFF`（原为紫 `#573BF4`，随 PR #1 已换） |
| 收页高 | 卡片 452px 高跟内容走，不撑满视口 |
| 控件圆角 14px | 输入框、按钮统一 14px（主按钮高 44px） |
| 刻度母题 | 品牌标改软底方块 `吸`（`--primary-soft` 底 + 16px 圆角），与侧栏 `cc-side-mark` 同一母题 |
| 一层内容 | 登录只有一件事，不堆第二层 |

**改动**

- `styles/clinic-comfort.css` 新增认证页规则（`.auth-page` / `.auth-card` / `.auth-brand` / `.auth-mark`）；`index.css` 里的旧规则删除，登录页也归到共享层。
- `LoginPage.tsx`、`ChangePasswordPage.tsx`：品牌标从 `BrandMark`（实心方块）换成软底 `吸` 方块；输入框补 placeholder。

**验证**

- `pnpm run build` 通过；`pnpm run lint` 11 warnings / 0 errors，与改前一致。
- 端到端截图 `docs/evidence/clinic-comfort-shared-layer/login-0*.png`；计算样式实测：
  - 卡片 `borderRadius 20px`、`boxShadow rgba(26,29,38,0.06) 0px 8px 24px`、宽 400px 高 452px
  - 品牌标底色 `rgb(232,238,255)`（`--primary-soft`）、圆角 16px
  - 主按钮 `rgb(91,124,255)`（`--primary`）、圆角 14px、高 44px
  - 输入框圆角 14px
- 功能回归：错误密码弹「账号或密码错误」且输入内容保留；正确密码 `clinician_a / 123` 正常跳转工作台。
- 窄屏 390px：卡片自适应，无横向溢出。

**说明**：`BrandMark` 组件保留——标准变体（非 comfort）的顶栏还在用它，不在本轮范围。

**下一步**：图2 工作台。用 `ComfortShell` + `HeroBar`/`StatBand`/`TwoColumn`，不要新写一套 CSS。

### 2026-11-03 · 图2 工作台按 Clinic Comfort 重做

**改了什么**

工作台原来是「去卡片化布局」（内容直接放底色上，靠留白与组标题分区），跟图4 的「白底圆卡」是两套思路。这次按 Clinic Comfort 收成两层。

**结构落法**

| 层 | 内容 |
|---|---|
| Hero | 日期眉题 + 「工作台」标题 + 一句交班说明 + 右侧「更多」+ 一个实心主按钮「查看统计」 |
| 第一层 | 四张摘要卡：今日登记 / 近 7 日覆盖 / 负责患者 / 待核查 |
| 第二层 双栏 | 左：近 7 日团队登记（刻度）+ 待核查任务；右：需关注 + 近期随访 |

**共享层这轮补的东西**

- `TeamScale` —— 单行团队刻度（列=日期，无左侧时点列），复用 `cc-cell` 的四态配色
- `QueueRow` —— 卡内行动行（状态点 + 名字 + 时间 + 行尾内联动作）
- `TwoColumn` 改为每栏包一层 `.cc-split-col`：一栏可以放多张卡；只有一张卡时撑满整列（保持图4「两卡等高」），多张时按内容排布

**踩到的坑（值得记）**

1. **行内动作按钮连带触发了整行跳转。** 原因是行 div 用了 `role="button"`，其可访问名把行尾的「处理任务」也包了进去，行尾按钮变成 button 套 button——既是无障碍问题，也让行点击判定失效。
   改法：行本身不再当按钮，只有「名字」那一块是真正的 `<button>`（`.cc-row-link`），行尾动作按钮各管各的。
2. **`TwoColumn` 一栏放多张卡时布局塌了。** 原来 `{children}` 直接当 grid 子项，多张卡会被摊平成 4 个 grid 子项，把 2 列网格冲成 4 项。改法：每栏包一层 `.cc-split-col`。
3. **`.cc-split-col` 用 flex 时，图4 的两卡等高丢了**（263 → 246）。改用 grid + `:has(> .cc-card:only-child)` 给单卡一行 `1fr`，等高恢复。
4. **团队刻度日期头掉行。** `.cc-team-scale` 继承了 `.cc-scale` 的 `56px` 时点列模板，8 个子项塞进 7 列 → 换行。改法：团队刻度单独定 7 列模板，表头与格子各占一行，不留占位格。
5. **窄屏名字被压成一列字。** 行内固定宽度的动作按钮把名字挤到 0 宽。改法：窄屏行改为两行（名字一行、动作一行），并给 `.cc-row-name` 设 `word-break: keep-all`。

**验证**

- `pnpm run build` 通过；`pnpm run lint` 11 warnings / 0 errors，与改前一致。
- 端到端截图 `docs/evidence/clinic-comfort-shared-layer/workbench-0*.png`：
  - 结构断言 `ccPage:1 ccHero:1 ccStats:1 ccStat:4 ccSplit:1 splitCol:2 ccCard:4 teamScale:1 teamCell:7 ccAttn:1 queueRow:14`；旧类 `status-strip` / `page-section` 计数 0
  - 交互回归（逐条点过）：点「处理任务」→ 弹「处理任务 · 杨先生」且**不跳转**；点「补登用药」→ 弹「补登用药 · 杨先生」且不跳转；点患者名 → 进患者详情
  - **患者详情回归**：改 `TwoColumn` 结构后仍是 `cardHeights [263, 263]`、`tops [407, 407]`、整页 710px，与 PR #1 基线完全一致
  - 窄屏 390px：名字单行不折成竖排、双栏折成单列、团队刻度 7 列不溢出

**产物**

| 产物 | 位置 |
|------|------|
| 工作台页面 | `frontend-web/src/pages/clinician/WorkbenchPage.tsx` |
| 新增共享组件 | `frontend-web/src/components/clinic/index.tsx`（`TeamScale` / `QueueRow`） |
| 共享样式 | `frontend-web/src/styles/clinic-comfort.css` |
| 截图脚本 | `docs/evidence/clinic-comfort-shared-layer/capture_workbench.py` |

**下一步**：图3 患者管理列表。按同一范式：Hero + 摘要卡 + 卡内列表（患者列表用 `QueueRow` 形态）。

### 2026-11-03 · 图2 反馈修正：弹窗阴影 + 移动端过长

**反馈一：弹窗背后不该有重阴影，加点模糊就行**

- 根因：antd v6 的 `.ant-modal-container` 用默认三层阴影（最重那层 `0 9px 28px 8px rgba(0,0,0,0.05)`），在浅底上像贴了张黑纸。
- 遮罩是 `rgba(0,0,0,0.45)` 死灰，背景全看得见，跟弹窗抢注意力。
- 改法：
  - `theme.ts` 给 Modal 组件写死 `boxShadow: '0 8px 24px rgba(26,29,38,0.06)'` —— 只留一层，跟内容卡同一把尺。
  - `.ant-modal-mask` / `.ant-drawer-mask` 改 `rgba(244,246,249,0.72)` + `backdrop-filter: blur(6px)`，浅底同色系，背景退到后面而不是被压黑。
  - `@supports not (backdrop-filter)` 退回浅色遮罩，不退回死灰。

**反馈二：手机端页面 2846px 太长**

- 根因：9 条任务每条占两行、每行两个按钮，一屏拉到底。
- 改法（桌面完全不受影响）：
  - `QueueRow` 窄屏把多个行尾动作收进「⋯」浮层 → 每条任务回到一行。
  - 新增 `CollapsibleList`：宽屏默认全展开，窄屏默认只露前 4 条 + 「展开全部 N 条」。

**验证**

- 弹层计算样式实测：`boxShadow rgba(26,29,38,0.06) 0px 8px 24px`（单层）、遮罩 `rgba(244,246,249,0.72)`、`backdrop-filter blur(6px)`。
- 移动端 390px：**2846px → 1871px**；展开后 2156px。
- 桌面 1440px 不变：9 条任务、18 个内联按钮、0 个「⋯」、0 个折叠钮，整页 1277px。
- 移动端 4 条任务、0 个内联按钮、4 个「⋯」、2 个折叠钮；「⋯」浮层点开是「补登用药 / 处理任务」。
- `pnpm run build` 通过；`pnpm run lint` 11 warnings / 0 errors，与改前一致。
- 患者详情回归仍 `cardHeights [263,263]`、`tops [407,407]`、整页 710px。

### 2026-11-03 · 图3 患者管理按 Clinic Comfort 重做

**改了什么**

患者管理原来是 antd Table + 顶栏工具条。按范式收成两层：

| 层 | 内容 |
|---|---|
| Hero | 眉题 + 「患者管理」+ 一句说明 + 实心主按钮「新建患者」 |
| 第一层 | 四张摘要卡：负责患者 / 已绑定账号 / 未绑定账号 / 诊断标签数 |
| 第二层 单栏 | 「患者列表」卡：筛选条 + 患者行 + 轻量分页 |

- 新增共享组件 `FilterBar`（搜索 + 筛选 + 右侧操作一行）和 `PatientRow`（名字编号 / 诊断标签 / 账号状态芯片 / 行尾动作，窄屏动作收「⋯」）。
- 诊断标签里的 `(DEMO)` 标记在展示层清掉（种子数据标记，不该出现在业务文案）。
- 分页从 antd 大分页器换成轻量「上一页 / 1 / 下一页」。
- 筛选选项的 `{text, value}` 写法是 antd Table 的，antd Select 要用 `{label, value}` —— 截图时发现下拉显示原始值，已修。

**验证**

- `pnpm run build` 通过；`pnpm run lint` 11 warnings / 0 errors，与改前一致。
- 端到端截图 `docs/evidence/clinic-comfort-shared-layer/patients-0*.png`：
  - 结构断言：`ccStat:4`、`patientRow:10`、`ccChip:10`；旧类 `ant-table` / `page-toolbar` / `page-header` 计数 0
  - 筛选：选「未绑定」→ 8 行（10 - 2 已绑定，与数据一致）→ 清除 → 10 行
  - 搜索 `P-004` → 1 行「李先生」
  - 点患者名 → 正确进入 `/patients/:id` 详情
  - 新建患者弹窗正常打开
  - 窄屏 390px：摘要卡两列、筛选堆叠、每行收成「名字+编号+状态+⋯」，整页 1689px
- 患者详情回归仍 `cardHeights [263,263]`、`tops [407,407]`、710px。

### 2026-11-03 · 图5 用药计划编辑按 Clinic Comfort 重做

**改了什么**

| 层 | 内容 |
|---|---|
| Hero | 眉题 + 「用药计划编辑」+ 一句说明 + 右上角患者选择器（页面入口控件） |
| 第一层 | 四张摘要卡：历史版本 / 当前版本（v2 · 药名）/ 计划类型 / 每日时点数 |
| 第二层双栏 | 左=新建计划表单卡；右=历史版本卡（版本行 + 生效/类型芯片 + 时点芯片） |

- 未选患者时显示「开始使用」引导卡，摘要显示「—」。
- 「按需计划」类型下每日时点输入框自动隐藏（`Form.useWatch`）。
- **顺带修了一个展示 bug**：`ends_at === null` 就标「生效中」，未来才开始的计划也标生效。现在按时间轴判断，分「生效中 / 待生效 / 已关闭」三态；「当前版本」摘要同步只认已生效的。
- 新增共享 CSS：`cc-form-grid`（日期双列）、`cc-plan-version/cc-plan-times`（版本行）。

**验证**

- `pnpm run build` 通过；`pnpm run lint` 11 warnings / 0 errors（中途因渲染期 `Date.now()` 涨到 14，改用 `useState` 初始化器取时间后回到 11）。
- 端到端截图 `plans-0*.png`：结构断言 `ccStat:4`、`heroSelect:1`，旧类 `page-header` / `ant-table` 计数 0。
- 摘要数字正确：历史版本 2 / 当前 v2 · 硫酸沙丁胺醇 / 固定 / 时点 2。
- 「按需计划」切过去时点输入框消失。
- **真实创建**：填齐型号/药名/日期后提交 → 新版本入库、列表即时刷新。
- 窄屏 390px：单列堆叠，整页 1819px。

**遗留**：截图验证往演示库写了 2 条「验证用药物（截图测试）」计划（李先生名下），待跑 `seed/demo_data_full.py` 清理（删业务数据，等主人点头）。

### 2026-11-03 · 图5 用药计划编辑改成干活页（砍掉四卡）

**为什么砍四卡**

上一轮把图5套成了图4 的仪表盘：Hero + 四张摘要卡（历史版本数 / 当前版本 / 计划类型 / 每日时点）+ 等高双栏。这页的任务是选中患者后**填写新计划、对照历史**，四张大数字不参与填写，只是指标表演。用户看了现稿，明确说别扭。

**新骨架**

| 块 | 内容 |
|---|---|
| 瘦 Hero | 眉题「用药计划 · 已选/未选」+ 标题「用药计划」或「为某某编辑方案」+ 一行说明。右侧患者选择器是本页主切换 |
| 轻量元信息 | 有生效（或仅待生效）方案时，Hero 下一行一排小芯片：药名 · 固定/按需 · 时点 · 版本。没有就不占位 |
| 主 | 「新建计划」表单，栏更宽 |
| 次 | 历史版本，状态芯片保留。`TwoColumn natural`：顶对齐、高度随内容，不把短的历史卡或表单拉成假等高 |

未选患者时只留一块「先选择患者」，不再渲染空壳四卡。

**共享层**

- `TwoColumn` 增加 `natural`。默认仍是图4 的等高；本页显式关掉。
- 样式只加在 `.cc-plan-page` / `.cc-split-natural`，不改其它屏的四卡和等高。窄屏（≤1100px）本页也收成单列，避免更具体的栏宽把表单挤没。
- 裸 `.cc-chip` 补了浅底，历史里的「已关闭 / 待生效 / 时点」才是芯片而不是加粗字。带 `blue` / `warn` 的芯片颜色不变。

**文案与接口对齐（评审后）**

- 时点框去掉 `08:00 / 20:00` 占位。那两行灰字看起来像已经填好，林女士真实时点是 09:00 / 21:00 时会对不上。固定计划改为必填；空着不再悄悄提交成 08:00、20:00。提交体仍是 `daily_times[]`，与接口「固定计划至少一个时点」一致。
- 删掉「创建后原计划自动关闭」。本页走的是 `POST /medication-plans`（新计划组、version 1），不会改旧版本的 `ends_at`。自动关闭只发生在修订接口，这个表单没调用它。

**没改的**

创建、查询的路径和字段，以及生效状态判断（已开始且 `ends_at === null` 才算生效中）保持原样。

**产物**

| 产物 | 位置 |
|------|------|
| 页面 | `frontend-web/src/pages/clinician/PlanEditPage.tsx` |
| Surface brief | `.impeccable/surfaces/plan-edit.md` |
| 桌面截图 | `docs/evidence/clinic-comfort-plan-edit/`（未选患者、李先生、林女士当前生效行） |

### 2026-11-03 · 统计与核查改成矩阵干活页

**为什么这样排**

这页的任务是看团队覆盖矩阵、登记情况，以及一位患者的报告。上一版把团队覆盖率做成大数字主角，患者报告再配覆盖率环和三列指标，读起来像仪表盘。矩阵和表才是要扫的东西。

**骨架**

| 块 | 内容 |
|---|---|
| 瘦 Hero | 眉题是日期区间，标题「统计与核查」，一行说明。没有实心主按钮 |
| 日期条 | 开始、结束、重置为近 7 日。两个页签共用 |
| 团队概览 | 矩阵上方一行元信息：覆盖率、已登记/应记录、有固定计划、负责患者。下面两张卡：覆盖矩阵、登记情况（缺失多的在前，点行或点矩阵里的名字进入报告） |
| 患者报告 | 患者选择在页签里。同一行元信息换成这个人的覆盖率、分子分母和缺失数，下面按原报告往下排：逐日覆盖、缺失时点、来源、随访摘要、有则显示重复登记 |

没有摘要四卡，也没有左右双栏。页高跟着内容，窄屏日期条和表可以换行、横向滚。

**刻度**

矩阵格子跟 Clinic Comfort 刻度同一套：已登记软蓝、部分登记描边、未发现登记浅灰、无计划时点只留细框。图例写在矩阵下面。趋势线和登记表里的覆盖条改成诊所蓝。缺失数字不再用红色，柱子也不涂青黑。

**没改的**

`/api/stats/matrix`、`/api/stats/overview`、患者统计、趋势和随访过滤的口径都没动。免责声明仍是「记录覆盖率≠真实用药依从性」。已打开报告时改日期会按同一患者重查，避免区间和报告对不上。

**验证**

- `pnpm run build` 通过。
- 桌面 1440，clinician_a，近 7 日：概览没有摘要卡、没有双栏；矩阵 10 行，登记表 10 行；元信息 73.1%、已登记 98 / 应记录 134。
- 点林女士进入报告：71.4%，已登记 10 / 应记录 14，缺失 4；趋势、缺失时点、来源、随访、重复登记按单列往下排。
- 外壳改用 Clinic Comfort，概览内容高约 1834px，视口 900px，没有把空白撑满一屏。

**产物**

| 产物 | 位置 |
|------|------|
| 页面 | `frontend-web/src/pages/clinician/StatsPage.tsx` |
| 矩阵 / 趋势色 | `frontend-web/src/components/CoverageHeatmap.tsx`、`CoverageTrendChart.tsx` |
| 桌面截图 | `docs/evidence/clinic-comfort-rollout-2/stats-01-overview-desktop.png`、`stats-02-report-desktop.png` |

### 2026-11-03 · 随访中心改成队列干活页

**为什么这样排**

这页要跟进待核查、记下随访。旧版是左队列右表单的常驻双栏，表单空着也占着半屏。队列和记录才是要扫的东西。

**骨架**

| 块 | 内容 |
|---|---|
| 瘦 Hero | 眉题写待核查条数（没有待核查就写已清空）。只有一颗实心按钮「新建随访」 |
| 记录随访 | 点新建，或点某一行的「填写随访」才出现。患者和关联任务会带上。保存是这时唯一的实心按钮，写完收起 |
| 待核查 | 整行可点。行尾是「快速处理」和「填写随访」，不另做摘要卡 |
| 随访记录 | 默认是负责患者最近的记录。上面一个患者筛选，选中后只看这一位 |

没有四张摘要，也没有左右对切。空队列是一句「暂无待核查任务」，不放空状态大图。

**没改的**

保存随访仍是 `POST /api/followups`，字段、关闭任务、复训提醒都不变。快速处理仍走原来的弹窗。团队记录用已有的 `GET /api/followups`，按患者看仍用 `GET /api/patients/{id}/followups`。

**验证**

- `pnpm run build` 通过。
- 桌面 1440，clinician_a：待核查 4 条，记录 6 条，摘要卡 0，双栏 0，实心按钮只有「新建随访」。
- 从陈先生那一行点「填写随访」：表单带上患者和 11/03 14:33 的任务，下面的记录筛成陈先生。没有提交，演示库没多一条随访。

**产物**

| 产物 | 位置 |
|------|------|
| 页面 | `frontend-web/src/pages/clinician/FollowupPage.tsx` |
| 桌面截图 | `docs/evidence/clinic-comfort-rollout-2/followups-01-queue-desktop.png`、`followups-02-composer-desktop.png`、`followups-03-from-task-desktop.png` |

随访记录改成卡内一行三列（时间、患者、反馈 · 措施 · 后续），不再把段落贴在左缘。待核查和记录默认各最多 5 条（`VISIBLE_STEP`），超出显示「展开更多（还剩 x）」，再点下一批，可收起。桌面：`followups-04-collapsed-desktop.png`（5 条 + 还剩 1）、`followups-05-expanded-desktop.png`（6 条 + 收起）。待核查这次只有 4 条，不到上限，所以没有展开按钮。

### 2026-11-03 · 工作台收成交班操作台

**为什么改**

工作台已经是 Clinic Comfort，但套了四张大数字（今日登记、近 7 日覆盖、负责患者、待核查），待核查又挤在左栏里，补登和处理不好扫。这页是交班：看刻度、看该关注谁、把待核查处理掉。

**骨架**

| 层 | 内容 |
|---|---|
| 瘦摘要 | 不再用四张卡。Hero 下面一行：今日到期情况、已登记/已到期（有数才出现）、截至时间、待核查条数。「负责患者」这种不推动动作的数字拿掉。近 7 日覆盖留给刻度，不重复做一张大卡 |
| 关注 / 刻度 | 左是近 7 日团队刻度，右是需关注。两栏顶对齐，短的不拉高。刻度仍是软蓝 / 描边 / 浅灰 |
| 待核查 | 单独占满下一层。每行名字、编号、时间，行尾「补登用药」「处理任务」 |
| 近期随访 | 有记录才出现，放在队列下面，不当成第二套仪表盘 |

空的待核查只留一句说明，不用呼吸波纹那张空图充门面。Hero 不再放「查看统计」实心按钮，去统计在「更多」里。

**没改的**

今日矩阵、近 7 日矩阵、任务和随访的接口与计算都没动。补登弹窗、处理任务弹窗还是原来的。

**验证**

- `pnpm run build` 通过。
- 桌面 1440：摘要卡 0，待核查 4 行，行上能看到「补登用药」「处理任务」。这一次捕获里今日没有已到期时点，元信息直接写「今日暂无已到期时点」，没有用 0% 大卡占位。
- 内容高约 1172px，视口 900px。

**产物**

| 产物 | 位置 |
|------|------|
| 页面 | `frontend-web/src/pages/clinician/WorkbenchPage.tsx` |
| 桌面截图 | `docs/evidence/clinic-comfort-rollout-2/workbench-01-desk-desktop.png` |

### 2026-11-03 · 患者管理把表留成主角

**为什么改**

患者管理已经是 Clinic Comfort，但 Hero 下面仍是四张摘要：负责患者、已绑定、未绑定、诊断标签数。诊断标签数不推动任何动作，已绑定只是未绑定的反面。要看的是表和筛选。

**骨架**

| 块 | 内容 |
|---|---|
| 瘦 Hero | 一句里写总人数。这一页有未绑定的人，就写出来。实心按钮仍只有「新建患者」 |
| 患者列表 | 搜索、诊断、账号状态留在表头。没有再加一栏凑对称 |
| 未绑定 | 不再做大卡。这一页有未绑定时，表头右侧是一颗芯片「筛出未绑定 · 本页 n」，点下去就套上账号筛选。已经在筛未绑定时，芯片改成文字，避免重复动作 |

口径仍是当前这一页，不是全库总数。不新增接口。

**验证**

- `pnpm run build` 通过。
- 桌面 1440，clinician_a：摘要卡 0，双栏 0，列表 10 行。说明是「共 10 位。这一页有 8 位还没绑定账号。」
- 点芯片后变成 8 行，筛选条显示「未绑定」，可以清除。没有新建患者。

**产物**

| 产物 | 位置 |
|------|------|
| 页面 | `frontend-web/src/pages/clinician/PatientListPage.tsx` |
| 桌面截图 | `docs/evidence/clinic-comfort-rollout-2/patients-01-list-desktop.png`、`patients-02-unbound-desktop.png` |

### 2026-11-04 · 今日环去掉旧紫，并收一份优化后全站画廊

**色**

`TodayProgressCard` 圆环的 `strokeColor` 还是旧靛紫 `#573BF4`。改成诊所蓝 `#5B7CFF`，与 `CoverageTrendChart` 和矩阵刻度同一主色。只动这一处颜色，统计口径、接口和统计页结构都不动。`frontend-web/src` 里已没有 `#573BF4` / `#573bf4`。

**画廊**

`docs/evidence/clinic-comfort-full-ui/index.html`。15 张，分组和说明句式对齐 `docs/evidence/full-ui-2026-10-26/index.html`。图片复制进该目录，相对路径，`file://` 可直接打开。页头用诊所蓝软胶囊，不再用旧紫。

图 6 / 图 7 已在 PR #3 改完。原图仍是：

- `docs/evidence/clinic-comfort-rollout-2/stats-01-overview-desktop.png`
- `docs/evidence/clinic-comfort-rollout-2/stats-02-report-desktop.png`

画廊副本是 `06-stats-overview.png`、`07-stats-report.png`。

图 14 知识内容、图 15 审计日志原先没有现成文件。管理端 Clinic Comfort 外壳在 `refactor/clinic-comfort-shared-layer`（本分支没改管理端页面）。用该外壳对着演示库实拍了这两个页签：知识内容 3 条已发布稿，审计日志 32 条。页签下划线和主按钮是 `rgb(91, 124, 255)`。

### 2026-11-03 晚（America/New_York）· 全站画廊复盘

主人当晚看完 Clinic Comfort 全站画廊，要求以后每次改动都留下：当时什么别扭、为什么改、改了什么。画廊文件见上一条（落盘记为 2026-11-04）。这条只记复盘，不改界面。

还有一些人性化问题主人说得出来「有」，但还叫不出名字。先空着，等能指到某一屏、某一块再写。不提前编问题。

#### 复盘约定

从此每条 Clinic Comfort / UI 改动至少写这五栏：

| 栏 | 写什么 |
|----|--------|
| 问题 | 哪里别扭，主人或使用时卡在哪 |
| 原因 | 为什么动它：任务对不对、够不够好扫、是不是 token / 外壳 |
| 改动 | 实际改了什么 |
| 证据 | 路径（页面、截图、日志条目） |
| 未改 / 风险 | 没动的口径、接口、或还没验证的假设。没有就写「无」 |

已有条目不改写。缺一行「问题 / 原因」的，用下面的索引补指针。图 1 登录、图 2 工作台、图 3 患者列表的「为什么」已经写在各自正文里，索引不重复。

#### 已有改动索引（问题 / 原因）

| 条目 | 问题 | 原因 | 证据 |
|------|------|------|------|
| 共享层 | 范式写死在患者详情的选择器和「看 URL 决定外壳」上，下一屏就要再抄一套 | 先把外壳和结构组件抽出来，各屏复用 | `frontend-web/src/styles/clinic-comfort.css`、`frontend-web/src/components/clinic/index.tsx`；`docs/evidence/clinic-comfort-shared-layer/` |
| 图4 患者详情 | 首屏被档案和流水占住，看不清是谁、怎样、下一步 | 收成决策台：问候、摘要、近 7 日刻度、需关注。页高跟着内容 | 上文「复盘节点 · 图4」；画廊 `docs/evidence/clinic-comfort-full-ui/04-patient-detail.png` |
| 图5 用药计划 | 套了图4 的四张大数字，填计划时用不上 | 这页的任务是写新计划、对照历史 | `frontend-web/src/pages/clinician/PlanEditPage.tsx`；`docs/evidence/clinic-comfort-plan-edit/plans-02-selected.png` |
| 图6 团队概览 | 团队覆盖率做成大数字主角，要扫的是矩阵和登记表 | 收成日期、一行元信息、矩阵、登记情况。口径不改 | `frontend-web/src/pages/clinician/StatsPage.tsx`；`docs/evidence/clinic-comfort-rollout-2/stats-01-overview-desktop.png`（画廊 `06-stats-overview.png`） |
| 图7 患者报告 | 覆盖率环和三列指标读起来像仪表盘 | 同一人的报告按原内容单列往下排 | `docs/evidence/clinic-comfort-rollout-2/stats-02-report-desktop.png`（画廊 `07-stats-report.png`） |
| 图8 随访中心 | 空表单也占着半屏；记录贴边，一屏拉得很长 | 队列和记录才是要扫的。表单点开才出现。默认最多 5 条，其余「展开更多」 | `frontend-web/src/pages/clinician/FollowupPage.tsx`；`docs/evidence/clinic-comfort-rollout-2/followups-04-collapsed-desktop.png` |
| 管理端外壳 | 管理端还是旧页头，和医护端不是一套 | 装置型号、指导版本、账号收进同一张管理卡。代码在 `refactor/clinic-comfort-shared-layer`，本分支没改管理端 | 画廊 `11-admin-device-models.png` 至 `15-admin-audit.png` |
| 今日环旧紫 | 圆环仍硬编码 `#573BF4`，趋势线和矩阵已经是诊所蓝 | 只对齐颜色，不改统计定义 | `frontend-web/src/components/TodayProgressCard.tsx` |
| 全站画廊 | 优化后的 15 屏散在多个目录，不能一次看完 | 按 10 月 26 日那份的分组和说明句式收成一页 | `docs/evidence/clinic-comfort-full-ui/index.html` |

#### 画廊上新点出的问题（未改）

**总观**

| 栏 | 内容 |
|----|------|
| 问题 | 很多地方还不够好用、不够顺。画廊逐屏看下来，别扭已经超出配色和外壳，卡在布局本身。 |
| 原因 | 前几轮主要在收 token、共享层，以及别再套「四张摘要卡」。好不好扫、侧栏和内容怎么一起长，还没当成每页的完成标准。 |
| 改动 | 无。本条只记录。 |
| 证据 | `docs/evidence/clinic-comfort-full-ui/` |
| 未改 / 风险 | 还有一批叫不出名字的问题。等能指到具体屏再记、再改。 |

**图4 患者详情 · 侧边栏过短**

| 栏 | 内容 |
|----|------|
| 问题 | 侧栏的高度和看上去的长度跟优化前对不上，像被截短了，和原来的壳不匹配。 |
| 原因 | 假设，不当成已核实的改法：ComfortShell 按内容收高时，主栏内容短，侧栏可能跟着收短，而不是像旧布局那样铺满视口。共享层验证里图4 整页约 710px，视口 900px，收页高是当时故意的。 |
| 改动 | 无。 |
| 证据 | 画廊 `docs/evidence/clinic-comfort-full-ui/04-patient-detail.png`；上文共享层条目「整页高 710px < 视口 900px」。 |
| 未改 / 风险 | 假设还没验证。补高度时不要把内容卡拉满（上文节奏教训：不用 stretch 硬拉格）。若以后修，只核对外壳和侧栏要不要单独铺满视口，和内容收高分开。 |

**图6 统计与核查 · 团队概览**

| 栏 | 内容 |
|----|------|
| 问题 | 侧栏被拉得很长。这一页把矩阵和整张登记情况一次铺开，页有多高，侧栏就多高。 |
| 原因 | 登记情况默认露出全部行。随访中心已经是默认一段再「展开更多」，统计页没有用同一套，所以整页（画廊图高 1898px）和侧栏一起被撑高。 |
| 改动 | 无。主人要求下一步：登记情况改成展开模式，精神与随访中心相同（默认 N 条 + 「展开更多」），页面和侧栏不必这么高。 |
| 证据 | 画廊 `docs/evidence/clinic-comfort-full-ui/06-stats-overview.png`（原图 `docs/evidence/clinic-comfort-rollout-2/stats-01-overview-desktop.png`）。对照 `followups-04-collapsed-desktop.png`。 |
| 未改 / 风险 | 展开只改默认露出的行数。排序仍是缺失多的在前。不改 `/api/stats` 和统计定义。 |

### 2026-11-04 · 侧栏铺满视口，登记情况先露 5 行

画廊本来就是 Clinic Comfort。主人打开 `index.html` 觉得没变，是因为当时的 04 / 06 还拍着没修的摩擦：短页侧栏不到视口底，登记情况一次铺开。下面这两处按「2026-11-03 晚」那条复盘改完，画廊里的 04、06 已换成新图。图 7 报告内容没动，07 不换。

**图4 患者详情 · 侧栏**

| 栏 | 内容 |
|----|------|
| 问题 | 内容短的时候侧栏跟着收短，和改 Clinic Comfort 之前铺满视口的壳对不上。 |
| 原因 | 外壳把页面收成「内容多高页多高」（`min-height: 0`）。侧栏是这一列，就一起短了。要补的是外壳高度，不是把卡片拉高。 |
| 改动 | `.cc-shell` 至少 `100vh`。顶栏下面那一行 `flex: 1`，侧栏和 `.side-menu` 拉满这一列，退出停在栏底。主栏里的卡片不 stretch，也不垫空白卡。图4 两张内容卡仍各 263px。 |
| 证据 | 改前 `docs/evidence/clinic-comfort-humanize/04-patient-detail-before.png`。改后 `04-patient-detail-after.png`，画廊 `docs/evidence/clinic-comfort-full-ui/04-patient-detail.png`，副本 `docs/evidence/clinic-comfort-rollout-2/patient-detail-sidebar-desktop.png`。视口 900：侧栏高 836、底边在 900；主内容高 570、底边在 670。 |
| 未改 / 风险 | 内容高于一屏时，侧栏仍跟着整页长，和改之前的壳一样。登录页不走这套外壳。 |

**图6 团队概览 · 登记情况**

| 栏 | 内容 |
|----|------|
| 问题 | 登记表默认铺开全部行，页和侧栏被拉得很长。 |
| 原因 | 随访中心已经是默认 5 条再「展开更多」。统计页没有用同一套。 |
| 改动 | `ROSTER_STEP = 5`。排序仍是缺失多的在前，默认只露前 5 行。按钮是「展开更多（还剩 x）」，一次再露 5 行，可「收起」。换日期回到 5 行。 |
| 证据 | 改前 `docs/evidence/clinic-comfort-humanize/06-stats-overview-before.png`（旧画廊图高 1898）。改后默认 `06-stats-overview-after.png`，整页高 1614，5 行缺失 7 / 6 / 5 / 4 / 4。展开 10 行、整页 1953：`06-stats-overview-expanded.png`。画廊 `06-stats-overview.png` 是收起后的这一张。 |
| 未改 / 风险 | `/api/stats` 和统计定义没动。矩阵仍全部露出，所以这一页还是高于一屏，侧栏跟着页面走。图7 报告不改。 |

### 2026-11-03 更晚（America/New_York）· 医护侧栏应钉在视口里

主人看完全站之后补的一条。上一轮只把短页侧栏拉到视口底，长页仍跟着主内容一起滚。本条只记账，不改代码。

**全站医护壳 · 侧栏**

| 栏 | 内容 |
|----|------|
| 问题 | 医护侧栏应对用户表现为固定（sticky / fixed）：钉在视口里，不跟着主内容整页乱窜。行为要对齐图4 修好后的样子。不要在侧栏最底下再挂一块用户登录、头像和退出（至少不要以现在这种拖在栏底、随页滚动的方式出现）。主人说「这都不知道，其他页面都是这样」——全站医护壳同一问题，不只某一页。 |
| 原因 | 假设，未改代码、也未再核实：用户区放在侧栏底部，高度跟着页面和侧栏走。内容短时栏底刚好在视口底，看起来像钉住；内容一长，整栏连同底部用户区一起滚走，就不像固定导航。这和「侧栏应始终像图4 那样钉住」不一致。 |
| 改动 | 无。 |
| 证据 | 短页栏底贴着视口：画廊 `docs/evidence/clinic-comfort-full-ui/04-patient-detail.png`（侧栏高 836，底边在 900，`clinician_a` 和退出在栏底）。长页整栏跟着走：`docs/evidence/clinic-comfort-humanize/06-stats-overview-after.png`（整页高 1614，侧栏高 1550，用户区在页底）。工作台、患者、计划、随访用的是同一套 ComfortShell。 |
| 未改 / 风险 | 下一步意向：全站 ComfortShell 侧栏统一成固定导航。用户区放哪等主人拍板：移出侧栏、收到顶栏，或仍留在侧栏里但 sticky、不随页滚。登录页不在这套壳里。在拍板前不要先把用户区删掉或挪走。 |

### 2026-11-04 · 医护侧栏钉在视口，用户区停在栏底

主人拍板：全站 ComfortShell 侧栏固定。用户和退出留在侧栏里，但钉在视口栏底，不跟主栏滚走。

**全站医护壳 · 侧栏**

| 栏 | 内容 |
|----|------|
| 问题 | 上一轮只把短页侧栏拉到视口底。内容一长，整栏连同底部的账号和退出一起滚走。全站医护页都是这一套壳。 |
| 原因 | 侧栏高度跟着主栏内容长。用户区用栏底布局，页有多长它就落在多下面。要对齐的是图4 那种「侧栏始终在视口里」。 |
| 改动 | 外壳锁成一屏（仍保留 `min-height: 100vh`）。主栏 `.cc-shell-content` 自己滚动，窗口不滚。侧栏高度等于视口减去顶栏，菜单过长时只滚菜单。账号和退出仍在 `.sider-foot`，停在视口栏底。卡片不拉高。登录页和管理端不走这套壳。 |
| 证据 | 短页图4：`docs/evidence/clinic-comfort-humanize/04-sidebar-sticky-short.png`，画廊 `docs/evidence/clinic-comfort-full-ui/04-patient-detail.png`。视口 900，侧栏顶 64 底 900，用户区底边 900；主内容高 570、底边 670；两张内容卡仍各 263px。长页图6 滚前侧栏同样顶 64 底 900，主栏可滚高度 1550。滚到登记情况后（`contentScroll` 714）侧栏顶仍是 64、用户区底边仍是 900，窗口 `scrollY` 为 0：`06-sidebar-sticky-scrolled.png`，画廊 `06-stats-overview.png`。 |
| 未改 / 风险 | 统计口径和登记展开没动。管理端仍是标准壳。窄屏侧栏收成图标时，用户名藏起，退出仍在栏底。 |

