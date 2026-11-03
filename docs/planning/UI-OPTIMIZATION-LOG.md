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

