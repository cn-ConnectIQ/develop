# ConnectIQ 小程序 API 契约

> **唯一真相源（Single Source of Truth）** — 前后端联调以本文档为准。  
> 基址：`{NEXT_PUBLIC_APP_URL}/api`（生产示例：`https://marketingprofs.ai/api`）

---

## 通用约定

### 响应格式

**成功**

```json
{ "data": { ... } }
```

部分列表接口额外返回 `meta`（分页）：

```json
{ "data": [ ... ], "meta": { "total": 100, "page": 1, "cursor": null } }
```

**失败**

```json
{ "error": "人类可读说明", "code": "ERROR_CODE" }
```

HTTP 状态码与 `code` 对应：401 / 403 / 404 / 400 / 429 / 500 / 503。

### 鉴权

| 类型 | Header | 说明 |
|------|--------|------|
| **mobile token** | `Authorization: Bearer mini_{userId}_{uuid}` | `wx-login` 返回，后续请求必带 |
| **dev mock** | `Authorization: Bearer dev-mock-token` | 仅开发环境，映射 demo 用户 |
| **requireAccountAdmin** | mobile token + 用户为 `ACCOUNT_ADMIN` 且组织已审核 | 账号管理中心 AD1 |
| **requireExhibitorAdmin** | Session 或展商身份 | 展商管理 EM 屏（当前为 Web Session，小程序展商模式待统一） |
| **无** | 不传 Authorization | 公开接口 |

> 标注为 **mobile token** 的接口走 `resolveMobileUserId`（支持 session 或 `mini_*`）。  
> 标注为 **mobile token†** 的接口仍仅支持 session + `dev-mock-token`（如有残留）。其余移动端接口已统一支持 `mini_*`。

### 通用错误码

| code | 含义 |
|------|------|
| `UNAUTHORIZED` | 未登录 / token 无效 |
| `FORBIDDEN` | 无权限 |
| `NOT_FOUND` | 资源不存在 |
| `VALIDATION_ERROR` | 参数校验失败 |
| `INTERNAL_ERROR` | 服务器内部错误 |
| `WECHAT_CODE_INVALID` | 微信 code 无效或过期 |
| `WECHAT_CODE_USED` | 微信 code 已被使用 |
| `WECHAT_AUTH_FAILED` | 微信登录失败（含频控） |
| `WECHAT_NOT_CONFIGURED` | 服务端未配置小程序 AppID/Secret |

### 活动类型 `activityType`

`CONFERENCE`（会议 A）| `EXPO`（展会 O）| `EXHIBITION`（参展 P）

---

## 认证

### POST /api/auth/wx-login

用途：**登录页 / 冷启动** — 微信 `wx.login` code 换 token + 稳定 user.id

鉴权：无

请求：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | `wx.login` 返回的 code |
| `eventId` | string | 否 | 传入则自动关联 Participant |

响应 `data`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `token` | string | `mini_{userId}_{uuid}` |
| `user.id` | string | **稳定用户 ID**，全站鉴权主键 |
| `user.name` | string | |
| `user.avatar` | string \| null | |
| `user.company` | string \| null | |
| `user.title` | string \| null | |
| `user.userType` | `"END_USER"` \| `"ACCOUNT_ADMIN"` \| `"PLATFORM_ADMIN"` | |
| `user.hasProfile` | boolean | 是否已填资料/意向 |
| `user.hasWechatQr` | boolean | 是否已上传微信二维码 |

错误码：`VALIDATION_ERROR` | `WECHAT_CODE_INVALID` | `WECHAT_CODE_USED` | `WECHAT_NOT_CONFIGURED` | `WECHAT_AUTH_FAILED`

---

### POST /api/auth/wx-login-phone

用途：**登录页** — 微信登录 + 手机号授权（绑定 phone）

鉴权：无

请求：

| 字段 | 类型 | 必填 |
|------|------|------|
| `wxCode` | string | 是 |
| `phoneCode` | string | 是 | 微信手机号组件 code |
| `eventId` | string | 否 |

