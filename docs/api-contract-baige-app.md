# 百格 App「玖莅 Tab」Partner API

面向百格服务端（BFF）的聚合接口；App 不直连。鉴权：`Authorization: Bearer <BAIGE_PARTNER_API_KEY>`。

成功响应与仓库其他 API 一致：`{ "data": ... }`。错误：`{ "error": "...", "code": "NOT_LINKED" }`（稳定 `code` 字符串）。

路径前缀：`/api/partner/baige/app`

## 错误码

| code | HTTP | 含义 |
|------|------|------|
| NOT_LINKED | 404 | 未绑定 |
| EXTERNAL_ORG_TAKEN | 409 | 百格组织已绑其他玖莅账号 |
| EVENT_NOT_AUTHORIZED | 404 | 活动未开通互动 |
| FORBIDDEN | 403 | 无权限 |
| MODULE_BUSY | 409 | 模块进行中不可关 |
| QR_EXPIRED | 409 | 扫码会话过期 |
| VALIDATION | 400 | 参数错误 |
| UNAUTHORIZED | 401 | API Key 无效 |
| NOT_CONFIGURED | 503 | 未配置 Key |

## 登录打通（邮箱 / 手机 / App 扫码）

授权时请带上百格用户的 `email` 和/或 `phone`（及可选 `name`、`baigeUserId`）。玖莅会：

1. 按邮箱/手机查找或创建 User  
2. 写入 `UserIdentity(provider=baige)`  
3. 授予该组织 `OrgStaff.ADMIN` + `userType=ACCOUNT_ADMIN`  

之后可用：

- 玖莅登录页 **同一手机号验证码** / **同一邮箱验证码**  
- 或 **百格 App 扫码**（见下）

### POST `/connection/authorize`（补充字段）

Body 增加可选：`email`、`phone`、`name`（与 `baigeUserId`）。绑定成功时会身份打通。

### POST `/auth/login-ticket`

Body：`{ baigeOrgId, email?, phone?, baigeUserId?, name? }`（至少一种身份）

响应：`{ loginToken, expiresIn, jiuliOrgId, signInHint: { provider: "baige-sso", loginToken } }`

浏览器：`signIn("baige-sso", { loginToken, redirect: false })`。

### 扫码登录

| 端 | 接口 |
|----|------|
| 浏览器 | `POST /api/auth/qr-login` → `sessionId` + `qrPayload`（`bagevent://jiuli/qr-login?sessionId=`） |
| 浏览器 | `GET /api/auth/qr-login/{sessionId}` 轮询 → `confirmed` + `loginToken` |
| 百格 App | `POST /api/partner/baige/app/auth/qr-login/confirm` Body：`{ sessionId, baigeOrgId, email?, phone?, baigeUserId?, name? }` |

App 识别 `bagevent://jiuli/qr-login` deep link 后调 confirm；PC 轮询到 confirmed 后 `signIn("baige-sso")`。

## 接口

### GET `/connection?baigeOrgId=`

连接状态（J2 pill / J4）。未绑定：`{ linked: false }`。

已绑定字段：`status`、`partnerHost`（`9li.co`）、`jiuliOrgId`、`jiuliOrgName`、`authorizedAt`、`scopes`、`baigeOrgId`。

### POST `/connection/authorize`

Body：`baigeOrgId`、可选 `baigeUserId` / `email` / `phone` / `name` / `orgName` / `scopes` / `redirectUri` / `jiuliOrgId`。

- **首次自动开户**（返回 `{ linked: true, linkedUserId, orgCreated }`）**仅当**：
  - `email` + `baigeUserId`，或
  - `phone` + `baigeUserId`  
  组织名默认取邮箱 `@` 前或手机号。**不可以**仅有 `baigeUserId` 就自动开户。
- 传 `jiuliOrgId` 或已绑定 → 绑定到已有组织（跳过确认页）
- **缺 email 且缺 phone**（即使有 baigeUserId）→ `{ authorizeUrl, state }`（需玖莅管理员确认页）
- `phone` 支持 `+86` / `0086` / 空格横线，服务端会归一化为 `1[3-9]\\d{9}`；非法邮箱会被忽略（不整单 400），若仍有合法 phone+baigeUserId 可自动开户，否则走 authorizeUrl

默认 scopes：`org.profile` | `event.basic` | `attendee.read` | `collection_point.read`

### POST `/connection/confirm`（玖莅登录态）

Body：`{ "state" }`。管理员确认 App 发起的 pending 授权，写入 `PartnerConnection`，并对 pending 中的 email/phone 打通身份。若有 `bagevent://` redirectUri 则前端跳回 App。

### DELETE `/connection`

Body：`{ "baigeOrgId": "..." }` → 解除绑定。

### GET `/events/overview?baigeOrgId=`

J2 总览。可选 `knownBaigeEventIds=1001,1002`（百格侧活动全集），用于计算 `unconfiguredCount`；不传则 `unconfiguredCount=0`（由百格 BFF 自行用本地活动列表减去 `enabledEvents`）。

`enabledEvents[]`：`baigeEventId`、`jiuliEventId`、`title`、`phase`（`ongoing|registering|ended`）、`whenWhere`、`features[]`、`stats`。

`features` 枚举：`lottery` | `vote` | `ai_match` | `checkin_wall` | `qa` | `danmaku`

### POST `/api/partner/baige/events/authorize`（已有）

开通活动互动后会出现在 overview 的 `enabledEvents`。

### GET `/events/{baigeEventId}/interaction?baigeOrgId=`

J3 详情：`modules[]`（id/title/subtitle/enabled/badge/manageUrl）、`stats`、`reportUrl`。

### GET `/events/{baigeEventId}/interaction/stats?baigeOrgId=`

轻量轮询：stats + 模块摘要。

### PATCH `/events/{baigeEventId}/modules/{moduleId}`

Body：`{ "enabled": true, "baigeOrgId": "..." }`

| moduleId | 落库 |
|----------|------|
| lottery | `Event.featureFlags.lottery` |
| ai_match | `Event.featureFlags.aiReferral` |
| vote / qa / checkin_wall / danmaku | `EventSetting` key=`baige_app_modules` |

关闭进行中的抽奖（OPEN/DRAWING）或 LIVE 投票/问答 → `MODULE_BUSY`。

## 联调备注

- 本地未配 Key 且 `NODE_ENV !== production` 时，伙伴鉴权走 dev 放行（见 `isBaigePartnerDevMode`）。
- `unconfiguredCount` 推荐由百格传入 `knownBaigeEventIds`，或 BFF 侧计算。
- 正式授权以「百格组织 ↔ 玖莅组织」`PartnerConnection` 为准；App 不持有玖莅用户密码。
