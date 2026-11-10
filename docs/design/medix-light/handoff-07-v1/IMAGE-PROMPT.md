# 07 图像生成记录

工具：内置 image_gen；非CLI。唯一风格参考为已批准06，旧07仅由代理读图核对功能，不作为生成风格输入。

## 第一轮提示词

Use case: ui-mockup. Generate ONE high-fidelity Chinese medical clinician web app screenshot, page 07 "患者报告", using the attached approved page06 image as the sole visual style reference. This is a new sibling page, NOT a collage. Aim at 1440 x 1080 portrait-ish desktop full-page canvas, with legible Chinese, no browser chrome.
Preserve reference's white 240px sidebar, white 80px topbar, #F6F6F6 neutral main canvas, purple brand "吸入治疗管理", sidebar menu 工作台 / 患者管理 / 用药计划 / 统计与核查 / 随访中心, active 统计与核查 with pale purple fill, small friendly doctor illustration at sidebar bottom. Topbar search 搜索患者, small realistic clinician portrait, clinician_a, 退出. Match reference icon language and quiet gray typography. Light modest 8px corners, flat white panels, thin row dividers, no nested content cards, no heavy shadows. Main title medium20px, body15–16px, do not shrink content into tiny explanations.
Main header: "统计与核查", discreet "示例数据" tag, right date picker "2026-11-02—2026-11-08", small "近7日" control. Next two tabs "团队概览" inactive, "患者报告" active PURPLE underline.
Under tabs one slim white horizontal identity/summary strip: left photorealistic fictional Chinese middle-aged male portrait and dropdown "李先生"; right three well-spaced compact fields "登记覆盖 85.7%" | "已登记 12 / 应记录 14" | "未发现登记 2". No patient code, no second line under name, no colored dots, no trend arrows, no repeated page title.
Next full-width white panel, title "每日登记覆盖", an info icon at right. BLUE #4C91ED line chart with 7 days 11/02,11/03,11/04,11/05,11/06,11/07,11/08. Values EXACTLY 100%,50%,100%,100%,50%,100%,100%, with small round points and no huge filled area; y-axis 0%,50%,100%, subtle grid. Every day has N=2; series totals M=12,N=14. Keep correct data geometry. No purple chart.
Next row TWO sibling white panels (not nested): left "未发现登记时点" with two airy rows, each small APRICOT #E8B77E horizontal indicator and exact text "11/03 20:00" and "11/06 08:00". Right "登记来源" with compact horizontal bars and text "患者自述 10" in TEAL #43B7A0 and "医护观察 3" in BLUE #4C91ED; header tiny info icon, these are event counts not percentages. Values 10+3=13 because one duplicate event, do not show 12 total here.
Below full-width white panel "随访摘要" with gray "查看全部" action. One clean table header 时间 / 反馈 / 措施 / 后续, one row "11/07 10:30" / "需核对登记" / "电话随访" / "继续随访". Measures light mint tag with dark text, next step light apricot tag with dark text. No long notes or subtitle.
Bottom full-width shallow white panel "重复登记" with two columns 应记录时间 / 有效登记条数, one row "11/04 08:00" / "2". Enough padding and no clipped bottom. The duplicate does not increase M. Show this section explicitly.
Color discipline: purple ONLY brand, navigation/tabs and actual primary interactions, BLUE trend, TEAL registered/source, APRICOT missing/followup. Keep dark-gray text readable. No sea of purple, no rainbow, no old Clinic Comfort large bold hero, no patient IDs, no explanatory paragraphs/footnotes, no mock admin subtitles, no rounded boxes inside panels. Use main page height to keep all sections comfortably visible. The output is an implementation target image, not a real patient record.

## 第二轮局部修正提示词

Edit only the attached Chinese UI screenshot. Remove the small redundant text 'M=12, N=14' at the bottom-right inside the 每日登记覆盖 line-chart panel. Fill its area with the exact same clean white panel background. Keep EVERYTHING ELSE unchanged: dimensions, sidebar, topbar, Chinese labels, patient face, summary85.7% and12/14, chart seven values and dates, colors, source10/3 bars, missing two times, followup row, duplicate row, all positions and spacing. Do not add any replacement label, footnote, subtitle or explanation. Precise local cleanup only.

最终图见 references/07-patient-report.png。当前用户视觉确认已通过。