响应：同 `wx-login`

鉴权：mobile token

---

### POST /api/events/verify-code

用途：**Z1 活动码校验**

鉴权：无

请求：

| 字段 | 类型 | 必填 |
|------|------|------|
| `code` | string | 是 |

响应 `data`：`{ event: Event }`（与小程序 `Event` 类型一致）

---

### GET /api/events/by-code/{code}

用途：**Z1 活动码查询（GET fallback）**

鉴权：无

响应 `data`：Event 对象

> 活动码来源：`EventSetting.key = join_code`，或演示别名 `DEMO2026` / `DEMO` / `CIQ2026` / `888888`。

---

## 活动主页

### GET /api/events/discover

用途：**N 发现活动 / 空态**

鉴权：mobile token

请求：无 body

响应 `data`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `recent` | array | 最近参加的活动 |
| `recent[].id` | string | |
| `recent[].name` | string | |
| `recent[].logo` | string \| null | 组织 logo |
| `recent[].status` | `"DRAFT"` \| `"PUBLISHED"` \| `"LIVE"` \| `"ENDED"` | |
| `recent[].activityType` | string | |
| `nearby` | array | 附近/推荐（未加入的已发布活动） |
| `nearby[].id` | string | |
| `nearby[].name` | string | |
| `nearby[].date` | string \| null | 如 `2026-06-13` 或区间 |
| `nearby[].location` | string \| null | |
| `nearby[].canRegister` | boolean | |

---

### GET /api/events/{eventId}/home

用途：**A/O/P 活动主页**（与 `dashboard-mobile` 等价）

鉴权：mobile token

响应 `data`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `event.id` | string | |
| `event.name` | string | |
| `event.activityType` | string | 决定主页模板 A/O/P |
| `event.status` | `"DRAFT"` \| `"PUBLISHED"` \| `"LIVE"` \| `"ENDED"` | |
| `event.dayLabel` | string | 如 `Day 2`、`3 天后开始` |
| `aiRecommendations` | array | AI 推荐参会者 |
| `aiRecommendations[].userId` | string | |
| `aiRecommendations[].name` | string | |
| `aiRecommendations[].avatar` | string \| null | |
| `aiRecommendations[].company` | string \| null | |
| `aiRecommendations[].title` | string \| null | |
| `aiRecommendations[].matchReason` | string | |
| `liveInteraction` | object \| null | 进行中互动 |
| `liveInteraction.id` | string | |
| `liveInteraction.type` | string | Poll 类型或 `LOTTERY` |
| `liveInteraction.title` | string | |
| `liveInteraction.isLive` | boolean | |
| `announcements` | array | 公告 |
| `announcements[].id` | string | |
| `announcements[].content` | string | |
| `announcements[].time` | string | ISO8601 |
| `stampRally` | object \| null | 集章进度（feature 关闭时为 null） |
| `stampRally.current` | number | |
| `stampRally.total` | number | |
| `stampRally.prize` | string | |
| `org.name` | string | |
| `org.isVerified` | boolean | |

错误码：`NOT_FOUND`（活动不存在）

---

### GET /api/events/{eventId}/dashboard-mobile

用途：同 **home**（别名）

鉴权 / 响应：与 `home` 完全相同

---

### GET /api/events/{eventId}/premeet-status

用途：**MT6 会前预热主页**

鉴权：mobile token

响应 `data`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `startsInDays` | number | 距活动开始天数，已开始为 0 |
| `premeetEnabled` | boolean | 会前预热是否开放 |
| `confirmedHighMatchCount` | number | 高匹配且已确认人数 |
| `recommendations` | array | |
| `recommendations[].userId` | string | |
| `recommendations[].name` | string | |
| `recommendations[].avatar` | string \| null | |
| `recommendations[].company` | string \| null | |
| `recommendations[].title` | string \| null | |
| `recommendations[].matchScore` | number | |
| `recommendations[].matchReason` | string | |

---

### GET /api/events/{eventId}/feature-flags

