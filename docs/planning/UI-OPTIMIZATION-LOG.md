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

