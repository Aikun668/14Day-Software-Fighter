---
name: 吸入治疗指导与依从性辅助管理 · 医护 Web
description: Clinic Comfort Operate UI — soft light workspace, hero air, two content bands, one primary action
colors:
  bg: "#F4F6F9"
  surface: "#FFFFFF"
  surface-soft: "#EEF2F7"
  line: "#E5EAF1"
  ink: "#1A1D26"
  ink-2: "#4A5160"
  muted: "#8B93A7"
  primary: "#5B7CFF"
  primary-soft: "#E8EEFF"
  primary-text: "#3D56C7"
  primary-ring: "#C5D0FF"
  ok: "#1F9D7A"
  ok-soft: "#E4F7F1"
  warn: "#D97706"
  warn-soft: "#FFF4E5"
  miss-fill: "#EEF1F6"
  miss-ring: "#C8CEDA"
  chip-violet: "#F0EBFF"
  outer-chrome: "#DDE3EC"
typography:
  display:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "8px"
  md: "14px"
  lg: "20px"
  frame: "28px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  page-x: "40px"
  page-y: "36px"
  hero-pad-bottom: "36px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "22px 24px"
  nav-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.md}"
    padding: "11px 12px"
  scale-cell-ok:
    backgroundColor: "{colors.primary-soft}"
    rounded: "{rounded.sm}"
  scale-cell-miss:
    backgroundColor: "{colors.miss-fill}"
    rounded: "{rounded.sm}"
---

# DESIGN.md

> 定稿依据：`redesign-preview/04-patient-detail-aurelia.html`（2026-11-03 主人确认「差不多就可以」）  
> 观感参考：`docs/planning/design-refs/ref-aurelia-health-overview.png`  
> 产品口径：`PRODUCT.md`（覆盖 ≠ 依从性；「未发现登记」；禁漏药 / 禁红惩罚）

## Overview

医护 Web 视觉世界定为 **Clinic Comfort**：浅灰底、大圆角白卡片、轻阴影、松呼吸留白、淡色状态芯片。情绪是「诊所工作台舒服」，不是密集 CRM，也不是营销落地页。

模式 **Operate**：扫一眼能判断、点一下能做事。辨识度来自节奏与克制，不来自大面积色墙。

旧方向 B 靛紫 `#573BF4` **不再作主色**；主色迁到诊所蓝 `#5B7CFF`。业务语义与术语不变。

## Colors

| 角色 | Token | 用途 |
|------|-------|------|
| 页面底 | `bg` `#F4F6F9` | 主内容区背景 |
| 卡片 | `surface` `#FFFFFF` | 模块表面 |
| 线 | `line` `#E5EAF1` | 轻分割 |
| 主色 | `primary` `#5B7CFF` | 主按钮、激活、已登记软底 |
| 主色软 | `primary-soft` `#E8EEFF` | 导航激活、刻度已登记 |
| 警示 | `warn` / `warn-soft` | 待处理芯片（非惩罚） |
| 未发现登记 | `miss-fill` `#EEF1F6` + `miss-ring` `#C8CEDA` | 刻度缺格 |

**刻度同色温：** 已登记软蓝、未发现登记浅灰描边。禁止青绿块 + 实心深墨块对撞。

## Typography

- 栈：`Inter` + 苹方 / 雅黑。
- 页标题约 32px 半粗；区块标题 16px；正文 14px；元信息 12px。
- 欢迎区一句副文即可，不堆编号/方案标签。

## Layout

### 结构节奏（已钉）

1. **Hero air（故意留白）** — 日期眉题 + 大标题问候 + 一行药/时点说明 + 右侧一个主按钮。不在此塞控件墙。
2. **第一层** — 最多四张摘要卡（覆盖、未发现登记、账号、待随访等）。
3. **第二层** — 仅双栏：近 7 日时点刻度 | 需关注。  
4. **没有第三层** — 不放「当前治疗 / 近期变化」底栏卡；版本号、固定方案、装置空态等默认删除。

### 页高

- **收页高：** 内容多高页面多高；禁止用 `min-height` / stretch 把格子或卡片硬拉满视口。
- 主栏左右 padding ≈ 40px；模块间距 16–20px。

### 动作

- 每屏一个实心主按钮；其余进「更多」或描边按钮。

## Elevation & Depth

- 卡片阴影约 `0 8px 24px rgba(26,29,38,0.06)`。
- 无渐变炫光、无厚投影、无紫左边框装饰条。

## Shapes

- 外框预览可用 ~28px；内容卡 ~20px；控件 ~14px；芯片 pill。
- 刻度格圆角 ~10px，高度约 40px（自然尺寸，不随视口拉伸）。

## Components

- **顶栏：** 轻；左面包屑，右搜索 + 头像。
- **侧栏：** 白底；激活项主色软底。
- **摘要卡：** 大数字 + 短说明。
- **刻度：** 产品签名件；视觉像周日程格。
- **需关注：** 少而准（默认 2 条级）；淡底行 + 芯片。

## Do's and Don'ts

**Do**

- 先删后加；如无必要，信息不出现。
- Hero 留呼吸；两层收住；页高跟内容。
- 刻度状态保持冷色一家。
- DEMO 明示；文案冷静短句。

**Don't**

- 三层模块叠满；硬拉组件填空白。
- 青+黑刻度、漏药、红惩罚、多颗实心主按钮并排。
- 版本号 / 固定方案 / 空装置等元数据刷屏。
- 把参考图英文文案或假指标原样搬进产品。

## Source of truth

| 文件 | 角色 |
|------|------|
| `PRODUCT.md` | 产品与口径 |
| `DESIGN.md` | 本文件 · 视觉世界 |
| `.impeccable/surfaces/patient-detail.md` | 图4 表面 brief（结构随本 DESIGN 更新） |
| `redesign-preview/04-patient-detail-aurelia.html` | 已确认视觉样板 |
