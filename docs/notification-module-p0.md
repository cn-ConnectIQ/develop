# 玖莅通知模块 P0

## 架构
- `NotificationService.notifyUser` → `ChannelRouter` → `SmsAdapter` / `EmailAdapter` / `WechatAdapter(noop)`
- 业务与邀请发送不得直接调 Submail/Mailgun（邀请经 Adapter）

## 上线步骤
1. 执行 DDL：`packages/database/scripts/migrate-notification-p0.sql`
2. `pnpm --filter @connectiq/database db:generate`
3. 部署 `connectiq-web` 后首次打开「通知发送」会自动 seed 模板
4. 配置环境变量：
   - `NOTIFICATION_PII_KEY`（生产必填，recipient 加密）
   - `NOTIFICATION_OPTOUT_SALT`（可选）
   - `SHORT_LINK_BASE=https://9li.co`（默认）
   - `CRON_SECRET` + 定时调用 `POST /api/cron/notification-triggers`
5. 活动设置填写「活动简称」≤8 汉字（短信强制）
6. 组织 `overdraft_limit` 默认 0（互动点耗尽即停）

## 短链
- 格式：`https://9li.co/{a|b|o|j}/{token}`
- 应用路由：`/a|/b|/o|/j/[token]`（basePath `/uc` 时为 `/uc/a/...`；apex 短链需网关转发到应用）

## 管理端
- `/events/{eventId}/notifications` 七步向导
- 看板顺序：转化率 → 点击率 → 送达率 → 退订 → 成本
