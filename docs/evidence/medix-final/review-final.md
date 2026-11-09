REVIEW: PASS

# 审查 · Medix Light 最终批（10、11–15、07，以及 04 核对）

日期：2026-11-09  
审查对象：PR https://github.com/Aikun668/14Day-Software-Fighter/pull/7  
分支：`cursor/medix-final-batch-a433`  
产品提交：`f4985da50a9eec36caea5a6fa3c4c06b5a0655b2`  
对照：PR #6 tip `2f44633b07367960e33b6e82938ae297a5f1b76a`（`cursor/medix-plans-stats-followups-0282`）  
规格：附件 `handoff-final-v2`（HANDOFF、RULES、ACCEPTANCE、10、11–15、04）与 `handoff-07-v1`（HANDOFF、RULES、ACCEPTANCE、07-PATIENT-REPORT）  
范围：补登、管理端、患者报告，以及患者详情是否被回滚。只记硬伤。

本审查没有改产品代码。相对 `2f44633` 的产品差异只有 `f4985da`。

## 结论

**PASS。** 七项硬伤都没有成立。

浏览器证据是请求拦截。实施报告写明 8010 未启动，没有把 mock 写成后端通过。07 有单独截图，不是用团队概览代替。

## 硬伤列表

无。

| 硬伤 | 结果 | 依据 |
| --- | --- | --- |
| 全局主题污染，或改坏 Comfort 页 | 未发现 | `main.tsx` 仍用 `webTheme`。`styles/theme.ts`、`styles/medix-theme.ts` 不在 diff。`/patients/:id` 仍是 `ComfortShell`，`/login` 未改。`/admin` 改挂已有 `MedixShell`，这是本包要求的管理端迁移，不是把主题抬进全局 ConfigProvider。补登弹窗的 `scope="overlay"` 只包弹窗。`PatientDetailPage` 仍是 `cc-page`、问候标题、四格摘要和刻度。`html:has(.cc-shell)` 的外壳锁比新增的窄屏 `overflow-x` 更具体，Comfort 外壳规则还在。 |
| API / DB / 患者 App / 令牌，或审计虚构写入接口 | 未发现 | `2f44633..f4985da` 没有 `backend/`、迁移、`patient-app/`、`api/client`、`AuthContext`。令牌仍是内存。审计只请求 `GET /api/admin/audit-logs?page&page_size`，没有 from/to，也没有新的写入接口。账号分类是空集合，`USER_DISABLE` 归「其他」，图上不补「停用账号」。型号、指导、知识、账号用的是已有 POST/PATCH。 |
| 失败画成 0% 或「暂无计划」；N=0 与未发现登记混用 | 未发现 | 补登要计划和时点都成功才算 `loaded`。时点 500 显示「加载失败」，确认按钮禁用，不出现「暂无计划」。「暂无计划」只在两边都成功且都为空时出现。患者详情失败把对应块清空并标不可用，覆盖率用 —，不用 0 代替失败；N=0 的说明是「无到期时点」，未登记格只在已到期且没有登记时出现。报告 N≤0 为 —，M=0 且 N>0 保留真实 0%；来源宽度按事件数，不改成 M。审计未读全、顺序不稳或失败时 `complete` 为假，不画全量柱，已读记录单独标出。 |
| 日期不是 Asia/Shanghai，或计划区间语义错 | 未发现 | 详情七日是上海今天及前 6 日，统计 `to` 为次日。时点按 `shanghaiParts` 入格。计划阶段用 `derivePlanPhase` 的 `[starts_at, ends_at)`。绑定和修订把选择器墙钟写成 `YYYY-MM-DDT00:00:00+08:00`。补登实际时间同样贴 `+08:00`，并用上海现在拦截未来时刻；默认区间是上海今天及前 6 日，`to` 为次日，跨度超过 31 日不发请求。统计和审计的近 7 日仍是截至上海昨日的完整七日。07 截图区间是 2026-11-03 至 2026-11-09，与当时上海近 7 日一致，不是把目标图 11-02—11-08 写死。 |
| 回滚 00–09，只为贴图重做 04 | 未发现 | 登录、工作台、患者列表、计划、随访、`medixClinicalModel.ts` 相对 `2f44633` 无差异。统计页团队概览仍是摘要、蓝折线、环图、患者表和登记明细；N=0 仍是 —。患者报告抽到 `PatientReportPanel`，页签和日期不重置。04 仍是 Comfort 页，补的是上海区间、失败不装空、同刻多时点、临时密码、日期提交和多计划先选择。没有改成规格图里的 medix 详情。补登仍是 02 和 04 同一个组件，props 兼容，两边都传 `appearance="medix"`。 |
| build 失败或新 lint error | 未发现 | 本审查在 `frontend-web` 执行 `pnpm install --frozen-lockfile` 后复跑。`npm run build` 退出码 0。CSS 与已提交 `build.txt` 同为 `index-BOV-BusN.css`（71.35 kB）。JS 哈希不同，是本环境 Vite 8.3.4 与证据里 8.3.7 的差异。`npm run lint` 退出码 0，18 条 warning、0 error，位置与已提交 `lint.txt` 相同。没有新增 error。 |
| 07 无独立证据，或管理端假写生产数据且无隔离说明 | 未发现 | `07-patient-report-1440/1280/390.png` 是独立文件。1440 为 1440×1177，SHA256 前缀 `963104de7d1241ae`，与设计图 `07-patient-report.png`（1448×1086，`355296cc590a0d5f`）不是同一张。画面是统计页「患者报告」：85.7%、12/14、未登记 2、来源 10 与 3、随访和重复登记 2，没有「基础管理报告」。`capture.mjs` 拦截 `/api/`，`browser-checks.json` 标 `mock: true`，非 GET 只有两次登录。实施报告和 UI 日志都写了 8010 未启动。 |

