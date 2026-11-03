# Surface brief — 患者详情（医护 Web）

**Mode:** Operate  
**Target:** `/patients/:id` · 图4 样板  
**Visual authority:** DESIGN.md「Clinic Comfort」+ PRODUCT.md  
**Fidelity:** 已确认静态预览 `redesign-preview/04-patient-detail-aurelia.html` → 下一步落 React

## Job and audience

呼吸科医护从患者列表点进某一患者。要马上判断「这人现在怎样」并决定绑定 / 补登 / 随访等下一步。

## Outcome and proof

- 3 秒内形成判断；首屏：问候身份、四摘要卡、刻度、需关注、一个主操作。
- 刻度 = 登记覆盖；文案「未发现登记」；覆盖 ≠ 依从性。

## Selected direction

- Hero air → 摘要卡 → 刻度|需关注（仅两层）。
- 收页高；不硬拉组件。
- 刻度：软蓝已登记 / 浅灰未发现登记。
- 删除：版本号、固定方案、装置空态、底栏治疗/近期卡。

## Anti-goals

- 三层挤满、硬 stretch、青+黑刻度、漏药、红惩罚、多主按钮。

## FINISH

样板已确认；落 `PatientDetailPage` 前以本 brief + DESIGN.md 为准。
