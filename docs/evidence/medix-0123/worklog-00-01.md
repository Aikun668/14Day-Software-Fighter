# 工作日志 · Medix Light 任务 00 + 01

日期：2026-11-09  
开工 HEAD：`f26bedfe5abf0e3537f5e13063259e815aad08de`  
分支：`cursor/medix-light-shell-login-8593`  
范围：只做共用外壳/主题/资产和登录页。工作台与患者管理的页面内容留给后续 PR。

冻结包已原样拷入 `docs/design/medix-light/handoff-0123-v1/`，FREEZE.json 列出的 sha256 与拷贝后文件一致。本日志不改冻结包里的复选框。

## 任务 00

- 记录开工 git 状态与 `frontend-web` 的 `npm run build` / `npm run lint`。基线：build 通过；lint 12 条既有 warning、0 error。见 `baseline-git.txt`、`baseline-build.txt`、`baseline-lint.txt`。
- 新增局部 token、`medixTheme`（`inherit: false`）和作用域 CSS。规则只挂在 `.ml-shell` / `.ml-page` / `.ml-auth`。没有改 `html` 的 font-size，实测仍是 16px。
- 新增 `components/medix` 契约组件。02/03 页面还没有改用它们。
- 新增 `assets/medix` 自绘矢量。来源见 `SOURCES.md`。没有随机人脸，也没有把冻结图当背景。
- `WebLayout` 增加 `variant="medix"`，`standard` / `comfort` 仍走原来的函数。
- `App.tsx` 只把 `/workbench` 和 `/patients` 挂到 medix。`/patients/:id`、`/plans`、`/stats`、`/followups`、`/admin` 仍是 Comfort。登录页单独包 `MedixThemeBoundary`。
- `main.tsx` 只多引入 `medix-light.css`，全局 `theme.ts` 保留。
- 顶栏搜索、菜单高亮、退出已在浏览器里走通（搜索数据是拦截的演示名单，见报告）。侧栏 240px，顶栏高 80px 且从 x=240 开始。选中底 `#F4F0FF`，选中条宽度 0。无分组标题、无计数徽标、侧栏底没有重复账号。

## 任务 01

- 重排 `LoginPage`：浅灰全屏、31.5rem 白卡片、薄边、无阴影、品牌行、一次正式产品名、医护端登录、可见标签、密码显隐、紫按钮、左下插画。
- 仍走 `useAuth.login`。令牌存储没有改。空字段由 Form required 拦住。401 文案留在页内。提交中按钮 loading，重复点击与 Enter 只发出 1 次登录请求（mock 延迟）。
- 跳转优先级按代码保持，并用拦截响应验证：强制改密（即使角色是 ADMIN）到 `/change-password`；管理员到 `/admin`；医护到 `/workbench`。这不是真实后端通过。
- `/change-password` 没有改版。实测仍是旧的诊所蓝卡片。

## 未做

- 任务 02 工作台内容、任务 03 患者列表布局、统计口径、患者 App、API 契约。