用途：**各屏能力开关**（集章/抽奖/AI 路线等）

鉴权：mobile token

响应 `data`：

| 字段 | 类型 |
|------|------|
| `event_id` | string |
| `feature_flags.speedNetworking` | boolean |
| `feature_flags.lottery` | boolean |
| `feature_flags.aiBoothRoute` | boolean |
| `feature_flags.aiReferral` | boolean |
| `feature_flags.highValueBuyerPush` | boolean |
| `feature_flags.stampRally` | boolean |
| `feature_flags.boothRanking` | boolean |
| `feature_flags.eventSummary` | boolean |
| `feature_flags.inviteSystem` | boolean |

---

### GET /api/events/{eventId}/my-intent

用途：**MT7 意向采集**

鉴权：mobile token

响应 `data`：

| 字段 | 类型 |
|------|------|
| `id` | string \| null |
| `event_id` | string |
| `user_id` | string |
| `role` | string \| null |
| `supply_tags` | string[] |
| `demand_tags` | string[] |
| `topics` | string[] |
| `submitted` | boolean |
| `updated_at` | string \| null |

---

### PATCH /api/events/{eventId}/my-intent

用途：**MT7 提交/更新意向**

鉴权：mobile token

请求（至少一项）：

| 字段 | 类型 |
|------|------|
| `role` | string \| null |
| `supply_tags` | string[] |
| `demand_tags` | string[] |
| `topics` | string[] |

响应：同 GET

错误码：`VALIDATION_ERROR`（空 body 或首次提交全空）

---

### GET /api/events/{eventId}/live-stats

用途：**AD2/AD3/AD4 实时概览**（Realtime 降级轮询，建议 15s）

鉴权：requireAccountAdmin（管理者 session 或 mobile token + ACCOUNT_ADMIN）

响应 `data`：

| 字段 | 类型 |
|------|------|
| `checkinRate` | number | 0–100，一位小数 |
| `onsite` | number | 已签到人数 |
| `connections` | number | 活跃连接数 |
| `interactions` | number | 今日互动参与次数 |
| `boothHeat` | array | Top 展位 |
| `boothHeat[].boothId` | string |
| `boothHeat[].boothNumber` | string |
| `boothHeat[].companyName` | string |
| `boothHeat[].todayVisitors` | number |
| `boothHeat[].change` | number | 近 30 分钟增量 |
| `boothHeat[].rank` | number |
| `realtime.enabled` | boolean |
| `realtime.tables` | string[] |
| `realtime.pollIntervalMs` | number | 15000 |

---

## 连接

### GET /api/me/contact-card

用途：**我的名片 / 设置页**

鉴权：mobile token

响应 `data`：

| 字段 | 类型 |
|------|------|
| `wechat_qr_url` | string \| null |
| `wechat_id` | string \| null |
| `show_phone` | boolean |
| `show_email` | boolean |
| `email` | string \| null |
| `allow_exchange` | boolean |
| `auto_accept_at_event` | boolean |
| `headline` | string \| null |
| `card_theme` | string |

---

### PATCH /api/me/contact-card

用途：**更新我的名片**

鉴权：mobile token

请求：同 GET 字段（均可选）

响应：同 GET

---

### GET /api/users/{userId}/connect-card

用途：**T/U 查看对方连接卡**（含 AI 简报、匹配分）

鉴权：mobile token

Query：`eventId`（可选）

响应 `data`：

| 字段 | 类型 |
|------|------|
| `user.id` | string |
| `user.name` | string |
| `user.avatar_url` | string \| undefined |
| `user.company` | string \| undefined |
| `user.title` | string \| undefined |
| `user.headline` | string \| undefined |
| `aiBrief` | string |
| `aiMatchScore` | number \| null |
| `matchReason` | string \| null |
| `sharedIntents` | `{ label, description }[]` |
| `connectionStatus` | `"NONE"` \| `"PENDING"` \| `"ACTIVE"` |
| `canExchange` | boolean |
| `hasWechatQr` | boolean |
| `autoAcceptAtEvent` | boolean |
| `peerWechatQrUrl` | string \| undefined | 已交换后可见 |
| `peerPhone` | string \| undefined |
| `peerEmail` | string \| undefined |
| `peerWechatId` | string \| undefined |

