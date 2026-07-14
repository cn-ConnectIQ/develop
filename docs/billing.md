# 计费与额度（阶段一）

## 数据模型

| 表 | 说明 |
|----|------|
| `billing_plans` | 可售套餐（按场 / 短信包 / 邮件包 / 互动点） |
| `billing_orders` | 订单（先支持 `MANUAL` 标已支付） |
| `org_wallets` | 组织额度：短信 / 邮件 / 互动点余额 |
| `billing_ledgers` | 入账与消耗流水 |

## 默认套餐（种子）

```bash
pnpm --filter @connectiq/database db:seed:billing-plans
```

| code | 价格 | 含 |
|------|------|-----|
| `EVENT_UNDER_500` | ¥999/场 | 10 互动点 |
| `EVENT_OVER_500` | ¥1999/场 | 20 互动点 |
| `INTERACTION_POINT_1` | ¥150/点 | 1 互动点 |
| `SMS_PACK_500` / `2000` | ¥45 / ¥160 | 短信条数 |
| `EMAIL_PACK_1000` / `5000` | ¥30 / ¥120 | 邮件封数 |

## 服务骨架

`apps/web/src/lib/billing/wallet-service.ts`：

- `getOrCreateOrgWallet`
- `creditOrgWallet` / `debitOrgWallet`
- `markOrderPaidAndFulfill`（订单 PAID 后按套餐自动入账）

## 后续阶段

2. 支付渠道（微信/支付宝）+ 回调  
3. 发布活动 / 发邀请时扣额度  
4. 充值与账单管理端 UI  
