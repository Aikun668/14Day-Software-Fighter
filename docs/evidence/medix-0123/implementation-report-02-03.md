# 实施报告 · Medix Light 02 工作台 + 03 患者管理

日期：2026-11-09  
浏览器：Google Chrome 156.0.8078.47（headless）  
页面：`http://127.0.0.1:5180`  
起点：`cursor/medix-light-shell-login-8593`

本报告只覆盖任务 02 和 03。主题仍停在 `.ml-shell` / 登录页，没有抬到全局。资产未齐，不能把这次称为最终视觉还原。本环境没有 8010，下面的功能结果都是请求拦截，不是后端联调通过。

## 改动文件

| 路径 | 动作 |
| --- | --- |
| `frontend-web/src/pages/clinician/WorkbenchPage.tsx` | 按 02 重排工作台 |
| `frontend-web/src/pages/clinician/PatientListPage.tsx` | 按 03 重排列表，并修四项缺陷 |
| `frontend-web/src/components/todayCoverage.ts` | 矩阵形状不完整时返回不可用，不把坏数据加成 0 |
| `frontend-web/src/components/TaskCloseModal.tsx` | 增加 `appearance="medix"`；随访页仍走原弹窗 |
| `frontend-web/src/components/MedicationBackfillModal.tsx` | 同上；患者详情仍走原弹窗 |
| `frontend-web/src/components/medix/icons.tsx` | 行内线性图标 |
| `frontend-web/src/styles/medix-light.css` | 02/03 作用域样式 |
| `docs/planning/UI-OPTIMIZATION-LOG.md` | 追加本轮 |
| `docs/evidence/medix-0123/` | 截图、build/lint、浏览器记录 |

未改：API、数据库、患者 App、令牌存储、全局 `theme.ts`、日期窗口算法、`/admin`、`/patients/:id` 的布局、冻结包复选框。现场评估仍把指导步骤一次标成 DONE，这是既有业务，本轮没有改语义。

## 矩阵形状

00+01 的 390 工作台曾弹出 `matrix.rows is not iterable`。后端 `MatrixResponse.rows` 本身是数组；炸的是 `summarizeDay` 在 `rows` 不是数组时直接 `for...of`。

现在 `readTeamScale` / `readDaySummary` 在 `rows` 缺失、不是数组、或格子缺 `N`/`M` 时返回 `{ ok: false }`。页面把受影响区块写成「近 7 日统计不可用」或「今日统计不可用」，不画成 N=0 的白格，也不显示 0%。合法的空 `rows: []` 仍是 N=0、rate=null，文案是「无到期时点」。`summarizeDay` 对坏形状改为抛「统计矩阵不可用」，避免再返回一组假 0。日期窗口仍在页面里用 `formatLocalDay`：实测请求是 overview `[2026-11-02, 2026-11-09)`、七日 `[2026-11-03, 2026-11-10)`、今日 `[2026-11-09, 2026-11-10)`。

## 检查项

