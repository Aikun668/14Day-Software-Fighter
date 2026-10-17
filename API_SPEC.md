# 吸入治疗指导与依从性辅助管理软件 V1.0｜API 接口契约

| 项目 | 内容 |
|---|---|
| 文档版本 | API_SPEC 1.0（2026-10-13） |
| 依据 | PRD 1.4、TECH_DESIGN 1.0、DATABASE_DESIGN 1.0 |
| 适用范围 | 医护 Web、患者 Android APK、统一 FastAPI 后端 |
| 状态 | **开发契约初稿**；Pydantic/OpenAPI 落地后须逐项对照，差异经评审记录，不得暗改 PRD |

> 本文件解决“前端传什么、后端返回什么”。不重复 PRD 的产品说明、TECH_DESIGN 的架构或 DATABASE_DESIGN 的建表说明。**所有接口及权限以 PRD 1.4 §8.2 为基线**，下文补充的字段、分页、响应封装和状态转换属于实现契约，不增加用户功能。V1.0 仅模拟数据，不作真实临床用途。

## 1. 公共规范

### 1.1 URL、认证和角色

- 根路径：`/api`；Web、Android 共用接口，不另建 App 专用 API。
- 请求/响应 JSON，UTF-8；业务资源使用 UUID 字符串；时间传带时区的 ISO 8601，例如 `2026-10-13T08:05:00+08:00`，存储时统一 UTC。
- 除 `/api/auth/login` 与 `/api/health` 外均需 `Authorization: Bearer <access_token>`。token 包含 `sub/jti/iat/exp`；服务端每次核验 `auth_sessions`、用户状态和资源权限。
- `Patient` 只能访问本人 `/api/me/*` 和本人获授权业务；`Clinician` 只能管理分配给自己的患者；`Admin` 默认仅管理账号、归属、目录和审计，**不继承患者临床记录读取权**。
- 内容审核与发布采用单独授权：`Admin` 角色不等于医学审核资格；发布前必须保留真实医学审核人及审核时间。患者端不可读草稿。
- 首次登录 `must_change_password=true` 时仅允许 `/api/me`、改密和退出；改密后撤销旧会话，重新登录。
- App token 只保留内存、短有效期；冷启动重新登录；不使用持久 refresh token。断网提交不得显示成功；写请求超时应先重新查询再决定是否补交。

### 1.2 响应、分页和日期筛选

普通读取返回**资源对象**；集合读取使用统一分页格式：

```json
{
  "items": [{ "id": "uuid", "...": "按具体资源定义" }],
  "total": 12,
  "page": 1,
  "page_size": 20
}
```

- 列表查询参数：`page`（默认 1）、`page_size`（默认 20，最大 100）；业务接口可附搜索、状态、患者、日期筛选。
- 统计区间：`from=2026-10-01&to=2026-10-08`，**业务日期左闭右开** `[from, to)`，按计划时区解释；`to` 必须晚于 `from`。固定计划 `planned_slot` 只统计到期且有效的时点。
- 日期时间（如 `starts_at`、`occurred_at`）与纯日期（`from/to/date`）不可混用；API 不接受含糊的无时区时间戳。
- 成功创建通常 `201`，成功查询/修改 `200`，无响应正文的退出可 `204`；若使用 `204`，前端不得尝试解析 JSON。
- 响应字段遵守**稳定命名**：`occurred_at`（统一字段命名）、`recorded_at`、`plan_group_id`、`slot_id`、`device_model_id`。

统一错误：

```json
{
  "code": "PLAN_VERSION_CONFLICT",
  "message": "用药计划版本冲突，请刷新后重试",
  "details": null
}
```

| HTTP | 场景 | 前端处理 |
|---|---|---|
| 400 | 业务逻辑无效、无效时间区间 | 展示提示，允许修正 |
| 401 | 未登录、会话过期或撤销 | 清空内存令牌，重新登录 |
| 403 | 角色权限不足 | 不展示受限内容 |
| 404 | 资源不存在；也可用于隐藏越权资源存在性 | 统一“资源不可访问” |
| 409 | 唯一键/计划版本/状态冲突 | 刷新数据再操作 |
| 422 | 字段格式或必填校验失败 | 显示字段错误 |
| 500 | 意外服务异常 | 通用提示，不输出堆栈 |
| 503 | 外部 LLM 暂不可用 | 仅 AI 局部失败，其他功能正常 |

