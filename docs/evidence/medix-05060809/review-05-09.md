REVIEW: PASS

# 审查 · Medix Light 任务 05 / 06 / 08 / 09

日期：2026-11-09  
审查对象：PR https://github.com/Aikun668/14Day-Software-Fighter/pull/6  
分支：`cursor/medix-plans-stats-followups-0282` @ `4b6ccc3`  
对照：上一批 `1313c31`（PR #5，任务 02+03）  
规格：附件 `handoff-05060809-v1`（RULES、05–09、ACCEPTANCE、IMPLEMENTATION、INTEGRATION）与 `handoff-0123-v1/00-SYSTEM.md`  
范围：用药计划、统计与核查、随访中心、处理任务弹窗。只记硬伤。07、10 与管理端不在本批。

本审查没有改产品代码。

## 结论

**PASS。** 建议进入最终批（10 + 管理端 + 07）。

七项硬伤都没有成立。浏览器证据是请求拦截，实现报告写明 8010 未启动、真实写入待验，没有把 mock 写成后端通过。

## 硬伤列表

无。

| 硬伤 | 结果 | 依据 |
| --- | --- | --- |
| 全局主题污染 | 未发现 | `App.tsx` 只把 `/plans`、`/stats`、`/followups` 从 Comfort 换成已有 `MedixShell`。`/patients/:id`、`/admin` 仍是 `ComfortShell`。`styles/theme.ts`、`styles/medix-theme.ts`、`styles/medix-light.css`、`index.css`、`main.tsx` 不在本批 diff。`medix-clinical.css` 没有改 `:root` / `html` 字号，`.ant-*` 只出现在 `.ml-task-close` 与 `.ml-stats-tools` 下面。`04-detail-still-comfort.png` 仍是旧侧栏、面包屑「患者 / 详情」和底栏账号，不是 medix 白壳。`browser-checks.json` 记了详情和管理端都没有 `.ml-plans`。 |
| API / DB / 权限被改 | 未发现 | `1313c31..4b6ccc3` 没有 `backend/`、迁移、患者 App、`api/client`、`AuthContext`、`RequireAuth`。三条新路由仍包在 `RequireAuth` 里。计划创建仍是 `POST /api/patients/{id}/medication-plans`，统计仍是 overview + matrix，随访与关任务仍是单次 `POST /api/followups`。 |
| N=0 或统计失败被画成 0% | 未发现 | `aggregateDailyCoverage`：N=0 得到 `coverage_rate: null` 且无 anomaly；M=0 且 N>0 得到真实 0%；M>N 得到「数据异常」且 rate 为 null。`TrendChart` 对 null / 异常断开折线（`connectNulls: false`），文案是「无到期时点」或「数据异常」。环图在 N≤0 时中心为 —、中性空环。`RateCell` 在 `N` 不大于 0 或 rate 为空时画 —。overview 失败、两源合计对不上，分别是「加载失败」和「数据更新中，请刷新」，不把空块画成 0%。本审查复跑 `node --experimental-strip-types src/pages/clinician/medixClinicalModel.check.ts`，输出 `medixClinicalModel.check: ok`。 |
| 日期窗口语义破坏 | 未发现 | `makeStatsWindow` 把界面含末日转成排他次日，1 日与 92 日可查，93 日抛「区间最多 92 日」且 `applyRange` 在发请求前拦住。`recentInclusiveWindow` 是上海昨日往前的完整 7 日，不是把目标图的 11-02—11-08 写死。上海日期已是 2026-11-10 时，界面 11-03—11-09、请求 `to=2026-11-10`，与 `browser-checks.json` 里的 `GET /api/stats/overview?from=2026-11-03&to=2026-11-10` 一致。计划 `starts_at` 是上海当日零点，结束日含当天并转成次日零点；`05-plans-1440.png` 上 `ends_at=2026-12-01T00:00:00+08:00` 显示到 11-30，`ends_at=2026-11-02T00:00:00+08:00` 显示到 11-01。阶段按 `[starts_at, ends_at)`：未来结束是生效中，届满是已结束，未来开始是待生效。 |
| 回滚 00–03 | 未发现 | 登录、患者列表、患者详情、`WebLayout`、`medix-light.css`、`MedixThemeBoundary` 相对 `1313c31` 无差异。`WorkbenchPage` 只给关任务多传 `taskType`。`CoverageHeatmap` 的编号隐藏只在 `appearance="medix"`，默认仍显示编号；全仓只有统计页传入该参数。处理任务弹窗仍是工作台那一个组件，medix 外观、头像和 `close_task: true` 都还在；本批按 09 补了类型说明和提交锁，没有另做一份弹窗。`02-workbench-1440.png` 仍是 medix 工作台（近 7 日刻度、需关注、待核查）。 |
| build 失败或新 lint error | 未发现 | 本审查在 `frontend-web` 执行 `pnpm install --frozen-lockfile` 后复跑。`npm run build` 退出码 0。产物 CSS 与已提交 `build.txt` 同为 `index-gcybuWfs.css`（63.45 kB）；JS 哈希不同，是本环境 Vite 8.3.4 与证据里 8.3.7 的差异，构建本身通过。`npm run lint` 退出码 0，7 条 warning、0 error，文件与已提交 `lint.txt` 相同：`CoverageHeatmap`、`AdminPage`、`MedicationBackfillModal`、`AuthContext`、`WebLayout`、`PatientDetailPage`。新增的计划、统计、随访、图表和模型文件没有 warning，也没有 error。 |
| 目标图冒充实拍，或 mock 冒充后端通过 | 未发现 | 四张冻结目标图均为 1586×992。实拍是 1440×900、1280×800、390×844，SHA256 全部不同。画面是运行中的外壳加表单/图表，不是把目标 PNG 贴进页面。`implementation-report.md`、`capture.mjs` 和 UI 日志都写明接口由请求拦截提供，8010 与 5432 未启动，真实创建计划、完整随访和快速处理待验。`browser-checks.json` 的 POST 只有登录和一条 `close_task: true` 的随访，密码已打成 `[redacted]`。 |

