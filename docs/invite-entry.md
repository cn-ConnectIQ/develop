# 受邀参会者统一入口（InviteEntry）— P0

API Base：`https://9li.co/uc`  
小程序落地页固定：`pages/activation/landing`

短信 / 邮件 / 个人小程序码 / 活动通用码共用短 `entryToken`（scene=`t_`+token ≤32），禁止在 scene 拼 cuid+手机号。

## 模式

| mode | phone | 用途 |
|------|-------|------|
| `personal` | 11 位手机号 | 个人受邀（短信/邮件/个人码） |
| `event` | `null` | 活动通用现场码 |

## DDL

```bash
psql "$DATABASE_URL" -f packages/database/scripts/migrate-invite-entry.sql
# 或平台管理员 POST /api/platform/db-schema-sync
```

---

## 1. 管理端创建入口

`POST /api/account/events/:eventId/invite-entries`  
（PC 等价：`POST /api/events/:eventId/invite-entries`）

```json
{ "phone": "13800138000", "honorific": "张总" }
```

活动通用码（phone 省略或 null）：

```json
{}
```

响应 `data`：

```json
{
  "token": "Ab3xY9kqLm2pN8wxQrst",
  "eventId": "cmrb870c8001rn8pb43e8srtn",
  "phone": "13800138000",
  "mode": "personal",
  "miniProgramPath": "pages/activation/landing?t=Ab3xY9kqLm2pN8wxQrst",
  "scene": "t_Ab3xY9kqLm2pN8wxQrst",
  "expiresAt": null
}
```

可选：`force`、`includeUrlLink`、`includeWxacode`。

---

## 2. 小程序兑换（匿名）

`POST /api/invite/entry-resolve`

```json
{ "token": "Ab3xY9kqLm2pN8wxQrst" }
```
或 `{ "scene": "t_Ab3xY9kqLm2pN8wxQrst" }`

成功：

```json
{
  "data": {
    "eventId": "cmrb870c8001rn8pb43e8srtn",
    "phone": "13800138000",
    "mode": "personal",
    "eventName": "智链未来产业博览会 2026",
    "honorific": "张总",
    "name": null
  }
}
```

活动码：`phone` 为 `null`，`mode`=`event`。

| HTTP | 含义 |
|------|------|
| 400 | 缺参 |
| 404 | 无效 |
| 410 | 过期/撤销 |
| 429 | 限流 |

---

## 3. 活动通用码核验名单

`POST /api/events/:eventId/verify-attendee`  
Header：`Authorization: Bearer <mini_token>`

```json
{ "matched": true, "needs_intent": false }
```

非名单：`403`，`message` 如「该手机号不在本场参会名单」。

---

## 4. 登录（对齐）

- `POST /api/auth/wx-login` `{ "code", "eventId?" }`
- `POST /api/auth/wx-login-phone` `{ "wxCode", "phoneCode", "eventId?" }`

返回 `user.phone`、`has_phone`；带 `eventId` 时另有 `intents`、`needs_intent`。

---

## 5. 活动主数据（P0-1）

| 接口 | 说明 |
|------|------|
| `POST /api/events/verify-code` | `{ "code": "TEST1377" }` |
| `GET /api/events/by-code/TEST1377` | 公开活动投影 |
| `GET /api/events/:eventId` | 公开/主办详情 |
| `GET /api/events/:eventId/dashboard-mobile` | 活动首页主数据 |
| `GET /api/account/events` | 管理端列表（需鉴权） |

Demo 活动：`cmrb870c8001rn8pb43e8srtn`（智链未来产业博览会 2026 / TEST1377）

---

## 三种触达

**A. 短信/邮件** — URL Link：`path=pages/activation/landing`，`query=t=<token>`  
**B. 个人码** — `getwxacodeunlimit`：`page=pages/activation/landing`，`scene=t_<token>`  
**C. 活动通用码** — 同上且 entry 无 phone；或兼容 `pages/activation/landing?eventId=<id>&mode=event`

---

## 联调 curl 样例（生产实测 2026-07-16）

真实 eventId：`cmrb870c8001rn8pb43e8srtn`（智链未来产业博览会 2026 / TEST1377）

| 类型 | token | path | scene |
|------|-------|------|-------|
| 个人 | `tnb2agMrmE3m0ianGCWA` | `pages/activation/landing?t=tnb2agMrmE3m0ianGCWA` | `t_tnb2agMrmE3m0ianGCWA` (22) |
| 活动 | `OCMGmVpvFLrS6DtUaPPO` | `pages/activation/landing?t=OCMGmVpvFLrS6DtUaPPO` | `t_OCMGmVpvFLrS6DtUaPPO` (22) |

```bash
BASE=https://9li.co/uc
EID=cmrb870c8001rn8pb43e8srtn

# P0-1 活动首页
curl -sS "$BASE/api/events/$EID/dashboard-mobile"

# 活动码旁路
curl -sS -X POST "$BASE/api/events/verify-code" \
  -H 'Content-Type: application/json' \
  -d '{"code":"TEST1377"}'

# 兑换个人入口
curl -sS -X POST "$BASE/api/invite/entry-resolve" \
  -H 'Content-Type: application/json' \
  -d '{"token":"tnb2agMrmE3m0ianGCWA"}'
# → phone=13800138000, mode=personal

# 兑换活动通用入口
curl -sS -X POST "$BASE/api/invite/entry-resolve" \
  -H 'Content-Type: application/json' \
  -d '{"scene":"t_OCMGmVpvFLrS6DtUaPPO"}'
# → phone=null, mode=event

# 核验参会者（需小程序 Bearer）
curl -sS -X POST "$BASE/api/events/$EID/verify-attendee" \
  -H "Authorization: Bearer <mini_token>"
# 名单内 → {"matched":true,"needs_intent":...}
# 名单外 → 403「该手机号不在本场参会名单」
```
