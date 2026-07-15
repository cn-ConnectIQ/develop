# 邀请认领流程（短信短链 → H5 中转 → 小程序）

## URL
`https://9li.co/a/{token}` — 8 位 base62，不含身份信息

## 分流
- **微信内**：唤起小程序 `pages/activation/landing?token=`
  - 老用户：`POST /api/invite/claim` action=silent → toast「欢迎回来」→ 推荐/意向
  - 新用户：`getPhoneNumber` → claim action=phone（phone_hash 比对）
  - 拒绝授权：渐进式 guest，核心动作再核验
  - 手机号不一致：转标准新参会者（拉新）
- **微信外新用户**：复制链接回微信（不在 H5 发验证码）
- **微信外老用户 session**：可走 `/join` 网页查看

## API
- `GET|POST /api/invite/resolve`
- `POST /api/invite/claim` `{ action: silent|phone|guest, token, wxCode, phoneCode? }`

## 上线
1. `migrate-invite-claim.sql`（phone_hash / first_used_at）
2. 配置 `NEXT_PUBLIC_WX_MINI_APPID`（H5 唤起）、可选 `WX_MP_URL_LINK_BASE`
3. 新邀请记录自动生成 8 位 token；历史 cuid token 仍可用