---

### POST /api/connections/exchange-request

用途：**T 发起异步交换微信请求**

鉴权：mobile token

请求：

| 字段 | 类型 | 必填 |
|------|------|------|
| `target_user_id` | string | 是 |
| `event_id` | string | 否 |
| `booth_id` | string | 否 |
| `message` | string | 否 |
| `from_ai_match` | boolean | 否 |
| `ai_match_score` | number | 否 |

响应 `data`：

| 字段 | 类型 |
|------|------|
| `status` | `"PENDING"` |
| `request_id` | string |
| `requestId` | string | 同 request_id |

---

### POST /api/connections/exchange-request/{requestId}/accept

用途：**U 同意交换**

鉴权：mobile token

响应 `data`：ExchangeResult（见下）

---

### POST /api/connections/exchange-request/{requestId}/decline

用途：**U 拒绝交换**

鉴权：mobile token

响应 `data`：`{ status: "DECLINED" }`

---

### POST /api/connections/exchange

用途：**U 面对面即时交换**（扫码/碰一碰）

鉴权：mobile token

请求：

| 字段 | 类型 | 必填 |
|------|------|------|
| `target_user_id` | string | 是 |
| `event_id` | string | 否 |
| `booth_id` | string | 否 |
| `method` | `"FACE_TO_FACE"` \| `"DEFERRED"` \| ... | 否 |
| `from_ai_match` | boolean | 否 |
| `ai_match_score` | number | 否 |

响应 `data`（ExchangeResult）：

| 字段 | 类型 |
|------|------|
| `status` | `"COMPLETED"` \| `"PENDING"` |
| `connection_id` | string |
| `connectionId` | string |
| `peer` | `{ id, name, company?, title?, wechat_qr_url?, ... }` |
| `myCard` | ExchangeCardInfo |
| `theirCard` | ExchangeCardInfo |
| `my_wechat_qr_url` | string \| undefined |

---

### GET /api/me/exchange-requests

用途：**交换请求列表**

鉴权：mobile token

Query：

| 参数 | 说明 |
|------|------|
| `direction` | `received`（默认）\| `sent` |
| `status` | `PENDING` \| `ACCEPTED` \| `DECLINED` \| `EXPIRED` |

响应 `data`：`{ items: ApiExchangeRequestItem[] }`

`items[]` 主要字段：`id`, `status`, `message`, `from_ai_match`, `direction`, `created_at`, `responded_at`, `from_user`, `to_user`, `event?`

---

### GET /api/me/exchange-requests/{requestId}

用途：**交换请求详情**（含 AI 简报）

鉴权：mobile token

响应 `data`：ApiExchangeRequestDetail（含 `ai_brief`, `ai_match_score`, `match_reason`, `exchange_result?`）

---

### GET /api/events/{eventId}/my-connections

用途：**活动内我的连接列表**

鉴权：mobile token

响应 `data`：

| 字段 | 类型 |
|------|------|
| `count` | number |
| `wechat_count` | number |
| `items` | array |
| `items[].connection_id` | string |
| `items[].peer` | `{ id, name, avatar_url?, company?, title? }` |
| `items[].connected_at` | string ISO8601 |
| `items[].location` | string \| undefined |
| `items[].wechat_exchanged` | boolean |
| `items[].exchange_pending` | boolean |
| `items[].peer_wechat_qr_url` | string \| undefined |
| `items[].peer_phone` | string \| undefined |
| `items[].peer_email` | string \| undefined |
| `items[].peer_wechat_id` | string \| undefined |

---

### GET /api/connections

用途：**全局连接列表**

鉴权：mobile token

Query：`limit`（默认 30）

响应 `data`：`{ connections: [...] }`

---

## 展位

### GET /api/events/{eventId}/booths/public

用途：**E 找展位列表**

