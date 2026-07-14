# 计费与额度

## 数据模型

| 表 | 说明 |
|----|------|
| `billing_plans` | 可售套餐（按场 / 短信包 / 邮件包 / 互动点） |
| `billing_orders` | 订单 |
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

## 服务

- `wallet-service.ts`：钱包入账 / 扣减 / `markOrderPaidAndFulfill`
- `order-service.ts`：创建订单、发起支付、支付宝查单补偿
- `alipay.ts`：电脑网站支付 + 异步通知验签
- `wechat-pay.ts`：微信支付占位（未实现下单）

## API（需账号管理员登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/billing/plans` | 可售套餐 |
| GET | `/api/billing/channels` | 渠道配置状态（无密钥） |
| POST | `/api/billing/orders` | `{ planId, eventId?, paymentChannel? }` 下单 |
| GET | `/api/billing/orders` | 本组织订单 |
| GET | `/api/billing/orders/:id?sync=1` | 详情；`sync=1` 时向支付宝查单 |
| POST | `/api/billing/orders/:id/pay` | `{ channel: "ALIPAY" }` → `{ payUrl }` |
| POST | `/api/billing/alipay/notify` | 支付宝异步通知（明文 `success`/`fail`） |
| GET | `/api/billing/alipay/return` | 同步回跳 → `/billing/result` |
| POST | `/api/billing/wechat/notify` | 占位 501 |

前端流程：创建订单 → 调 pay 拿 `payUrl` → 跳转支付宝 → 回调入账；可对订单轮询 `?sync=1`。

---

## 支付宝开放平台配置指引（按此做即可拿到参数）