**约束优先级**：服务端鉴权与跨表校验高于客户端提交数据；不要因为 UI 不展示某按钮就省略 API 检查。账号密码、令牌、第三方 AI Key、原始敏感问答不进日志和审计详情。

### 1.3 统一资源 Schema（最少字段）

此表为**对外响应模型**的字段基线，不是完整数据库建表文档。写接口的必填字段见第 2 章；可空字段显式返回 `null`（或在 OpenAPI 中标记可空），不要有时是字符串有时是对象。

| Schema | 关键返回字段 | 说明 |
|---|---|---|
| `UserBrief` | `id, account, role, status, must_change_password` | 不返回 password_hash |
| `PatientBrief/PatientDetail` | `id, patient_code, display_name, diagnosis_label?, assigned_clinician_id, account_user_id?`；Detail 追加 `note?, current_devices?` | 医护按归属访问；App 仅本人 |
| `DeviceModel` | `id, category, brand, model_name, manufacturer?, status` | `category` 为 `pMDI/DPI/SMI` |
| `Guide` | `id, device_model_id, version, title, source_title?, source_url?, review_status, steps[]` | `steps[]: id, step_no, text, error_notes?, image_path?`；患者只读已发布版本 |
| `TrainingSession` | `id, patient_id, device_model_id, guide_id, source, submit_at, result, step_results[]` | `step_results[]: step_id, check_state, note?` |
| `MedicationPlan` | `id, patient_id, plan_group_id, version, device_model_id, drug_label, plan_type, timezone, starts_at, ends_at?, daily_times[]` | `daily_times[]: local_time, label?, is_enabled`，仅 REGULAR 使用 |
| `PlannedSlot` | `id, plan_id, patient_id, scheduled_at, state, has_active_record` | `state` 至少 `ACTIVE/CANCELLED`；状态由后端推导 |
| `MedicationEvent` | `id, patient_id, plan_id, slot_id?, source, occurred_at, recorded_at, status, note?, revoked_at?` | `status=ACTIVE/REVOKED`；V1.0 不产生 DEVICE |
| `Task` | `id, patient_id, task_type, status, assigned_to, due_at?, closed_at?` | 内部任务只给所属医护；去重字段 `trigger_key` 不强制给患者 |
| `Followup` | `id, patient_id, task_id?, clinician_id, followed_at, feedback?, action_taken?, next_plan?` | 医护随访历史 |
| `PatientReminder` | `id, kind, title, due_at?, status, source_type, related_id?` | 合并动态用药提醒与持久复训/随访提醒；不含医护内部 task 内容 |
| `KnowledgeDocument` | `id, device_model_id, guide_id?, title, version, review_status, source_url?, reviewed_by?, reviewed_at?, published_at?` | 仅 PUBLISHED 进入 RAG |
| `AuditLog` | `id, actor_id?, action, resource_type, resource_id, created_at, detail` | detail 不含密钥、原始敏感问答 |

**枚举**：`role=PATIENT/CLINICIAN/ADMIN`（枚举 JSON 值统一大写，前端显示另作中文映射）；`plan_type=REGULAR/PRN`；`event/training source=PATIENT_REPORT/CLINICIAN_OBSERVED`（`DEVICE` 只预留）；`task.status=OPEN/IN_PROGRESS/CLOSED`；`event.status=ACTIVE/REVOKED`；`guide/knowledge.review_status` 至少包含 `DRAFT/PUBLISHED`，审核通过的中间状态与审核时间由实现统一确定，不得跳过实际医学审核。`patient_reminders.status` 技术约定为 `PENDING/COMPLETED/CANCELLED`。

## 2. 各业务 API 契约（对应 PRD §8.2）

表中 `→` 后为成功响应的主要结构/状态；`?` 表示可选。未重复列出的字段按 §1.3 资源 Schema；所有 ID 必须为 UUID，后端自行赋予 `created_by/recorded_at/source` 等可信字段。

### 2.1 AUTH：认证、账号、分配

