# 图片生成记录

工具：内置 image_gen；逐张生成，使用现有网页冻结图及项目图片作为参考。所有图为视觉稿，未用于伪装当前代码实拍。

通用约束：390×844 逻辑手机视口，纯 APP 内容；Medix Light 中性浅灰底与白色面，紫主操作、蓝图表、青绿完成；正文 16、次级 14、控件至少 48；不嵌套卡片，不加说明性尾巴，不改现有业务语义。

## 01 登录

引用 approved-batch-01/01-login.png 和现有 doctor-assistant.png。品牌—小幅医生插画—患者登录—账号/密码—登录。取消副标题和免责声明，无注册或第三方入口。保持标签可见，密码眼睛图标留触控空间。

## 最终提示词

每页先生成，再按独立审查定点修订。下列文件保存实际发送给内置 image_gen 的完整文字；没有使用代码绘制或修补页面图片。

| 页面 | 初次生成 | 最终修订 | 最终图片 |
|---|---|---|---|
| 01 登录 | [prompt-01.txt](prompt-01.txt) | [prompt-01-r2.txt](prompt-01-r2.txt) | [01-login.png](01-login.png) |
| 02 首次改密 | [prompt-02.txt](prompt-02.txt) | [prompt-02-r2.txt](prompt-02-r2.txt) | [02-change-password.png](02-change-password.png) |
| 03 今日 | [prompt-03.txt](prompt-03.txt) | [prompt-03-r3.txt](prompt-03-r3.txt) | [03-today.png](03-today.png) |
| 04 型号指导 | [prompt-04.txt](prompt-04.txt) | [prompt-04-r6.txt](prompt-04-r6.txt) | [04-guide.png](04-guide.png) |
| 05 操作自检 | [prompt-05.txt](prompt-05.txt) | [prompt-05-r4.txt](prompt-05-r4.txt) | [05-training.png](05-training.png) |

## 参考关系与修订

- 01：网页冻结登录图 + 项目 doctor-assistant.png；02：01 + 网页登录。
- 03：网页 approved-charts-v2/06-stats-charts.png + 01 + 项目 demo-portraits.png。修订使用 05 的深青绿状态作参照。
- 04：首次使用 03 + 网页图表风格；最终由同画幅 05 派生指导页，保留同型号示意，去除自检选择，恢复指导底栏。
- 05：04 + 03；修订加深选中态、加高并对齐底部操作。
- 原始 R1、R2 图片在 revisions/ 下保留。04 的 R3/R4/R5 和 05 的 R3 曾发生画幅漂移，已弃用，未进入最终五图或预览页。
- 原文件位于 Codex generated_images；工作副本已存入本目录，交付不依赖临时路径。

详细验收见 [REVIEW.md](REVIEW.md) 与 [独立审查](INDEPENDENT-REVIEW.md)。
