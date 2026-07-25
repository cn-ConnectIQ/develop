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
| VALIDATION | 400 | 参数错误 |
| UNAUTHORIZED | 401 | API Key 无效 |
| NOT_CONFIGURED | 503 | 未配置 Key |

## 接口

### GET `/connection?baigeOrgId=`

连接状态（J2 pill / J4）。未绑定：`{ linked: false }`。

已绑定字段：`status`、`partnerHost`（`9li.co`）、`jiuliOrgId`、`jiuliOrgName`、`authorizedAt`、`scopes`、`baigeOrgId`。

### POST `/connection/authorize`

Body：`baigeOrgId`、可选 `baigeUserId` / `scopes` / `redirectUri` / `jiuliOrgId`。

- 传 `jiuliOrgId` 或已绑定 → 直接 `{ linked: true, ... }`
- 否则 → `{ authorizeUrl, state }`（打开玖莅 `/integrations/baige?partner_state=`；管理员登录后自动调用 confirm）

默认 scopes：`org.profile` | `event.basic` | `attendee.read` | `collection_point.read`

### POST `/connection/confirm`（玖莅登录态）

Body：`{ "state" }`。管理员确认 App 发起的 pending 授权，写入 `PartnerConnection`。若有 `bagevent://` redirectUri 则前端跳回 App。

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