| 方法与路径 | 权限 | 请求参数 / JSON | 成功响应与关键校验 |
|---|---|---|---|
| `POST /api/auth/login` | 公开 | `{account, password}` | `200 → {access_token, token_type:"bearer", expires_at, user:UserBrief}`；口令错误统一 401，停用账号拒绝登录 |
| `POST /api/auth/logout` | 已登录 | 无正文 | `204`；服务端撤销当前 jti；App/Web 清内存 token |
| `POST /api/auth/change-password` | 已登录 | `{old_password, new_password}` | `200 → {password_changed:true, relogin_required:true}`；撤销当前及需要失效的会话，禁止复用旧密码继续登录 |
| `GET /api/me` | 已登录 | 无 | `200 → UserBrief`；首次改密标志由此读取 |
| `GET /api/admin/users` | Admin | `page,page_size,role?,status?` | `200 → Page<UserBrief>`；不得返回密码哈希 |
| `POST /api/admin/users` | Admin | `{account, initial_password?, role:"CLINICIAN"}` | `201 → UserBrief + temporary_password?`，初始凭据由受控流程设置/一次性交付；不得在通用列表响应中返回密码 |
| `PATCH /api/admin/users/{id}` | Admin | `{status}` | `200 → UserBrief`；停用后旧会话即失效 |
| `POST /api/patients/{id}/account` | 所属医护 | `{account, initial_password?}` | `201 → {patient_id,user:UserBrief,temporary_password?}`；只允许为所负责患者创建/关联唯一 Patient 账号；冲突 409 |
| `GET /api/admin/patient-assignments` | Admin | `page,page_size,search?` | `200 → Page<{patient_id,patient_code,assigned_clinician_id}>`；仅分配所需字段 |
| `PATCH /api/admin/patient-assignments/{patient_id}` | Admin | `{assigned_clinician_id}` | `200 → {patient_id,assigned_clinician_id}`；审计归属变更，不直接泄露临床资料 |

初始密码约定：可由授权操作者输入或由后端生成**一次性临时密码**；若后端生成，仅在创建成功时通过受限安全响应展示一次，后续查询绝不重返。创建后 `must_change_password=true`。不新增找回密码/短信验证等 P0 范围外功能。

### 2.2 PAT：患者与装置绑定

| 方法与路径 | 权限 | 请求参数 / JSON | 成功响应与关键校验 |
|---|---|---|---|
| `GET /api/patients` | Clinician | `page,page_size,search?` | `200 → Page<PatientBrief>`；只返回责任医护的患者 |
| `POST /api/patients` | Clinician | `{patient_code,display_name,diagnosis_label?,note?}` | `201 → PatientBrief`；责任医护取当前用户，患者编号全局唯一 |
| `GET /api/patients/{id}` | 所属医护 | 无 | `200 → PatientDetail`（PatientBrief 加 `note?` 与当前装置摘要）；越权 404 或 403 |
| `PATCH /api/patients/{id}` | 所属医护 | `{display_name?,diagnosis_label?,note?}` | `200 → PatientBrief`；不可绕过管理员私改责任医护 |
| `GET /api/me/patient` | Patient | 无 | `200 → PatientBrief + current_devices[]`；只读本人；医护录入的用药计划另取 `/api/me/medication-plans` |
| `GET /api/patients/{id}/devices` | 所属医护 | 无 | `200 → {items:[{id,device_model_id,effective_from,effective_to?}],total,...}` |
| `POST /api/patients/{id}/devices` | 所属医护 | `{device_model_id,effective_from}` | `201 → {id,patient_id,device_model_id,effective_from,effective_to:null}`；同一装置绑定关系的生效期按服务端规则关闭旧记录，历史训练不改写 |

**P01 展示**：“本人档案/当前装置”来自 `/api/me/patient`，“医护录入计划”来自 `/api/me/medication-plans`，不能把模拟计划包装为系统生成的临床医嘱。

### 2.3 DEV：装置目录、指导、审核发布

