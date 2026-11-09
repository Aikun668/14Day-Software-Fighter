# 审查 · Medix Light 任务 00 + 01

日期：2026-11-09  
审查对象：PR https://github.com/Aikun668/14Day-Software-Fighter/pull/4  
分支：`cursor/medix-light-shell-login-8593` @ `bbe71cb`  
对照：开工点 `f26bedfe`，冻结包为附件 zip 与 `docs/design/medix-light/handoff-0123-v1/`  
范围：任务 00 外壳 / 主题 / 资产，任务 01 登录。02/03 未做不记缺陷。

## 结论

**PASS**

## 硬伤列表

无。

| 硬伤 | 结果 | 依据 |
| --- | --- | --- |
| 全局主题污染 `/admin`、`/patients/:id` | 未发现 | `App.tsx` 只把 `/workbench`、`/patients` 挂 `variant="medix"`。`/patients/:id`、`/plans`、`/stats`、`/followups`、`/admin` 仍是 Comfort。`medix-light.css` 选择器都带 `.ml-*`，没有裸的 `.ant-*`，也没有改 `:root`。`browser-metrics.json`：admin 主按钮 `rgb(91, 124, 255)`，弹层 class 无 `ml-shell`；患者列表弹层 class 含 `ml-shell`、确定按钮 `rgb(129, 70, 255)`。截图 `05`、`07` 是诊所蓝；`04`、`04b` 仍是旧侧栏。 |
| 登录契约被破坏 | 未发现 | `AuthContext.tsx` 不在 diff 里。令牌仍是模块内 `memoryToken`，全仓前端没有 `localStorage`。`login` 仍带 `skipAuthRedirect: true`。`LoginPage` 跳转顺序仍是改密 → ADMIN `/admin` → `/workbench`。空账号/空密码仍是 Form `required`，`01-login-required.png` 停在页内且出现「请输入账号 / 请输入密码」。401 文案留在按钮上方，`01-login-bad-credentials-mock.png` 未离开登录页。 |
| 根字号被改 | 未发现 | 本次 diff 没有动 `index.css`。`html` 仍是原有的 `font-size: 1rem`。证据里各视口 `htmlFontSize` 均为 `16px`。 |
| 改 API / DB / 患者 App / 统计口径，或把效果图当背景 | 未发现 | diff 没有 `backend/`、`patient-app/`、`todayCoverage.ts`。登录插画和 logo 是 `frontend-web/src/assets/medix/` 下的本地 SVG，CSS 没有把冻结 PNG 设为背景。 |
| 冻结包被改写 | 未发现 | `handoff-0123-v1/` 与 `approved-batch-01/` 相对附件 zip 逐文件 SHA256 一致，属于只读拷贝。`IMPLEMENTATION.md` 复选框仍是未勾。 |
| build 失败或 lint 新增 error | 未发现 | `final-build.txt` 为 `BUILD:0`；`final-lint.txt` 为 12 warning / `LINT:0`，与基线同一组文件。`WebLayout.tsx:97` 的 warning 对应当前 effect 里同步 `setHits([])`，基线是第 80 行，位移和文件头新增的包装函数一致。本审查环境没有 `node_modules`，没有复跑 `npm run build` / `lint`。 |
| 证据造假 | 未发现 | 冻结图 `01-login.png` 为 1586×992、SHA256 `32fd23c5…`。实拍登录图为 1440×900 等视口，哈希全部不同，画面是扁平 SVG 表单，不是冻结图贴上去。502、401、三类跳转在报告里标明无后端 / 请求拦截，没有写成 8010 联调通过。 |

## 已知限制 / 可接受差异

- 资产未齐。logo、医生插画、顶栏头像是本仓自绘占位，见 `frontend-web/src/assets/medix/SOURCES.md`。冻结图里的立体插画没有照搬。按 R14 / R18，不能算最终视觉还原。
- 本环境没有后端。空字段拦截、未登录回登录页、后端未启动时的 502 有真实页面证据。成功跳转、401 文案、搜索命中、弹窗颜色是 mock，报告已分开写。
- 任务 02/03 没做。`/workbench`、`/patients` 的正文仍是旧大标题和套卡。这两条路由包在 `MedixThemeBoundary` 里，页上的 antd 主按钮和弹层会变成品牌紫。这是局部挂载的连带，不是 `/admin` 或详情页被全局染紫。
- `/change-password` 没改版，截图仍是诊所蓝卡片。符合 01「只做回归可达」。
- 旧 `clinic-comfort.css` 里 `.ant-modal-mask` / `.ant-drawer-mask` 仍是全局遮罩。本次没有改它。medix 弹层也会吃到这层模糊，但没有因此把管理端主色改成品牌紫。
- 390 工作台截图 `02-shell-workbench-390-mock.png` 顶部有 `matrix.rows is not iterable`。`todayCoverage.ts` 不在本次 diff 里，`summarizeDay` 直接遍历 `matrix.rows`。更像未迁移工作台拿到了不完整的 mock 矩阵，加上旧卡片标题在窄屏逐字换行。报告写了换行，没点名这条报错。02 开工时先分清是夹具还是外壳把内容挤坏。
- 顶栏搜索仍是已加载前 100 条、最多 8 条，没有新搜索 API。
- 审查没有重拍浏览器，也没有复跑 build。结论来自 diff、冻结包校验和已提交截图 / 指标。

## 是否建议进入任务 02+03

建议进入。

外壳和登录的契约边界是清楚的：新主题停在指定路由和登录页，旧页面主色还在。02/03 应继续在现有 `MedixThemeBoundary` 里改工作台和患者列表正文，不要把 `medixTheme` 抬到 `main.tsx` 的全局 `ConfigProvider`。开工时单独看一眼 390 上的 `matrix.rows` 报错，并继续把资产标成未齐。
