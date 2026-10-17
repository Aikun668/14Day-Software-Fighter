# Android APK 打包与安装说明（ANDROID_BUILD）

> 适用版本：**吸入治疗指导与依从性辅助管理软件 V1.0**（患者端）
> 最后更新：2026-10-15 ｜ 对应任务：J054
> 相关文档：[DEPLOY.md](DEPLOY.md)（后端与局域网）· [ENV_SETUP.md](ENV_SETUP.md)（构建环境）

---

## 1. 包标识与版本（已冻结）

| 项 | 值 |
|---|---|
| applicationId | `com.inhalertherapy.patient` |
| minSdk | 24（Android 7.0） |
| compileSdk / targetSdk | 36 |
| versionCode | 1（升级安装须递增） |
| versionName | 1.0 |
| 签名类型 | **Debug**（演示包）；Release 正式签名待定 |
| 应用名 | 吸入治疗管理系统 |
| APK 路径 | `patient-app/android/app/build/outputs/apk/debug/app-debug.apk` |

> **交付标注要求**：本次交付为 **Debug 演示包**（便于受控局域网 HTTP 联调），文件名/说明中须明确标注"调试签名演示包"，不得冒充正式发布包。

### 构建环境

| 组件 | 版本 / 路径 |
|---|---|
| JDK | **21.0.2**（`D:\dev\tools\jdk-21.0.2`）— Capacitor 8 / AGP 8.13 需要 |
| Android SDK | `D:\dev\tools\android-sdk` |
| platform-tools | 含 `adb` |
| platforms | android-36（android-34 保留） |
| build-tools | 36.0.0 |
| Gradle | 8.14.3（wrapper 已指向腾讯云镜像，避免下载超时） |
| Node / pnpm | Node 22.23.1 / pnpm 11.7.0 |
| Capacitor | 8.5.3（core/cli/android）+ app 8.1.2 / status-bar 8.0.4 / keyboard 8.0.6 |

---

## 2. 构建流程（可复现）

```powershell
# 0) 准备环境变量
. .\env-setup.ps1        # 设置 JAVA_HOME=JDK21、ANDROID_HOME 等

# 1) 指定后端地址（关键！真机必须用开发机局域网 IP）
cd patient-app
# 写入 .env.local：
#   VITE_API_BASE_URL=http://<开发机局域网IP>:8010
# 例如 VITE_API_BASE_URL=http://10.233.77.4:8010

# 2) 构建前端产物
pnpm install
pnpm run build

# 3) 同步到 Android 原生工程
pnpm exec cap sync android

# 4) Gradle 打包
cd android
.\gradlew.bat assembleDebug --no-daemon
# 产物：app\build\outputs\apk\debug\app-debug.apk
```

### 校验产物地址已正确注入

```powershell
# 构建产物中应包含开发机 IP
Select-String -Path "dist\assets\*.js" -Pattern "<开发机IP>" -SimpleMatch
```

> ⚠️ 常见坑：忘记设 `VITE_API_BASE_URL` 时，App 会走代码里的兜底地址；**每次改后端地址都要重新 `build` + `cap sync` + 打包**（前端产物是编译进 APK 的）。

---

## 3. 真机安装

```powershell
# 确认设备已授权（手机需开启 USB 调试）
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices

# 安装（-r 覆盖安装，保持已登录数据；首次可去掉）
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s <设备序列号> install -r `
  "app\build\outputs\apk\debug\app-debug.apk"

# 启动
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s <设备序列号> shell am start `
  -n com.inhalertherapy.patient/.MainActivity
```

**小米/红米手机额外设置**（实测需要）：
- 开发者选项 → 打开「**USB 安装**」（否则报 `INSTALL_FAILED_USER_RESTRICTED`）
- 通知栏 USB 连接方式选「传输文件」（否则电脑识别不到设备）

---

## 4. 网络、会话与权限约定（PRD §8.3.5）

### 网络

- API 地址由 `VITE_API_BASE_URL` 在构建时注入；**禁止**写死 `localhost` / `0.0.0.0`。
- **Debug 构建**：`app/src/debug/AndroidManifest.xml` + `res/xml/network_security_config.xml` 放开受控明文 HTTP（仅模拟数据）。
- **非调试构建**：默认 HTTPS，不放开 `usesCleartextTraffic`，不绕过证书校验。

### 会话（重要）

- 访问令牌**仅存内存**（React Context），不写 `localStorage` / `sessionStorage` / Preferences / SQLite。
- 冷启动、杀进程、WebView 重建后**必须重新登录**（演示环境令牌有效期 60 分钟）。
- 显式退出会请求服务端撤销会话；断网时本地清空并提示"远端撤销未确认"。
- 无持久刷新令牌，不实现免登录恢复。

### 权限

仅申请两项，均属必需：

| 权限 | 用途 |
|---|---|
| `INTERNET` | 访问后端 API |
| `ACCESS_NETWORK_STATE` | 判断网络可用性，用于断网提示 |

> **不申请**摄像头、蓝牙、系统通知权限；**不实现**系统推送、离线登记与自动同步。

### 系统交互

- Android 系统返回键：二级页面返回上一页；根页面（今日/指导/记录）连按两次退出。
- 已处理状态栏安全区（刘海/状态栏不遮挡内容）；引入 Keyboard 插件应对软键盘。
- 底部导航：今日 / 指导 / 记录三个根页面。

---

## 5. 升级与签名

| 事项 | 要求 |
|---|---|
| 升级安装 | 保持相同 `applicationId` 与签名，`versionCode` 递增 |
| 签名私钥 | **不得提交源码仓库**；由交付方另行保管 |
| 正式包 | 需替换为 Release 签名 + HTTPS 后端，并关闭明文 HTTP 例外 |

---

## 6. 已知限制

- 未实现 iOS 安装包、应用商店上架、自动更新。
- 未接入真实吸入装置（设备事件接口固定返回 501）。
- Demo 包使用 Debug 签名，仅供受控局域网演示。