| 方法与路径 | 权限 | 请求参数 / JSON | 成功响应与关键校验 |
|---|---|---|---|
| `GET /api/device-models` | Patient/Clinician | `category?,page?,page_size?` | `200 → Page<DeviceModel>`；患者只获可用/已发布型号信息，不返回草稿指导 |
| `GET /api/device-models/{id}/guide` | Patient/Clinician | 无 | `200 → Guide`（当前已发布版本）；未发布 404；患者请求应符合当前装置归属及授权规则 |
| `GET /api/admin/device-models` | Admin | `page,page_size,search?` | `200 → Page<DeviceModel>`（后台可含未发布型号） |
| `POST /api/admin/device-models` | Admin | `{category,brand,model_name,manufacturer?}` | `201 → DeviceModel`；型号标识按后台约束避免重复 |
| `GET /api/admin/device-guides` | Admin/授权医护 | `device_model_id?,review_status?,page,page_size` | `200 → Page<GuideSummary>` |
| `POST /api/admin/device-guides` | Admin/授权医护 | `{device_model_id,version,title,source_title?,source_url?,steps:[{step_no,text,error_notes?,image_path?}]}` | `201 → Guide`（DRAFT）；同型号版本唯一，步骤号唯一 |
| `GET /api/admin/device-guides/{id}` | Admin/授权医护 | 无 | `200 → Guide`，后台可预览草稿 |
| `PATCH /api/admin/device-guides/{id}` | Admin/授权医护 | `{title?,source_title?,source_url?,steps?,review_action?}` | `200 → Guide`；只允许修改 DRAFT；`review_action="APPROVE"` 仅医学授权人员可操作，服务端写审核人和时间 |
| `POST /api/admin/device-guides/{id}/publish` | 具发布权限者 | 无正文 | `200 → {id,review_status:"PUBLISHED",published_at}`；必须核对已有真实医学审核记录，发布后不可原地修改 |

本版允许通过后台录入已核实的指导文字和步骤；没有临床审核的示例不应通过修改状态绕过发布条件。`image_path` 为已授权素材的可访问静态资源相对路径，V1.0 不额外新增上传服务 API。

### 2.4 TRAIN：自检与医护观察

| 方法与路径 | 权限 | 请求参数 / JSON | 成功响应与关键校验 |
|---|---|---|---|
| `POST /api/training-sessions` | 本人/所属医护 | `{patient_id?,device_model_id,guide_id,result,step_results:[{step_id,check_state,note?}],source?}` | `201 → TrainingSession`；患者身份从令牌取；医护必须有归属；患者 source 固定 PATIENT_REPORT，医护观察固定 CLINICIAN_OBSERVED |
| `GET /api/me/training-sessions` | Patient | `page,page_size` | `200 → Page<TrainingSession>`；包括逐步结果，承载 P03 历史详情 |
| `GET /api/patients/{id}/training-sessions` | 所属医护 | `page,page_size,source?` | `200 → Page<TrainingSession>`；来源在每条记录标明 |

`source` 可以出现在 PRD 示例/客户端声明中，但**不能授权客户端自行决定来源**；与登录身份、操作角色冲突时返回 403/422，V1.0 永远不允许提交 `DEVICE`。`check_state` 约定 `DONE/DIFFICULT/NOT_DONE`，只表示患者自检/医护观察结论，不代表设备检测通过。

### 2.5 PLAN：计划版本与计划时点

| 方法与路径 | 权限 | 请求参数 / JSON | 成功响应与关键校验 |
|---|---|---|---|
| `GET /api/patients/{id}/medication-plans` | 所属医护 | `include_history=true/false,page,page_size` | `200 → Page<MedicationPlan>`；历史版本可查 |
| `POST /api/patients/{id}/medication-plans` | 所属医护 | `{device_model_id,drug_label,plan_type,timezone,starts_at,ends_at?,daily_times?}` | `201 → MedicationPlan`；新逻辑计划由后端生成 `plan_group_id`、`version=1` |
| `POST /api/medication-plans/{id}/revisions` | 所属医护 | `{starts_at,ends_at?,drug_label?,device_model_id?,daily_times?,plan_type?}` | `201 → MedicationPlan` 新版本；同事务关闭旧版生效期、变更审计；历史登记不改写 |
| `GET /api/me/medication-plans` | Patient | `include_history?` | `200 → Page<MedicationPlan>`；只读当前本人计划，默认只返回当前有效版本 |
| `GET /api/me/daily-slots` | Patient | `date=YYYY-MM-DD` 或 `from,to`（可查历史补登时点） | `200 → {items:PlannedSlot[],timezone}`；生成时点由同一服务确保幂等，PRN 不产生 slot |

- `REGULAR` 至少配置一个 `daily_times`（格式 `HH:MM`）；`PRN` 不允许配置计划时点。时间有效区间 `[starts_at,ends_at)`，同一 `plan_group_id` 版本不能重叠，不同逻辑计划可以并存。
- 版本修订生效时间只能是当前或未来（TECH_DESIGN V1.0 的安全简化决定）；旧版未发生的未来时点取消，不影响历史有效登记。
- `GET /api/me/daily-slots` 历史/未来查询需限制日期跨度（技术默认最多 31 天），防止一次查询生成无限时点。`has_active_record` 由有效关联记录实时推导。

