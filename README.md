# 吸入治疗指导与依从性辅助管理软件 V1.0

> 内部简称：**吸入治疗管理系统** ｜ 版本 **V1.0** ｜ PRD 基线 **PRD 1.5** ｜ 技术基线 **TECH_DESIGN 1.1**

面向呼吸慢病吸入治疗教育的双客户端辅助管理软件：医护人员通过电脑浏览器访问 **Web 管理端**（含管理员受限菜单），患者通过**可安装的 Android App** 学习具体装置型号、执行步骤自检和用药自报登记；两端共用 FastAPI 后端与 PostgreSQL 数据库。

> **非临床部署声明**：V1.0 为可演示的辅助管理原型，使用模拟数据（10+ 个 `DEMO` 标记患者）。未经医学内容审核、数据保护评估和必要的院方审批前，不进入真实患者临床使用。

---

## 1. 客户端与角色

| 客户端 | 承载页面 | 角色 |
|---|---|---|
| `frontend-web/`（React + TypeScript + Vite + Ant Design） | G01、M01–M06 | 医护 Clinician / 管理员 Admin |
| `patient-app/`（React + TypeScript + Vite + Capacitor Android） | G01、P01–P05 | 患者 Patient |
| `backend/`（Python 3.11+ / FastAPI / SQLAlchemy / Alembic） | 统一 REST API | 服务端鉴权与业务 |
| PostgreSQL | 唯一业务数据库 | — |

- 统计口径为「基于登记记录的覆盖率」，**不等于实际服药依从性**；患者未登记不推定漏药。
- AI 仅基于**已审核发布**的装置型号资料问答，不提供诊断/剂量建议。

---

## 2. 环境基线（J001，2026-10-15 实测）

| 依赖 | 实测版本 | 要求 |
|---|---|---|
| Python | 3.12.7 | ≥ 3.11 |
| Node.js | 22.23.1 | 与 Capacitor 版本匹配 |
| npm / pnpm | 11.4.2 / 11.7.0 | 任选其一（默认 pnpm） |
| Git | 2.48.1 | — |
| Java | **JDK 21.0.2**（`D:\dev\tools\jdk-21.0.2`） | Capacitor 8 / AGP 8.13 需 JDK 21 |
| PostgreSQL | **16.6**（`D:\dev\tools\pgsql\pgsql`，端口 5432，trust 认证） | 唯一业务数据库 |
| Android SDK | **cmdline-tools 12.0 + platform-tools + platforms/android-34 + build-tools/34.0.0**（`D:\dev\tools\android-sdk`） | J008 打包 |

> 环境一键配置：`. .\env-setup.ps1`（设置 JAVA_HOME/ANDROID_HOME/PG_HOME/PATH）。
> PostgreSQL 启动：`D:\dev\tools\pgsql\pgsql\bin\postgres.exe -D D:\dev\pgsql-data -p 5432`（已运行中）。

---

## 3. 目录结构

```text
repository/
├── frontend-web/            # 医护 Web（含管理员）
├── patient-app/             # 患者 React + Capacitor Android（含 android/）
├── backend/                 # FastAPI 单体后端
│   ├── app/
│   │   ├── main.py          # 入口 + /api/health
│   │   ├── core/            # config / database / security / errors
│   │   ├── api/  models/  schemas/  services/  repositories/  auth/  rag/
│   ├── alembic/             # 数据库迁移
│   ├── tests/
│   └── requirements.txt
├── seed/                    # demo_data.py（基础）/ demo_data_full.py（丰富演示数据）
├── docs/                    # DEPLOY / ANDROID_BUILD / TESTING 等
├── Task-1.0/                # 分阶段任务明细（J001–J056）
└── TASKS.md                 # 任务总纲
```

---

## 4. 快速启动（开发演示）

```powershell
# 0) 配置环境变量（JDK/PG/Android SDK 路径）
. .\env-setup.ps1

# 1) 启动 PostgreSQL（如未运行）
Start-Process -FilePath "D:\dev\tools\pgsql\pgsql\bin\postgres.exe" -ArgumentList "-D","`"D:\dev\pgsql-data`"","-p","5432" -WindowStyle Hidden

# 2) 后端（backend/ 下）
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt   # 首次
.\.venv\Scripts\python.exe -m alembic upgrade head             # 建表
cd ..
backend\.venv\Scripts\python.exe -m seed.demo_data        # 基础种子（账号/患者/型号）
backend\.venv\Scripts\python.exe -m seed.demo_data_full   # 丰富演示数据（计划/登记/统计/随访等，幂等）
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8010
# 探活：http://127.0.0.1:8010/api/health  →  {"status":"ok"}
# OpenAPI：http://127.0.0.1:8010/openapi.json

# 3) 医护 Web（frontend-web/ 下）—— 注意固定端口 5180
cd frontend-web
pnpm install
pnpm run dev        # → http://127.0.0.1:5180

# 4) 患者 App 前端调试（patient-app/ 下）
cd patient-app
pnpm install
pnpm run dev
```

### 演示账号（密码统一为 `123`，已取消强制改密）

| 账号 | 密码 | 角色 | 说明 |
|---|---|---|---|
| `admin` | `123` | 管理员 | 含 M06 内容与账号管理菜单 |
| `clinician_a` | `123` | 医护 A | 负责多数演示患者 |
| `clinician_b` | `123` | 医护 B | 用于演示跨医护隔离 |
| `patient_x` | `123` | 患者 | 绑定 P-001 林女士 |
| `patient_y` | `123` | 患者 | 绑定 P-002 陈先生 |

> ⚠️ **端口约定**：后端 **8010**（8000 被本机 Anaconda 占用）；医护 Web dev **5180**（5173 被本机其它项目占用）。`frontend-web/vite.config.ts` 已固定端口并把 `/api` 代理到 8010。

> 📄 详细部署见 [docs/DEPLOY.md](docs/DEPLOY.md)；APK 打包见 [docs/ANDROID_BUILD.md](docs/ANDROID_BUILD.md)；环境安装见 [docs/ENV_SETUP.md](docs/ENV_SETUP.md)；测试记录见 [docs/TESTING.md](docs/TESTING.md)；任务拆解见 [TASKS.md](TASKS.md)。

---

## 5. 文档索引

| 文档 | 说明 |
|---|---|
| [软著PRD-V1.5.md](软著PRD-V1.5.md) | 产品需求（做什么、验收边界） |
| [TECH_DESIGN.md](TECH_DESIGN.md) | 技术架构（怎么做） |
| [DATABASE_DESIGN.md](DATABASE_DESIGN.md) | 表结构与约束 |
| [API_SPEC.md](API_SPEC.md) | 接口契约 |
| [UX_DESIGN.md](UX_DESIGN.md) | 用户流程与交互 |
| [UI_DESIGN.md](UI_DESIGN.md) | 视觉与界面 |
| [TASKS.md](TASKS.md) | 任务拆解总纲 |

> 出现设计文档冲突时，以 PRD 业务范围与验收为准，先记录冲突点再决策，不允许开发时悄悄新增/删减/重定义需求。