鉴权：mobile token

响应 `data`：数组

| 字段 | 类型 |
|------|------|
| `id` | string |
| `name` | string |
| `code` | string |
| `company` | string |
| `hallLabel` | string \| null |
| `status` | string |
| `logo` | string \| null |

---

### GET /api/booths/{boothId}

用途：**W 展位详情**

鉴权：mobile token

响应 `data`：

| 字段 | 类型 |
|------|------|
| `id` | string |
| `name` | string |
| `code` | string |
| `company` | string |
| `hallLabel` | string \| null |
| `status` | string |
| `description` | string \| null |
| `eventId` | string |
| `eventName` | string |
| `org.name` | string |
| `org.logoUrl` | string \| null |

---

### POST /api/events/{eventId}/checkin

用途：**扫展位码签到 / 到访**（body 含 booth_id）

鉴权：mobile token

请求：`{ booth_id: string }`

响应 `data`：`{ scanned: true, booth: { id, name, code } }`

---

### GET /api/events/{eventId}/stamp-rallies/{rallyId}/my-progress

用途：**集章进度**

鉴权：mobile token

响应 `data`：

| 字段 | 类型 |
|------|------|
| `stamps` | array |
| `stamps[].booth_id` | string |
| `stamps[].booth_number` | string |
| `stamps[].company_name` | string |
| `stamps[].stamped_at` | string ISO8601 |
| `count` | number |
| `total` | number |
| `completed` | boolean |
| `redeemed` | boolean |

---

### POST /api/events/{eventId}/stamp-rallies/{rallyId}/stamp

用途：**集章打卡**

鉴权：mobile token

请求：`{ booth_id: string }`

响应 `data`：

| 字段 | 类型 |
|------|------|
| `stamped` | boolean |
| `count` | number |
| `total` | number |
| `completed` | boolean |
| `already_stamped` | boolean \| undefined |

---

### POST /api/events/{eventId}/lotteries/{lotteryId}/enter

用途：**参与抽奖**

鉴权：mobile token（需 session 或 dev-mock；**mini_ token 待统一**）

响应 `data`：抽奖 entry 记录

错误码：`FORBIDDEN`（lottery feature 未开）

---

### GET /api/events/{eventId}/ai/booth-route

用途：**AI 智能逛展路线**

鉴权：mobile token

前置：`feature_flags.aiBoothRoute === true`

响应 `data`：

| 字段 | 类型 |
|------|------|
| `route` | array |
| `route[].order` | number |
| `route[].booth_id` | string |
| `route[].booth_number` | string |
| `route[].company_name` | string |
| `route[].hall` | string \| null |
| `route[].position_x` | number |
| `route[].position_y` | number |
| `route[].match_reason` | string |
| `route[].estimated_stay_minutes` | number |
| `total_booths` | number |
| `estimated_total_minutes` | number |
| `generated_at` | string ISO8601 |

---

## 互动

### GET /api/events/{eventId}/qna

用途：**X 现场问答列表**

鉴权：mobile token

响应 `data`：

| 字段 | 类型 |
|------|------|
| `pollId` | string \| null |
| `pollTitle` | string \| null |
| `items` | array |
| `items[].id` | string |
| `items[].text` | string |
| `items[].upvoteCount` | number |
| `items[].createdAt` | string ISO8601 |
| `items[].authorName` | string \| null |
| `items[].isMine` | boolean |

无开放问答时：`pollId: null, items: []`（不 404）

---

### POST /api/events/{eventId}/qna

用途：**X 提问**

鉴权：mobile token

请求：

| 字段 | 类型 | 说明 |
|------|------|------|
| `text` | string | 推荐 |
| `text_answer` | string | 兼容别名 |
| `question` | string | 兼容别名 |

响应 `data`：单条 question item（同 items[] 元素）

错误码：`VALIDATION_ERROR`（无开放 QnA）

---

### POST /api/events/{eventId}/qna/{id}/upvote

用途：**问答点赞**

鉴权：mobile token