### 2.6 MED：用药登记、查询与撤销

| 方法与路径 | 权限 | 请求参数 / JSON | 成功响应与关键校验 |
|---|---|---|---|
| `POST /api/medication-events` | 本人/所属医护 | `{patient_id?,plan_id,slot_id?,occurred_at,source?,note?}` | `201 → {event:MedicationEvent,is_duplicate:boolean}`；服务端赋 recorded_at/source，保存审计；REGULAR 必填对应 slot、PRN 必须 null |
| `GET /api/me/medication-events` | Patient | `from?,to?,page,page_size` | `200 → Page<MedicationEvent>`，本人记录时间线与撤销状态 |
| `GET /api/patients/{id}/medication-events` | 所属医护 | `from?,to?,status?,page,page_size` | `200 → Page<MedicationEvent>`；只查负责患者 |
| `POST /api/medication-events/{id}/revoke` | 记录所属患者/所属医护 | `{reason}` | `200 → MedicationEvent`，`status=REVOKED`，保存撤销人、时间、原因与审计；再次撤销返回 409 |

**网络超时 ≠ 提交失败**：Android 上若 POST 超时，不得提示“已登记”；恢复网络先 `GET` 对应时点的记录，再决定是否重试。**重复人工登记可以保留**，但 `is_duplicate=true`，覆盖率对同一 `slot_id` 至多加 1。`occurred_at` 是用户申报时间，客户端不得提供 `recorded_at`、`revoked_by` 或强行指定 `DEVICE`。

示例（PRD 原有字段保持兼容）：

```http
POST /api/medication-events
Authorization: Bearer <token>
Content-Type: application/json

{"plan_id":"8a370c44-86a1-48c7-8b19-e189a68e3d80","slot_id":"0d9447a2-2cd0-4993-bccc-b4179732f89a","occurred_at":"2026-10-13T08:05:00+08:00","source":"PATIENT_REPORT","note":"已按计划登记"}
```

```json
{
  "event": {
    "id": "e07183b9-ad0c-486a-bc40-7040d3ed3641",
    "patient_id": "c5a98969-e8c9-4d44-a734-d62131b8752b",
    "plan_id": "8a370c44-86a1-48c7-8b19-e189a68e3d80",
    "slot_id": "0d9447a2-2cd0-4993-bccc-b4179732f89a",
    "source": "PATIENT_REPORT",
    "occurred_at": "2026-10-13T00:05:00Z",
    "recorded_at": "2026-10-13T00:06:12Z",
    "status": "ACTIVE",
    "note": "已按计划登记"
  },
  "is_duplicate": false
}
```

### 2.7 REM/STAT/TASK/FUP：提醒、统计、任务、随访

| 方法与路径 | 权限 | 请求参数 / JSON | 成功响应与关键校验 |
|---|---|---|---|
| `GET /api/me/reminders` | Patient | `date?` | `200 → {items:PatientReminder[]}`；合并计划派生提醒和持久复训/随访提醒，不泄露内部 task |
| `GET /api/me/stats` | Patient | `from,to` | `200 → StatsResponse`；仅本人 |
| `GET /api/patients/{id}/stats` | 所属医护 | `from,to` | `200 → StatsResponse`；含缺失 slot 和来源分布 |
| `GET /api/tasks` | Clinician | `status?,patient_id?,page,page_size` | `200 → Page<Task>`；仅已物化任务，无 GET 写入副作用 |
| `PATCH /api/tasks/{id}` | 所属医护 | `{status:"IN_PROGRESS"}` | `200 → Task`；关闭任务优先经随访流程，已 CLOSED 不能重开 |
| `POST /api/followups` | 所属医护 | `{patient_id,task_id?,followed_at,feedback?,action_taken?,next_plan?,close_task?,create_retraining_reminder?}` | `201 → {followup:Followup,task?:Task,reminder?:PatientReminder}`；保存、关闭任务、创建提醒和审计同事务 |
| `GET /api/patients/{id}/followups` | 所属医护 | `from?,to?,page,page_size` | `200 → Page<Followup>`；供 M04 报告与 M05 历史 |

统计响应示例（7 天每天 2 次、已关联 10 个时点，假设均已到期）：

