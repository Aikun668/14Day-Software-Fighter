# 开发环境安装记录（2026-10-15）

> 本文件记录 D1–D2 阶段在本机（Windows，D 盘）安装的开发环境，供复现与交接。所有工具均为免安装版，装在 `D:\dev\` 下。

## 1. 安装位置总览

| 组件 | 路径 | 说明 |
|---|---|---|
| JDK 21 | `D:\dev\tools\jdk-21.0.2` | OpenJDK 21.0.2（华为云镜像），Capacitor 8/AGP 8.13 需要 |
| JDK 17 | `D:\dev\tools\jdk-17.0.2` | OpenJDK 17.0.2（备用） |
| PostgreSQL 16.6 | `D:\dev\tools\pgsql\pgsql` | EDB 免安装 zip |
| PostgreSQL 数据目录 | `D:\dev\pgsql-data` | initdb 生成，trust 认证 |
| Android SDK | `D:\dev\tools\android-sdk` | cmdline-tools 12.0 + platform-tools + android-34/36 + build-tools 34/35/36 |
| 下载缓存 | `D:\dev\downloads` | 各安装包 zip |

## 2. 一键配置环境变量

```powershell
. .\env-setup.ps1
```

设置 `JAVA_HOME`（JDK 21）、`ANDROID_HOME`、`ANDROID_SDK_ROOT`、`PG_HOME`，并把各 bin 加入 PATH。

## 3. 启动 PostgreSQL

```powershell
# 启动（如未运行）
Start-Process -FilePath "D:\dev\tools\pgsql\pgsql\bin\postgres.exe" -ArgumentList "-D","`"D:\dev\pgsql-data`"","-p","5432" -WindowStyle Hidden

# 停止
D:\dev\tools\pgsql\pgsql\bin\pg_ctl.exe -D D:\dev\pgsql-data stop
```

- 连接：`postgres` 用户，无密码（trust，仅本地演示）；业务库 `inhaler_demo`。
- 连接串：`postgresql+psycopg2://postgres@127.0.0.1:5432/inhaler_demo`

## 4. 数据库迁移与种子

```powershell
cd backend
.venv\Scripts\python.exe -m alembic upgrade head      # 建表

# 种子（从项目根，PYTHONPATH 指向 backend）
cd ..
$env:PYTHONPATH = "$PWD\backend"
backend\.venv\Scripts\python.exe -m seed.demo_data   # 幂等，可重复
```

## 5. 已知事项

- 本机 8000 端口被 Anaconda python 占用；后端联调用 **8010** 端口（见 DEPLOY.md）。
- Android SDK license 已接受（`android-sdk\licenses\android-sdk-license`）。
- Java 25 仍在本机 PATH，但 `env-setup.ps1` 会优先注入 JDK 17；Android 构建须用 JDK 17。
