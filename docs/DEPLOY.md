# 部署与运行说明（DEPLOY）

> 适用版本：**吸入治疗指导与依从性辅助管理软件 V1.0**（演示原型，模拟数据）
> 最后更新：2026-10-15 ｜ 对应任务：J052
> 相关文档：[ENV_SETUP.md](ENV_SETUP.md)（环境安装）· [ANDROID_BUILD.md](ANDROID_BUILD.md)（APK 打包）· [TESTING.md](TESTING.md)（测试记录）

---

## 1. 架构与端口约定

| 组件 | 技术 | 本机端口 | 说明 |
|---|---|---|---|
| 后端 API | FastAPI + Uvicorn（**单进程**） | **8010** | 统一 REST API，Web 与 App 共用 |
| 数据库 | PostgreSQL 16.6 | 5432 | 业务库 `inhaler_demo` |
| 医护 Web | React + Vite（dev） | **5180** | `/api` 代理到后端 8010 |
| 患者 App | React + Capacitor → Android APK | — | 通过局域网 IP 直连后端 |

> ⚠️ **端口为什么不是默认的 8000/5173**：开发机 8000 被本机 Anaconda 进程占用、5173 被本机另一个前端项目占用，因此本项目固定使用 **8010 / 5180**。`frontend-web/vite.config.ts` 已设 `strictPort: true` 防止自动漂移。

### 硬约束

- 后端**必须单工作进程**，禁止 `--workers N`。任务扫描器（每 5 分钟扫描待核查任务）是进程内单实例，多进程会导致重复扫描与日志噪声。
- `0.0.0.0` 是**服务端监听地址**，绝不能填进手机端 API URL（手机上的 `0.0.0.0`/`localhost` 指向手机自身）。
- 演示环境为**受控局域网 + 模拟数据**；正式分发需 HTTPS。

---

## 2. 首次部署（从空库到可运行）

```powershell
# 0) 配置环境变量（JDK / PostgreSQL / Android SDK 路径）
. .\env-setup.ps1

# 1) 启动 PostgreSQL（如未运行）
Start-Process -FilePath "D:\dev\tools\pgsql\pgsql\bin\postgres.exe" `
  -ArgumentList "-D","`"D:\dev\pgsql-data`"","-p","5432" -WindowStyle Hidden

# 2) 后端依赖 + 建表
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m alembic upgrade head

# 3) 演示数据（两个脚本可依次执行；demo_data_full 幂等，可重复运行）
cd ..
backend\.venv\Scripts\python.exe -m seed.demo_data         # 账号 / 患者 / 型号 / 草稿指导
backend\.venv\Scripts\python.exe -m seed.demo_data_full    # 计划 / 登记 / 统计 / 训练 / 任务 / 随访 / 知识库

# 4) 启动后端（单进程）
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8010
```

**验证**：

| 检查项 | 命令 / 地址 | 期望 |
|---|---|---|
| 探活 | `http://127.0.0.1:8010/api/health` | `{"status":"ok"}` |
| OpenAPI | `http://127.0.0.1:8010/openapi.json` | 返回接口文档 |
| 数据 | 用 `admin` / `123` 登录 Web | 内容管理四标签页有数据 |

---

## 3. 启动医护 Web

```powershell
cd frontend-web
pnpm install          # 首次
pnpm run dev          # → http://127.0.0.1:5180
```

- 生产构建：`pnpm run build`（产物在 `frontend-web/dist/`）。
- API 地址：开发期由 Vite 代理（`/api` → `127.0.0.1:8010`）；独立部署时在 `.env.local` 设 `VITE_API_BASE_URL`。

---

## 4. 局域网真机联调（Android App）

### 4.1 后端监听与网络准备

1. 后端以 `--host 0.0.0.0 --port 8010` 启动（**单进程**）。
2. 记录开发机局域网 IPv4：
   ```powershell
   Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.InterfaceAlias -eq "WLAN" }
   ```
   本次实测为 `10.233.77.4`（WiFi 名以实际为准）。
3. Windows 防火墙**仅对专用网络、仅对局域网来源**放行 TCP 8010 入站；调试结束删除临时规则。**不要关闭整套防火墙。**

### 4.2 连通性判定顺序（排障用）

| 现象 | 优先排查 |
|---|---|
| 开发机本地都访问失败 | 服务是否启动、是否监听 8010 |
| 开发机可访问、手机浏览器超时 | 监听地址、防火墙入站规则、是否同一网段、路由器 AP 隔离 / VPN |
| 手机浏览器可访问、APK 失败 | APK 编译进的 API 地址、Android 调试版明文 HTTP 配置、WebView Origin/CORS |
| APK 请求 401 | 令牌过期（演示默认 60 分钟）；App 冷启动需重新登录 |
| APK 显示"网络不可用"但浏览器正常 | 多为 CORS 或明文 HTTP 被拦（后端已配 CORS 允许列表） |

### 4.3 App 的网络配置

- API 地址通过 `VITE_API_BASE_URL` 在**构建时**注入，禁止写死 `localhost`。
- Debug 构建：`patient-app/android/app/src/debug/` 下放开受控明文 HTTP（仅模拟数据）。
- 非调试构建：默认 HTTPS，不绕过证书校验。

---

## 5. 环境变量

见 `backend/.env.example`（复制为 `backend/.env`）：

| 变量 | 说明 | 演示默认值 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql+psycopg2://postgres@127.0.0.1:5432/inhaler_demo` |
| `JWT_SECRET` | 令牌签名密钥 | 演示用占位值，**正式部署必须更换** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 令牌有效期 | 60 |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | 外部 LLM（可替换） | 留空 → AI 走**抽取式回答**（基于已审片段，不编造） |
| `TASK_SCAN_INTERVAL_SECONDS` | 任务扫描周期 | 300（5 分钟） |

> 密钥、签名私钥、`.env` 一律不提交 Git，也不打进 APK。

---

## 6. 已知限制与注意事项

| 项 | 说明 |
|---|---|
| 任务生成延迟 | 待核查任务由周期扫描物化，最多延迟一个扫描周期（默认 5 分钟）。立即触发：`python -m app.jobs.scan_due_tasks` |
| 单进程约束 | 见 §1；如需多进程，须先把扫描器迁移为单实例调度 |
| 演示数据 | 全部为虚构 DEMO 数据；指导内容为演示素材，**未经临床审核** |
| 端口占用 | 若 8010/5180 再被占用，改端口时须同步改 `vite.config.ts` 的 proxy 与 App 的 `VITE_API_BASE_URL` |
| 非临床用途 | 界面与报告均标注"不能替代专业诊疗" |