```json
{
  "from": "2026-10-01",
  "to": "2026-10-08",
  "timezone": "Asia/Shanghai",
  "N": 14,
  "M": 10,
  "coverage_rate": 71.4,
  "missing_slots": [
    {"slot_id":"14af0ce9-289d-479a-811e-1ec1394f18b1","scheduled_at":"2026-10-04T00:00:00Z"},
    {"slot_id":"cd10a287-1b26-43b6-b189-029054607e3e","scheduled_at":"2026-10-04T12:00:00Z"},
    {"slot_id":"08c450ab-43e1-420f-b4b5-91e18c8d6324","scheduled_at":"2026-10-05T00:00:00Z"},
    {"slot_id":"65cc14fd-af88-4237-af0e-b9da14d318f0","scheduled_at":"2026-10-05T12:00:00Z"}
  ],
  "source_breakdown": {"PATIENT_REPORT": 10, "CLINICIAN_OBSERVED": 0},
  "source_breakdown_basis": "ACTIVE_EVENT_COUNTS",
  "disclaimer": "基于登记记录的覆盖率，不等于实际服药依从性"
}
```

- `N` 仅为已到期有效 REGULAR slots 数；`M` 是其中具有至少一条 ACTIVE 登记的不同 slot 数。示例 `missing_slots` 与 `N=14、M=10` 一致，列出了 4 个缺失时点。真实响应须返回区间内全部缺失时点，或按明确分页规则返回并标明总数。
- `N=0` 时 `coverage_rate=null`、展示“暂无固定计划”，不能返回 0%。`source_breakdown` 采用 **ACTIVE 有效登记事件数**，可能多于 `M`，不得称其为去重时点数。
- 任务触发由服务端定时扫描/内部命令执行（见 TECH_DESIGN §4.4），而不是 GET /api/tasks 时写库。历史触发键保留，防止关闭后同一批缺失重建。
- `PATCH /api/tasks/{id}` 本版仅允许转 `IN_PROGRESS`；`CLOSED` 通过随访事务完成，保持“关闭核查任务有实际处理记录”的闭环。
- P01 用药时点提醒可动态派生；复训/待参与随访持久在 `patient_reminders`，本版不提供患者直接编辑医嘱或后台推送 API。

### 2.8 AI/KB：型号限定问答与知识发布

| 方法与路径 | 权限 | 请求参数 / JSON | 成功响应与关键校验 |
|---|---|---|---|
| `POST /api/ai/ask` | Patient/Clinician | `{device_model_id,question}` | `200 → AIResponse`；只基于当前型号与已发布版本知识；Patient 型号需为本人当前绑定之一 |
| `GET /api/admin/knowledge-documents` | Admin/授权医护 | `device_model_id?,review_status?,page,page_size` | `200 → Page<KnowledgeDocument>` |
| `POST /api/admin/knowledge-documents` | Admin/授权医护 | `{device_model_id,guide_id?,title,version,source_url?,text}` | `201 → KnowledgeDocument`（DRAFT）；文本按段落切成 knowledge_chunks |
| `GET /api/admin/knowledge-documents/{id}` | Admin/授权医护 | 无 | `200 → KnowledgeDocument + source_text/chunks`，后台草稿可见 |
| `PATCH /api/admin/knowledge-documents/{id}` | Admin/授权医护 | `{title?,source_url?,text?,review_action?}` | `200 → KnowledgeDocument`；仅草稿可改；`review_action="APPROVE"` 仅医学授权人员可操作，服务端写审核人和时间 |
| `POST /api/admin/knowledge-documents/{id}/publish` | 具发布权限者 | 无正文 | `200 → {id,review_status:"PUBLISHED",published_at}`；仅医学审核完成后可发布，旧版内容不覆盖 |

AI 正常响应示例：

```json
{
  "status": "ANSWERED",
  "answer": "根据该型号已发布指导，第 1 步为……",
  "citations": [
    {"document_title":"已审核装置指导","version":"1.0","step_ref":"步骤 1"}
  ],
  "device_model_id": "51aa61c6-44e2-4a19-8636-09df07c4c7f1"
}
```