| 检查项 | 结果 | 证据 | 限制 |
| --- | --- | --- | --- |
| V00 几何与字号 | 标题 20px/500，根字号 16px，行高 56px，头像 36px，侧栏 240px，上排宽 752:376。补登/处理按钮字色 `rgb(66, 70, 80)`、白底、灰边，不是品牌紫。新建按钮是 `rgb(129, 70, 255)`。 | `browser-02-03.json`，`screenshots/02-workbench-1440-mock.png`，`screenshots/03-patients-1440-mock.png` | 头像是中性图标，不是冻结图里的照片。 |
| V01 作用域 | `/patients/p-li` 有 `.cc-shell`、没有 `.ml-frame`，主按钮 `rgb(91, 124, 255)`。`/admin` 同样。 | `04-patient-detail-still-comfort-mock.png`，`05-admin-still-comfort-mock.png` | 详情和管理端数据是拦截的空列表，只用来确认外壳没有被染紫。 |
| V02 视口 | 1440 与 390 的 `scrollWidth` 等于视口。390 侧栏 `display: none`，菜单进抽屉。1280 有截图。 | `02-workbench-1280-mock.png`，`02-workbench-390-mock.png`，`03-patients-1280-mock.png`，`03-patients-390-mock.png` | 390 上七日格和表格在各自容器里横向滚动。没有做真实浏览器 200% 缩放，只做了 CSS 视口。 |
| V06 四态与失败 | 七日格依次为全部、部分、未发现、无到期，再循环。N=0 的 aria-label 是「无到期时点」，不是「未发现登记」，页面上没有 0%。统计 500 或 `rows` 为对象时，区块写「不可用」，任务列表还在。全无到期时显示「暂无待关注事项」，不是 0%。 | `verify-coverage.json`，`02-workbench-stats-fail-mock.png`，`02-workbench-empty-mock.png` | 四态格子的 N/M 来自拦截夹具，不是真实统计服务。 |
| V07 队列 | 同一患者两条任务都在，key 是 task id。默认 6 行，展开后是已加载的 20 行。`total=25` 时标题是「待核查 25」，并有「全部任务」进 `/followups`。 | `browser-02-03.json` 的 same patient / collapsed / overflow | 超过 20 条没有逐条画出来，只核对了标题用 total、按钮去随访。 |
| V08 弹窗 | 取消处理、取消补登都没有对应 POST。422 时弹窗留着并出现失败文案。成功后任务 `t-1` 从列表消失。补登成功有 POST。固定/按需切换、已登记禁选、必填说明和复训勾选都还在。 | `02-task-close-modal-mock.png`，`02-task-close-fail-mock.png`，`02-backfill-modal-mock.png`，`02-backfill-fail-mock.png` | 成功与失败都是拦截，不是 8010 写入。 |
| V09 筛选 | 两个 `diagnosis_label` 重复出现。已绑定和未绑定同时选中时 URL 没有 `account_status`。清除后参数消失且 `page=1`。 | `browser-02-03.json` 的 filter URL | 标签来自拦截的 filter-options，不是全库。 |
| V10 竞态与页码 | 先发 `search=slow`（700ms）再发 `search=fast`（40ms），最终列表是「快结果」，没有被「慢结果」盖住。第 2 页建档成功后页脚 `data-page=1`，随后的列表请求是 `page=1`。 | 同上，`03-patients-after-create-mock.png` | 慢请求会被 AbortController 取消，序号也挡住旧响应。 |
| V11 建档 | 提交体带 `patient_code: P-100`。失败路径没有在这次截图里单开，代码在 catch 里留住弹窗和输入。 | create kept code | 没有对真实 POST 422 再拍一张。 |
| V12 评估 | 提交体 `device_model_id` 为型号甲 `11111111-1111-4111-8111-111111111111`，`guide_id` 为指导 `22222222-2222-4222-8222-222222222222`，两者不同。切到没有指导的型号乙后确定按钮禁用，且当时没有 training POST。 | `browser-02-03.json` 的 `trainingBody`，`03-eval-no-guide-mock.png`，`03-eval-modal-mock.png` | 这是浏览器发出的 body，后端没有真正校验 GUIDE_MISMATCH。步骤仍一次性 DONE。 |
| V13 行操作 | 查看详情的 aria-label 是「查看李先生详情」，颜色 `rgb(105, 113, 128)`。评估点击后仍停在 `/patients`。 | `03-patients-1440-mock.png` | 触屏 44px 只写在粗指针媒体查询里，这次没有真机。 |
| build / lint | `BUILD:0`。lint `LINT:0`，11 条既有 warning，没有新增 error。患者列表原来的同步 setState warning 没了。 | `build-02-03.txt`，`lint-02-03.txt` | 仓库没有 test 脚本，没有跑 npm test。 |

## 已知差异

- 头像、侧栏插画仍是 00 的本地占位。没有给患者分配假脸。视觉验收应继续标「资产未齐」。
- 需关注按 `missing_count > 0` 取前三，所以主截图是三行姓名加覆盖率，不是冻结图里的单行双层说明。「近 7 日覆盖偏低」和「缺/应」没有铺在行上，分母在详情按钮的 tooltip / aria-label 里。
- 图例写「无到期时点」，不写冻结图上的「无排程」。
- 处理弹窗不写「连续 3 个到期时点」。那是图里的示例数字，任务载荷里没有这个计数。
- 工作台日期是运行当天的本地日期（本次为 11月9日 · 周一），不是冻结图的 11月8日。
- 补登/处理弹窗只在工作台传 `appearance="medix"`。随访页和患者详情仍是原来的弹窗，避免把 04 以后的页面改样。

## 未验证

- 真实后端上的统计、任务关闭、补登、建档、现场评估。不能把拦截结果写成 8010 通过。
- 评估 body 能证明前端不再把 `guide.id` 填进 `device_model_id`。后端 `training.py` 是否接受这对 id，这次没有打到服务。
- 超过 100 名患者时工作台姓名回落成「未命名患者」的真实分页截断，只保留了原契约和文案，没有用全库数据复现。