响应 `data`：`{ id: string, upvoteCount: number }`

---

### POST /api/events/{eventId}/polls/{pollId}/respond

用途：**投票/评分/词云参与**

鉴权：mobile token

请求：

| 字段 | 类型 | 说明 |
|------|------|------|
| `option_id` | string | 单选 |
| `option_ids` | string[] | 多选 |
| `text_answer` | string | 词云 |
| `rating` | number 1–5 | 评分 |

响应 `data`：`{ response: ... }`

---

### GET /api/i/{sessionCode}

用途：**扫码互动落地页**

鉴权：无

响应 `data`：互动会话公开 payload（poll/lottery 列表等）

---

### POST /api/i/{sessionCode}/participate

用途：**扫码参与互动会话**

鉴权：无（body 可传 `user_id`）

请求：见 `participateSessionSchema`（含 `poll_response`）

---

## 通知

### GET /api/me/notifications

用途：**J 通知中心**

鉴权：mobile token

响应 `data`：数组

| 字段 | 类型 |
|------|------|
| `id` | string |
| `type` | string | 小写 routeTarget |
| `title` | string |
| `body` | string |
| `createdAt` | string ISO8601 |
| `isRead` | boolean |
| `routeTarget` | 见下表 |
| `routePayload` | `Record<string, string>` |

`routeTarget` 枚举：

`EXCHANGE_CONFIRM` | `EXCHANGE_SUCCESS` | `BOOTH_DETAIL` | `LOTTERY_RESULT` | `AI_REC` | `BROADCAST` | `MEETING_REQUEST`

空列表返回 `[]`

---

### POST /api/me/notifications/read-all

用途：**全部已读**

鉴权：mobile token

响应 `data`：`{ count: number }`

---

### POST /api/me/notifications/{id}/read

用途：**单条已读**

鉴权：mobile token

响应 `data`：`{ ok: true }`

错误码：`NOT_FOUND`

---

## 会面

### POST /api/meetings

用途：**MT3 预约会面**

鉴权：mobile token

请求：

| 字段 | 类型 | 必填 |
|------|------|------|
| `event_id` | string | 是 |
| `guest_user_id` | string | 是 | 对方 userId |
| `starts_at` | string | 是 | ISO8601 |
| `ends_at` | string | 是 | ISO8601 |

响应 `data`：

| 字段 | 类型 |
|------|------|
| `id` | string |
| `status` | MeetingStatus |
| `starts_at` | string \| undefined |
| `ends_at` | string \| undefined |

---

### GET /api/me/meetings

用途：**MT5 我的会面列表**

鉴权：mobile token

Query：`eventId`（可选）

响应 `data`：`{ meetings: MeetingListItem[] }`

---

### GET /api/meetings/{id}

用途：**MT3/MT4 会面详情**

鉴权：mobile token

---

### GET /api/events/{eventId}/meeting-time-slots

用途：**MT2 选时段**

鉴权：mobile token

Query：`with_user`（可选）

响应 `data`：`MeetingTimeSlot[]`

---

### PATCH /api/meetings/{id}

用途：**接受 / 拒绝会面**

鉴权：mobile token

请求：

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | `ACCEPTED` \| `DECLINED` |

响应 `data`：`{ id, status }`

---

### POST /api/meetings/{id}/cancel

用途：**取消会面**

鉴权：mobile token

请求：

| 字段 | 类型 | 必填 |
|------|------|------|
| `reason` | string | 是 |
| `notify_other` | boolean | 否，默认 true |

响应 `data`：`{ id, status, cancel_reason }`

---

> 主办方日程网格：`GET /api/events/{eventId}/meetings/schedule-grid`（requireEventAccess）。

---

## 账号管理（AD1）

### GET /api/account/overview

用途：**账号管理中心概览**

鉴权：requireAccountAdmin

响应 `data`：

| 字段 | 类型 |
|------|------|
| `totalEvents` | number |
| `totalParticipants` | number |
| `totalLeads` | number |
| `totalConnections` | number |
| `eventsByType.conference` | number |
| `eventsByType.expo` | number |
| `eventsByType.exhibition` | number |