- `status` 为 `ANSWERED/NO_EVIDENCE/OUT_OF_SCOPE/ERROR`。无法找到同型号已发布证据时返回 `NO_EVIDENCE`；诊疗/剂量调整/急症问题返回 `OUT_OF_SCOPE` 和安全引导，不生成医疗决定。
- 当 LLM 外部服务不可用，后端可使用 `503`，错误体 `code=LLM_UNAVAILABLE` 并在 `details.ai_status="ERROR"` 明确局部 AI 故障；客户端不得将它当作患者操作记录服务不可用。
- citations 由后端基于真实命中片段组装/校验，不能让模型虚构文档名或跨型号引用；第三方模型上下文不带姓名、诊断、医嘱、用药日志。
- 知识草稿可录入经授权的纯文本；本版不新增外部文件解析/上传接口，图片与 PDF 内容先经人工复核后录入可引用文本。后续需要上传文件再专门立项。

### 2.9 审计与硬件预留

| 方法与路径 | 权限 | 请求参数 / JSON | 成功响应与关键校验 |
|---|---|---|---|
| `GET /api/admin/audit-logs` | Admin | `actor_id?,resource_type?,from?,to?,page,page_size` | `200 → Page<AuditLog>`；无密码、Token 或敏感 AI 原文 |
| `POST /api/device-events` | P2 / 禁用 | 任意 | 固定 `501 Not Implemented`，V1.0 不提供设备接入 UI、不生成 DEVICE 事件 |
| `GET /api/health` | 技术探活，无身份资料 | 无 | `200 → {"status":"ok"}`；D1–D2 Android 真机联网冒烟测试用，不泄露数据库/患者信息 |

## 3. 端到端协同与验收重点

| PRD 用例 | 接口验收重点 |
|---|---|
| T01–T02, T15 | 登录/改密/退出撤销；跨患者/跨医护服务端隔离；前端不作为权限来源 |
| T03–T05 | 已发布型号指导；训练来源区分；App P03 可读历史自检 |
| T06–T09, T16 | 固定/PRN 分离、计划历史版本、重复时点计数一次、撤销留痕与重算 |
| T10–T11 | 医护任务幂等、关闭不重复触发、随访/任务/患者提醒原子提交 |
| T12–T14 | RAG 型号过滤、引用真实、医疗问题拒答、LLM 不可用不影响核心业务 |
| C01–C05 | 医护 Web + Android APK 同 API；真机 HTTP(S) 配置、会话失效、断网不假成功、`/api/health` 联通 |

**前后端并行落地流程**：

1. 后端优先用 Pydantic 实现本文件的 `Schema`，FastAPI 自动生成 `/openapi.json`；不要让 Web 和 App 分别猜返回字段。
2. 双客户端共享 TypeScript 类型（可从 OpenAPI 生成）及错误处理约定，但 UI 独立。角色/患者归属校验始终由后端执行。
3. 每完成一个模块，至少进行一次成功、字段错误、401、跨权限 403/404、业务冲突 409（如适用）测试；打通纵向链路后再进入下一模块。
4. 实际开发中若发现本文件与 PRD/TECH_DESIGN/DATABASE_DESIGN 有冲突：**暂停该接口的实现决策、记录冲突点并优先遵守 PRD 用户行为与验收**；变更接口 Schema 应同步 Web、App 和 OpenAPI，不可只更新单端。

## 4. 文档对照与待落地的实现决定

**跨文档待同步点（不增加新功能）**：PRD §4.1 的 `PAT-01` 明确要求患者档案可保存“备注”，本文件在 `PatientDetail`/建档修改请求中将其定义为 `note?`；当前精简版 `DATABASE_DESIGN.md` 的 `patients` 行未列出该字段。实际执行首轮 Alembic 迁移前，应把 `patients.note TEXT NULL` 补充到数据库设计和 ORM，避免接口保存备注后无字段落库。

下列是本文件为了“能开发”作出的建议性约定，**不是 PRD 新增功能**；写入 Pydantic 后应以 OpenAPI 为机器可读事实源，差异须记录：

- 具体字段长度、默认每页 20/上限 100、最多 31 天 slot 窗口、训练 `check_state` 枚举，以及草稿审核状态的内部转换细节。
- 创建账号时初始凭据如何安全一次性交付、用户停用时的会话撤销范围、不同操作的错误码细粒度映射。
- 已审核资料发布时的 reviewer 权限授予机制；不能以 Admin 或填入一个名字代替真实医学审核。
- 是否对登录与 AI 接口添加简单频率限制；应控制演示环境账户猜测与 API 成本，不引入新的基础设施。

**禁止跨版本扩大范围**：不增加 iOS、推送、离线同步、真实设备接入、诊疗建议、复杂向量平台或独立 AI 服务；不要求 CSV/PDF 美化导出（P1）。