入口：[支付宝开放平台](https://open.alipay.com) → 控制台。  
官方密钥说明：[生成及配置 RSA2](https://opendocs.alipay.com/support/01raut) · [设置加签方式](https://opendocs.alipay.com/open/291/105972) · [密钥工具下载](https://opendocs.alipay.com/open/02kipk)

### 第 1 步：账号与主体

1. 用企业支付宝账号登录开放平台（需完成企业实名）。
2. 若尚未创建应用：控制台 → **网页&移动应用** → **创建应用**（网页应用即可）。
3. 进入应用详情，记下页面上的 **APPID** → 对应我们的 `ALIPAY_APP_ID`。

### 第 2 步：签约「电脑网站支付」

我们代码用的是 `alipay.trade.page.pay`（PC 收银台跳转）。

1. 在应用详情或 **产品中心** 找到 **电脑网站支付**。
2. 点击签约 / 开通（按提示完成商家签约；未签约接口会报权限错误）。
3. 签约审核通过后再继续后面步骤。

（手机网站支付、APP 支付本次不用；以后做小程序再另开。）

### 第 3 步：用官方工具生成 RSA2 密钥

1. 下载并安装 [支付宝开放平台密钥工具](https://opendocs.alipay.com/open/02kipk)（Windows 勿装在带空格路径）。
2. 打开工具 → **生成密钥**：
   - 加签方式：**密钥**（不要选「公钥证书」，我们当前按普通密钥接入）
   - 加签算法：**RSA2**
3. 点「生成密钥」，会得到：
   - **应用公钥** → 下一步要上传到开放平台（不要发给我当回调验签用）
   - **应用私钥** → 这就是 `ALIPAY_PRIVATE_KEY`（**只保存在本地/环境变量，切勿泄露、切勿提交 Git**）

说明：工具默认多生成 **PKCS8**（`-----BEGIN PRIVATE KEY-----`）。  
若如此，配置时额外设 `ALIPAY_KEY_TYPE=PKCS8`。  
若你转成了 PKCS1（`-----BEGIN RSA PRIVATE KEY-----`），则可不填（默认 PKCS1）或显式写 `PKCS1`。

### 第 4 步：在开放平台上传「应用公钥」，拿「支付宝公钥」

1. 应用详情 → **开发设置** / **开发信息** → **接口加签方式（密钥/证书）** → **设置**。
2. 选择 **密钥**（不是证书）→ RSA2。
3. 粘贴第 3 步生成的 **应用公钥** → 确认上传（常需短信/支付密码验证）。
4. 配置成功后，页面会显示 / 可查看 **支付宝公钥** → 复制完整内容 → 这就是 `ALIPAY_PUBLIC_KEY`。

常见混淆（务必分清）：

| 名称 | 谁持有 | 我们怎么用 |
|------|--------|------------|
| 应用私钥 | 只在你这边 | `ALIPAY_PRIVATE_KEY`（签名） |
| 应用公钥 | 上传给支付宝 | 不入库；只用于平台配置 |
| 支付宝公钥 | 平台给你 | `ALIPAY_PUBLIC_KEY`（验签回调） |

### 第 5 步：网关与回调地址

| 项 | 值 |
|----|-----|
| 正式网关 `ALIPAY_GATEWAY` | `https://openapi.alipay.com/gateway.do` |
| 异步通知（notify） | `https://9li.co/uc/api/billing/alipay/notify` |
| 同步回跳（return） | `https://9li.co/uc/api/billing/alipay/return` |

- 回调 URL 由代码用 `NEXT_PUBLIC_APP_URL=https://9li.co/uc` 自动拼出，一般**不必**再在开放平台单独填一个全局 notify（下单时我们会带上）。
- 确保上述两个 URL **公网可访问**（CloudBase 部署后可用浏览器测 return；notify 由支付宝服务器 POST）。
- 若开放平台有「授权回调地址 / 应用网关」类字段，按产品要求填写站点根或上述域名即可；与支付 notify 不是同一概念。

沙箱联调（可选）：控制台沙箱应用另有 APPID 与密钥；网关改为沙箱地址  
`https://openapi-sandbox.dl.alipaydev.com/gateway.do`。上线前切回正式应用参数。

### 第 6 步：收集后发给我的清单

配置好后，私密发给我这 4～5 项即可（我会写入 CloudBase / `.env.local`，**不会 commit**）：

1. `ALIPAY_APP_ID`（数字串）
2. `ALIPAY_PRIVATE_KEY`（完整，含 `BEGIN…END` 也可）
3. `ALIPAY_PUBLIC_KEY`（完整支付宝公钥）
4. 正式还是沙箱（默认正式）
5. 私钥头一行：`BEGIN PRIVATE KEY` 还是 `BEGIN RSA PRIVATE KEY`（用来定 `ALIPAY_KEY_TYPE`）

本地也可对照 `apps/web/.env.example` 自行先填 `.env.local` 测。

### 自检清单

- [ ] 应用已拿 APPID  
- [ ] 已签约 **电脑网站支付**  
- [ ] 加签方式 = **密钥 + RSA2**（不是证书模式）  
- [ ] 已上传应用公钥，并已复制到 **支付宝公钥**  
- [ ] 应用私钥只自己留存一份  
- [ ] 生产站点 `NEXT_PUBLIC_APP_URL` 已是 `https://9li.co/uc`  

---

## 环境变量对照（配到 CloudBase / `.env.local`）

| 环境变量 | 从哪里拿 | 说明 |
|----------|----------|------|
| `ALIPAY_APP_ID` | 应用详情 APPID | 必填 |
| `ALIPAY_PRIVATE_KEY` | 密钥工具「应用私钥」 | 必填；多行可用 `\n` |
| `ALIPAY_PUBLIC_KEY` | 加签方式里的「支付宝公钥」 | 必填 |
| `ALIPAY_GATEWAY` | 固定正式网关 | 见上表 |
| `NEXT_PUBLIC_APP_URL` | 站点 | 生产 `https://9li.co/uc` |
| `ALIPAY_KEY_TYPE` | 看私钥 PEM 头 | PKCS8 或 PKCS1 |
| `ALIPAY_NOTIFY_URL` / `ALIPAY_RETURN_URL` | 一般不用填 | 默认同上回调 URL |

---

## 微信支付（暂缓）

之后需要时再配：`WECHAT_PAY_MCH_ID`、`WECHAT_PAY_API_V3_KEY`、`WECHAT_PAY_SERIAL_NO`、`WECHAT_PAY_PRIVATE_KEY`、`WECHAT_PAY_APP_ID`（或复用已有小程序/服务号 AppID）。

## 额度消耗规则（正式账号；试用 TRIAL 跳过）

| 动作 | 扣减 |
|------|------|
| 发布活动 | 须已支付绑定该场的 **办会套餐**（`EVENT_USAGE`）；也可先买未绑场订单，发布时自动绑定 |
| 短信邀请发送成功 | 短信余额 −1（失败退回） |
| 邮件邀请发送成功 | 邮件余额 −1（失败退回） |

### 邀请批量发送引擎（简）

- 明细状态：`PENDING → SENDING → SENT`（送达回调可进 `DELIVERED`/`CLICKED`/`FAILED`）
- 发送入口：创建后立即 `triggerInviteProcessing`；兜底 Cron：`GET /api/cron/invite-send`（建议每 1～2 分钟）
- Mailgun 回调：`POST /api/webhooks/mailgun`（自定义变量 `invite_record_id`）
- 阿里云短信报告：`POST /api/webhooks/aliyun-sms`（按 `BizId` 关联）
| 创建互动会话 | 互动点 −1 |

管理端 UI：`/organizer/billing`（侧栏「计费与充值」）。

## 短信

**优先赛邮 Submail**（与 MarketUp 一致）：

```bash
SUBMAIL_APP_ID=...
SUBMAIL_APP_KEY=...
SUBMAIL_SIGN_NAME=玖莅
# 可选模板 XSend
# SUBMAIL_PROJECT_CODE=...
# SUBMAIL_PROJECT_INVITE=...
```

回调：`POST /api/webhooks/submail-sms`（delivered / dropped / mo 退订）。  
未配 Submail 时回退阿里云 `ALIYUN_*`。可用 `SMS_PROVIDER=submail|aliyun|auto` 强制选择。 
实现：`lib/aliyun-sms.ts`（HTTP RPC，无额外 SDK）。