## 核对点

- **10**：`MedicationBackfillModal` 计划和时点分开请求，失败不 catch 成空成功。历史计划走 `include_history` 分页。提交的 `plan_id` 来自所选时点，按需 `slot_id` 为 null。`is_duplicate` 只提示一次并回调一次成功刷新。工作台文件未改，仍打开这一份弹窗。
- **11–15**：`/admin?tab=model|guide|user|kb|audit`，未知值回到 model。五个视图分请求。指导与知识只有草稿可审核、已审核可发布，已发布只有查看，未知状态无写入。临时密码只进结果弹窗，关闭即清；响应为 null 时只提示账号已创建。审计只读，不完整不画全量图。
- **07**：报告是身份摘要、每日蓝折线、未登记、来源横条、随访、重复登记。团队概览的数据路径还在。`patientReportModel.check.ts` 核对 14 时点、12 覆盖、13 事件、2 缺失、1 个重复时点（2 条）和 85.7%。
- **04**：只补行为缺口。视觉仍是问候、四格和需关注，没有按效果图重做。
- **证据**：`docs/evidence/medix-final/` 有实施报告、build、lint、浏览器检查、capture 和截图。`docs/planning/UI-OPTIMIZATION-LOG.md` 有最终批条目，并写明截图是请求拦截。

## 本审查实际重跑

- `node --experimental-strip-types src/pages/admin/auditModel.check.ts` → `auditModel.check: ok`
- `node --experimental-strip-types src/pages/clinician/patientReportModel.check.ts` → `patientReportModel.check: ok`
- `node --experimental-strip-types src/pages/clinician/medixClinicalModel.check.ts` → `medixClinicalModel.check: ok`
- `frontend-web`：`npm run build` → 退出码 0
- `frontend-web`：`npm run lint` → 退出码 0，18 warning / 0 error

没有重开浏览器，也没有把 8010 拉起来。截图结论来自已提交 PNG 的尺寸、哈希和画面，加上 `capture.mjs` 与页面源码。

## 已知限制

这些不改变 PASS。

- 真实登记、审核发布、启停鉴权和改密后停用还没在 8010 上走过。报告没有把拦截截图算成接口通过。
- `capture.mjs` 里预留了 `from=1999-01-01` 的时点 500，但这轮浏览器检查没有打开这条失败路径。挡住「暂无计划」的是源码里的 `loaded` 条件，不是这条未跑的检查。
- 患者详情登记抽屉的时间仍是 `toLocaleString('zh-CN')`，没有写 `timeZone: 'Asia/Shanghai'`。这一行相对上一批没改。七日窗口、入格、计划区间和本次新提交已经按上海处理。问候眉题的英文日期也还是 Comfort 页原来的本地日历，属于保留的旧壳，不是本批业务区间。
- `medix-light.css` 在 767px 以下给 `html, body, #root` 加了 `overflow-x: hidden`。Comfort 外壳仍由更具体的 `:has(.cc-shell)` 锁住。390 患者报告可以往下读；随访表末列在窄屏上靠表内滚动，浏览器检查还记到个别节点超出 390。这不是失败被画成 0。
- `browser-checks.json` 的登录请求体里留着 mock 密码 `secret`。这不是临时密码，也没有进页面提示。下次归档证据时应打码。
- 200% 缩放没有单独证据。12/13/14 只有 1440，10 没有单独拍 04 入口，11 有 390，15 有 1280。
- 用户视觉终验未签。13/14 按文字规格和留存参考实现。
- 最后一名管理员的保护只在界面上。账号启停不写审计。用药登记接口仍允许管理员写入，本批没有加临床入口，也没有改服务端权限。停用只改状态，不撤销全部会话。
- 审计里时间无法解析的记录只提示条数，不能从图表行点开原值。完整区间里的普通事件可以点开。
- 统计折线多了一处 `hideOverlap`，团队概览和患者报告共用这张图。概览的口径、空态和布局没有改。

## 建议下一步

可以按这批合并。合并前或合并后补一次真实 8010 链路即可，不必为了硬伤返工。

优先补验：一条历史时点补登、一条时点 500 与空计划的差别、一条指导草稿审核再发布、一条空密码的临时密码只出现一次、一条审计区间在日志超过 100 条时不把半截画成全量。患者详情登记时间若要和七日格对齐，再单独把抽屉格式改成上海时区。