---

### GET /api/account/events/{eventId}/manage-overview

用途：**AD2/AD3/AD4 活动管理面板概览**

鉴权：requireAccountAdmin（session 或 mobile token + ACCOUNT_ADMIN）

响应 `data`（按 `kind` 区分）：

| kind | 说明 |
|------|------|
| `CONFERENCE` | 签到率、在场、连接数、互动人次 |
| `EXPO` | 同上 + 展位热度排行、待审展商 |
| `BOOTH` | 展位访客、线索、互动、AI 买家推荐数 |

---

### GET /api/account/events

用途：**账号下活动列表**

鉴权：requireAccountAdmin

响应 `data`：数组

| 字段 | 类型 |
|------|------|
| `id` | string |
| `name` | string |
| `activityType` | string |
| `status` | `"DRAFT"` \| `"PUBLISHED"` \| `"LIVE"` \| `"ENDED"` |
| `keyMetric` | string | 如 `128 人已签到` |

---

## 展商管理（EM）

> 当前鉴权为 **requireExhibitorAdmin**（Web Session）。小程序展商模式若使用 mobile token，需后续统一 `resolveMobileAccountAdmin` 展商身份。

### GET /api/exhibitor/dashboard-stats

用途：**展商工作台首页**

鉴权：requireExhibitorAdmin

响应 `data`：

| 字段 | 类型 |
|------|------|
| `booth.id` | string |
| `booth.code` | string |
| `booth.name` | string |
| `booth.org_name` | string |
| `booth.event_id` | string |
| `booth.event_name` | string |
| `booth.scan_url` | string |
| `booth.qr_data_url` | string | PNG Data URL |
| `today_visitors` | number |
| `visitor_delta` | number | 较昨日 |
| `leads_today` | number |
| `grade_a_leads` | number |
| `interaction_participants` | number |
| `ai_recommended_count` | number |
| `pending_contact_count` | number |
| `hourly_trend` | array |
| `live_interactions` | array |

---

### GET /api/exhibitor/recommended-buyers

用途：**AI 推荐买家**

鉴权：requireExhibitorAdmin

响应 `data`：

| 字段 | 类型 |
|------|------|
| `buyers` | array |
| `buyers[].buyer_user_id` | string |
| `buyers[].name` | string |
| `buyers[].company` | string \| null |
| `buyers[].job_title` | string \| null |
| `buyers[].intent_level` | `"A"` \| `"B"` \| `"C"` |
| `buyers[].recommend_reason` | string |
| `buyers[].occurred_at` | string ISO8601 |
| `buyers[].pending_contact` | boolean |
| `pending_contact_count` | number |

---

### GET /api/exhibitor/leads

用途：**展位线索列表**

鉴权：requireExhibitorAdmin

Query：`limit`（默认 8，最大 50）

响应 `data`：

| 字段 | 类型 |
|------|------|
| `leads` | array |
| `leads[].id` | string |
| `leads[].name` | string |
| `leads[].company` | string \| null |
| `leads[].job_title` | string \| null |
| `leads[].ai_intent_level` | `"A"` \| `"B"` \| `"C"` |
| `leads[].intent_grade` | string \| null |
| `leads[].status` | string |
| `leads[].created_at` | string ISO8601 |
| `leads[].crm_sync_status` | string |
| `total` | number |

---

## 会后

### GET /api/events/{eventId}/my-summary

用途：**S 会后总结**

鉴权：mobile token

响应 `data`：

| 字段 | 类型 |
|------|------|
| `event.name` | string |
| `connections` | number |
| `wechatExchanged` | number |
| `stampsAndInteractions` | number |
| `aiFollowups` | array |
| `aiFollowups[].userId` | string |
| `aiFollowups[].name` | string |
| `aiFollowups[].avatar` | string \| null |
| `aiFollowups[].matchReason` | string |

---

## 其他常用（小程序辅助）

### GET /api/users/me

