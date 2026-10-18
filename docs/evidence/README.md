# 截图证据索引

`docs/evidence/` 里是各轮 Web 端走查的截图与工具报告（每目录一张 `page.png` + 一份 `report.json`）。
目录数量随着每轮修复累积，这里只索引**最终状态、可用于交付说明**的那几张，其余属历史过程记录。

## 最终交付证据（以这些为准）

| 目录 | 说明 |
|---|---|
| `fix-review-workbench/` | **审查修复后**的工作台：覆盖率环 + 三格数字共 4 列同一行（修复前第 4 格掉到第二行） |
| `fix-review-stats/` | **审查修复后**的统计页趋势：空心点表示当天无到期时点、不参与连线 |
| `fix-review-admin-kb/` | **审查修复后**的知识内容页：状态胶囊对比度达标（`report.json` 的 `lint` 为 `[]`），测试文档已清理 |
| `ux-final/` | 最后一轮交互打磨后的工作台（侧栏角标 + 顶栏全局搜索） |
| `ux-search/` | 顶栏患者搜索下拉的实际效果 |
| `wb-overview/` | 工作台聚合覆盖率环概览（**修复前**，4 格掉行的破版可见） |
| `wb-rows/` | 工作台患者登记情况排行（缺失多的在前） |
| `detail-timeline/` | 患者详情「动态」合并时间线（计划/登记/训练/随访） |
| `loop-device/`、`loop-edit/` | 医护闭环：绑定装置弹窗、计划修订弹窗 |
| `admin-kb/` | 管理端知识内容列表（**修复前**，含 7 处 `contrastLow` 与测试文档残留） |
| `stats-trend/` | 统计页逐日覆盖率趋势折线（**修复前**，折线会跨过无数据日连线） |
| `rich1-patients/`、`rich2-detail/` | 演示数据补全后的患者列表与详情 |

> `admin-kb/`、`wb-overview/`、`stats-trend/` 保留为「修复前」对照，问题已分别在
> `fix-review-admin-kb/`、`fix-review-workbench/`、`fix-review-stats/` 中复测通过。

## 历史 / 过程记录（不作为交付依据）

`qa-*`（逐项手工走查）、`web-*`、`fix-*`、`p01-*`、`p04-*`、`stats-viz`、`web-rich-*` 等，
用于记录每轮问题与修复动作；其中 `loop-device3`、`loop-device4` 是**失败**的截图尝试
（`report.json` 里 `failed: true`，DatePicker 选择器不被工具支持），保留仅作复盘。

## 重复内容

`stats-trend2/` 与 `stats-trend/` 的 png 哈希完全相同，`loop-device5/` 与 `loop-device/` 亦然；
后续新增证据时请避免重复拷贝，改为在提交说明里引用既有目录。
