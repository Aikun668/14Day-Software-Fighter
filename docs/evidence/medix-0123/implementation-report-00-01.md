# 实施报告 · Medix Light 00 + 01

日期：2026-11-09  
浏览器：Google Chrome 156.0.8078.47（headless）  
页面：`http://127.0.0.1:5180`  
开工 HEAD：`f26bedfe5abf0e3537f5e13063259e815aad08de`

本报告只覆盖任务 00 和 01。技术结果和视觉终验分开：资产未齐，不能把这次称为最终视觉还原。

## 改动文件

| 路径 | 动作 |
| --- | --- |
| `frontend-web/src/styles/medix-theme.ts` | 新增局部 antd 主题 |
| `frontend-web/src/styles/medix-light.css` | 新增作用域样式 |
| `frontend-web/src/components/medix/*` | 新增主题边界、外壳和 00 契约组件 |
| `frontend-web/src/assets/medix/*` | 新增本地矢量与来源清单 |
| `frontend-web/src/components/WebLayout.tsx` | `variant` 增加 `medix` |
| `frontend-web/src/App.tsx` | 仅工作台与患者列表挂新外壳 |
| `frontend-web/src/main.tsx` | 引入作用域 CSS |
| `frontend-web/src/pages/auth/LoginPage.tsx` | 登录页重排，契约不变 |
| `docs/design/medix-light/handoff-0123-v1/` | 原样拷贝冻结文档，未改 FREEZE |
| `docs/design/medix-light/approved-batch-01/` | 冻结图 |
| `docs/planning/UI-OPTIMIZATION-LOG.md` | 追加本轮记录 |
| `docs/evidence/medix-0123/` | 基线、截图、本报告 |

未改：患者 App、后端、令牌存储、`theme.ts`、`/change-password` 版式、工作台与患者列表的业务布局。

## 检查项

| 检查项 | 结果 | 证据 | 限制 |
| --- | --- | --- | --- |
| V00 颜色/字号/圆角/焦点 | 登录与外壳按 token。根字号 16px。卡片宽 504px、圆角 8px、阴影 none。选中底 `rgb(244, 240, 255)`，指示条 0。 | `browser-metrics.json`，`screenshots/01-login-1440x900.png`，`screenshots/02-shell-workbench-1440-mock.png` | 工作台正文仍是旧的大标题和套卡，因为 02 没做。 |
| V01 作用域 | `/patients/:id`、`/plans`、`/admin` 没有 `.ml-frame`，仍是 `.cc-shell` 或旧认证页。管理端主按钮 `rgb(91, 124, 255)`。患者列表弹窗主按钮 `rgb(129, 70, 255)`，弹层根带 `ml-shell`；管理端弹层根没有 `ml-shell`。 | `04-patient-detail-comfort-1440-mock.png`，`04b-plans-comfort-1440-mock.png`，`05-admin-comfort-1440-mock.png`，`06-modal-patients-medix-mock.png`，`07-modal-admin-comfort-mock.png` | 旧的 `clinic-comfort.css` 里全局遮罩规则仍作用于所有弹层。这次没有改那条规则，避免动到旧页。 |
| V02 视口 | 登录 1440×900、1280×800、390×844 无横向溢出。200% 等价视口 720×450 时两个输入都在视口内（底边约 355px）。外壳 1440 侧栏 240px、顶栏高 80px 且 left=240；1024 侧栏 64px；390 侧栏隐藏、菜单进抽屉，页面 `scrollWidth` 390。 | `01-login-*.png`，`02-shell-workbench-*.png`，`browser-metrics.json` 的 `retake` | 200% 用一半 CSS 视口代替浏览器缩放控件。卡片底边比 450px 高出约 11px，可滚动，字段本身没有被裁掉。390 下未迁移的工作台卡标题仍会被旧布局挤成逐字换行。 |
| V04 登录 | 空账号/空密码被 Form 拦住，不发请求。错误文案留在按钮上方。真实 POST 在后端未启动时得到 502「请求失败（502）」，停在登录页。mock 401 显示「账号或密码错误」，停在登录页。mock 成功：强制改密的 ADMIN 到 `/change-password`；普通 ADMIN 到 `/admin`；医护到 `/workbench`。 | `01-login-required.png`，`01-login-backend-down-502.png`，`01-login-bad-credentials-mock.png`，`10-change-password-reachable-mock.png`，`05-admin-comfort-1440-mock.png` | 三类成功跳转和 401 是请求拦截，不是 8010 联调通过。本环境 8010 没有进程。 |
| V05 提交与退出 | 延迟响应期间连点登录和 Enter，登录请求数始终为 1，随后进入 `/workbench`。退出后回到 `/login`。未登录直接打开 `/admin` 与 `/patients/p1` 会回到 `/login`。令牌仍只在内存，没有改 `localStorage`。 | `01-login-loading-mock.png`，`09-after-logout.png`，`browser-metrics.json` 的 `loadingRequestsAfter: 1` | 退出后的受保护页复查包含一次整页加载。内存令牌本来就会在刷新后消失，这和原契约一致。 |
| 搜索 | 顶栏按姓名过滤已加载名单，命中展示姓名和编号，选择后进入 `/patients/:id`（旧外壳）。 | `08-search-dropdown-mock.png`，`04-patient-detail-comfort-1440-mock.png` | 名单是 mock 的 2 人，不是全库，也没有新搜索 API。实现仍只取前 100 条、最多 8 条。 |

## 已知差异

- 资产未齐。logo、医生插画、中性头像都是本仓自绘 SVG，见 `frontend-web/src/assets/medix/SOURCES.md`。冻结图里的立体插画和照片头像没有照搬。顶栏账号也用中性剪影，没有假脸。
- 账号旁没有一个没有功能的下拉箭头。退出是独立按钮，走 `useAuth.logout` 后到 `/login`。
- `/workbench` 与 `/patients` 的页面内容布局没改。因为它们包在 `MedixThemeBoundary` 里，这两页上的 antd 主按钮会变成品牌紫、圆角跟局部主题走。这是外壳主题的连带，不是 02/03 的重排。
- 390 宽时，未迁移的工作台卡片内部标题仍可能逐字换行。页面横向滚动已被外壳收进内容区，`scrollWidth` 等于视口。

## 未验证

- 真实后端上的医护登录、管理员登录、首次改密、错误密码。本环境没有 8010，也没有 PostgreSQL。不能把 mock 写成后端通过。
- 真实患者搜索结果与超过 100 人的截断提示。逻辑与原来相同，数据是拦截的。
- 任务 02/03 的业务验收（V06–V13）没有做。