## 本审查实际重跑

- `node --experimental-strip-types frontend-web/src/pages/clinician/medixClinicalModel.check.ts` → `medixClinicalModel.check: ok`
- `frontend-web`：`npm run build` → 退出码 0
- `frontend-web`：`npm run lint` → 退出码 0，7 warning / 0 error

没有重开浏览器，也没有把 8010 拉起来。截图结论来自已提交 PNG 的尺寸、哈希和画面，加上 `capture.mjs` 与页面源码。

## 非硬伤

这些不改变 PASS，进入下一批时带上即可。

- 验收表 E04 的真实写入还没做。报告没有把它算成通过。下一批或补验时仍要在真实接口上各完成一条计划创建、一条完整随访、一条快速处理。
- `capture.mjs` 里「N=0 显示破折号」是整页文字同时包含「林女士」和「—」。1440 团队概览截图里林女士在表格下沿，破折号本身没有单独入镜。挡住 0% 的是 `RateCell` 和模型断言，不是这条宽松检查。
- `04-detail-still-comfort.png` 主区还在转圈，只能证明外壳仍是 Comfort，不能当作详情正文回归。
- 200% 系统缩放没有单独证据。390 窄屏有截图，浏览器检查记了计划页和随访页无整页横向溢出。
- 视觉认可仍是「待用户确认」。头像仍是中性占位，符合「生产数据没有头像字段就不分配演示脸」。
- 患者报告页签还在，并且保留未发现登记、来源事件和重复登记入口。07 的独立构图没有做，这是本批规格允许的。
- `medix-clinical.css` 有一批未再套页面类的 `.ml-*` 工具类（如 `.ml-field`、`.ml-phase`）。它们不改 Comfort 的类名，也没有撞上 `medix-light.css` 里工作台用的外壳类。下一批继续保持页面前缀，不要把这些选择器改成裸 `.ant-*`。

## 是否建议进入最终批（10 + 管理端 + 07）

建议进入。

本批把三个临床路由接进了已有 medix 外壳，统计口径、上海日切和 00–03 的页面边界都还在。最终批应继续只迁移自己的路由，不要把 `medixTheme` 抬进 `main.tsx` 的全局 `ConfigProvider`，也不要改 API、数据库和权限。07 患者报告按该批自己的目标图重排；本批留下的报告页签是入口，不是 07 已经做完。