用途：**个人中心**

鉴权：mobile token

响应 `data`：`{ id, name, phone?, status, company?, title?, points_balance, ... }`

---

### POST /api/upload

用途：**上传微信二维码等图片**

鉴权：mobile token

请求：`multipart/form-data`，字段 `file`（≤5MB，png/jpg/webp/gif）

响应 `data`：`{ url: string }` 相对路径 `/uploads/...`

---

### GET /api/users/me/event-history

用途：**历史活动 / SN 记录**

鉴权：mobile token

---

### GET /api/feed

用途：**AI 动态流**

鉴权：mobile token

Query：`page`, `limit`, `cursor`

---

## P1 管理者工具（AD3/AD4）

鉴权：`requireMobileAccountAdmin`（session 或 mini_ token + ACCOUNT_ADMIN）

### POST /api/account/events/{eventId}/broadcast

用途：**全场推送**

请求：`{ body: string, title?: string, urgent?: boolean }`

### GET /api/account/events/{eventId}/exhibitor-reviews

用途：**展商审核列表**

响应 `data`：数组 `{ id, company_name, booth_code, booth_name, status }`

### PATCH /api/account/events/{eventId}/exhibitor-reviews

请求：`{ booth_id, action: "approve" | "reject" }`

### GET /api/account/events/{eventId}/stamp-monitor

响应 `data`：`{ completion_rate, booths: [{ booth_id, label, stamp_count, target_audience }] }`

### GET /api/account/events/{eventId}/admin-lotteries

响应 `data`：数组 `{ id, title, status, entry_count, booth_label? }`

### POST /api/account/events/{eventId}/admin-lotteries/{lotteryId}/draw

请求：`{ prize_rank?: number, count?: number }`

响应 `data`：`{ winners, count }`

### GET /api/account/events/{eventId}/admin-leads

Query：`limit`（默认 50）

响应 `data`：线索数组 `{ id, name, company, title, intent_level, booth_code, booth_company, crm_status, captured_at }`

### POST /api/account/events/{eventId}/admin-leads/export

用途：**MarketUP 导出任务（stub）**

响应 `data`：`{ task_id, status, lead_count, message }`

---

## P1 展商移动端

鉴权：`resolveMobileExhibitorBoothAccess`（展位所属组织或活动主办方管理员）

### GET /api/exhibitor/booths/{boothId}/dashboard

用途：**展位 dashboard（小程序 camelCase）**

响应 `data`：`{ booth_id, booth_code, todayVisitors, aLeads, bLeads, cLeads, crmSyncedCount, recentLeads[] }`

### GET /api/exhibitor/booths/{boothId}

用途：**展位配置**

响应 `data`：`{ id, booth_code, event_id, lead_form_config }`

### POST /api/exhibitor/leads/voice-note

用途：**语音备注上传**

请求：`multipart/form-data`，字段 `file`（≤10MB）

响应 `data`：`{ url: string }`

---

## P1 AI 辅助

鉴权：`resolveMobileUserId`

### GET /api/users/me/match-preview

Query：`eventId`（必填）

响应 `data`：数组 `{ user_id, name, company?, title?, match_score, match_reason }`

### GET /api/ai/connection-note

Query：`targetId`，可选 `eventId`、`refresh=1`

响应 `data`：`{ note, text, accept_rate }`

### POST /api/ai/accept-rate

请求：`{ target_user_id, request_note, event_id? }`

响应 `data`：`{ accept_rate }`

### GET /api/ai/scan-brief

Query：`targetUserId`，可选 `eventId`

响应 `data`：`{ content, intent_match?, accept_rate }`

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-06-13 | P1：管理工具、展商 dashboard、AI 三件套、语音上传；小程序 admin 接 API + 扩展屏注册 |
| 2026-06-13 | P0：manage-overview、me/meetings、meeting-time-slots、verify-code；mini_* 鉴权统一 |
| 2026-06-13 | 初版：覆盖 wx-login → 会后全链路；标注 mobile token† 兼容缺口 |
