# ConnectIQ CloudBase 部署指南

本文档描述如何将 ConnectIQ **从 Vercel 迁移到 [腾讯云 CloudBase（云开发）](https://cloud.tencent.com/product/tcb)**，并完成 Web 管理端、API、定时任务与微信小程序的联调上线。

> **推荐架构：** Next.js 16 全栈应用走 **CloudBase 云托管（CloudRun）**；数据库用 **TencentDB PostgreSQL**；文件走 **CloudBase 云存储 / COS**；定时任务用 **云函数定时触发器** 调用现有 `/api/cron/*`。

---

## 1. 架构总览

```
┌────────────────────────────────────────────────────────────────────┐
│  浏览器 / 主办方 PC / 大屏          微信小程序 (connectiq-user)      │
└───────────────┬───────────────────────────────┬────────────────────┘
                │ HTTPS                          │ TARO_APP_API_URL
                ▼                                ▼
     ┌──────────────────────┐         ┌──────────────────────┐
     │ CloudBase 云托管       │◄────────│ 微信服务器域名白名单   │
     │ Next.js 16 (SSR/API) │         └──────────────────────┘
     │ 端口 3000 / 自动扩缩  │
     └──────────┬───────────┘
                │ VPC 内网（推荐）
    ┌───────────┼────────────┬──────────────┐
    ▼           ▼            ▼              ▼
 TencentDB   TencentDB    云存储/COS    云函数 SCF
 PostgreSQL  Redis(可选)  静态/上传      Cron 定时触发
```

| 组件 | 仓库 | CloudBase / 腾讯云产品 | 说明 |
|------|------|------------------------|------|
| Web + API | `connectiq` | **云托管 CloudRun** | 必须 SSR + Route Handlers，不可用纯静态托管 |
| 数据库 | `packages/database` | **TencentDB PostgreSQL** | 改 `DATABASE_URL` |
| 缓存 | `apps/web/src/lib/redis.ts` | **TencentDB Redis**（可选） | 多实例部署建议启用 |
| 上传文件 | `/api/upload` | **云存储** 或 **COS** | 多副本必须对象存储，勿依赖容器本地盘 |
| 定时任务 | `/api/cron/*` | **云函数 + 定时触发器** | 替代 Vercel Cron |
| AI | `apps/web/src/lib/ai/llm.ts` | 公网调用 DeepSeek | 配置 `DEEPSEEK_API_KEY` |
| 小程序 | `connectiq-user` | 微信公众平台 | API 指向云托管自定义域名 |

### 1.1 为什么选云托管而不是静态托管 / HTTP 云函数？

| 方案 | 是否适用 ConnectIQ | 原因 |
|------|-------------------|------|
| **云托管 CloudRun** | ✅ **推荐** | 完整支持 App Router、SSR、流式响应、长连接；Prisma + PostgreSQL 长驻连接更稳定 |
| 静态网站托管 | ❌ | 仅适合 `output: 'export'` 纯静态站；无法运行 `/api/*` 与 NextAuth |
| HTTP 云函数 | ⚠️ 不推荐 | 冷启动、包体限制、Prisma/长任务适配成本高 |

---

## 2. 部署前准备

### 2.1 本地工具

| 工具 | 版本 |
|------|------|
| Node.js | **22.x**（与根目录 `engines` 一致） |
| pnpm | **11.6.0** |
| Docker | latest（本地验证镜像，可选） |
| [@cloudbase/cli](https://docs.cloudbase.net/cli-v1/intro) | latest |

```bash
npm i -g @cloudbase/cli
tcb login
```

### 2.2 开通 CloudBase 环境

1. 登录 [CloudBase 控制台](https://console.cloud.tencent.com/tcb)。
2. **新建环境** → 选择按量计费或套餐 → 记录 **环境 ID**（如 `connectiq-prod-xxxxx`）。
3. 确认已开通 **云托管**、**云函数**、**云存储**（按需）。
4. 地域建议与 TencentDB 相同（如 `ap-shanghai` / `ap-guangzhou`）。

### 2.3 域名与备案

- 生产环境绑定 **已备案** 自定义域名（如 `https://admin.example.com`）。
- 云托管默认域名 `*.app.tcloudbase.com` 可用于联调，不可作为微信小程序正式 `request` 域名长期方案（需备案域名）。

---

## 3. 创建配套云资源

### 3.1 TencentDB PostgreSQL

1. 控制台 → **云数据库 PostgreSQL** → 新建实例（建议 PG 15+，与 CloudBase **同地域**）。
2. 创建库与用户：

```sql
CREATE DATABASE connectiq;
CREATE USER connectiq_app WITH PASSWORD '强密码';
GRANT ALL PRIVILEGES ON DATABASE connectiq TO connectiq_app;
```

3. **网络：** 为 CloudBase 云托管配置 [VPC 访问](https://docs.cloudbase.net/run/deploy/configuring/network)（同 VPC 子网访问内网地址），或使用数据库公网地址 + 安全组白名单（不推荐生产）。
4. 连接串示例：

```bash
DATABASE_URL="postgresql://connectiq_app:密码@10.x.x.x:5432/connectiq?sslmode=require"
```

> 从 Supabase 迁出：导出 SQL / 使用 `pg_dump`，导入 TencentDB 后更新 `DATABASE_URL` 即可，Prisma Schema 无需改动。

### 3.2 Redis（可选，多副本推荐）

```bash
REDIS_URL="redis://:密码@10.x.x.x:6379/0"
```

未配置时降级为进程内内存缓存，**云托管多实例下缓存不一致**。

### 3.3 云存储 / COS（上传与二维码）

当前 `/api/upload` 默认写容器本地 `public/uploads/`，**云托管重建/扩缩容会丢文件**。

迁移路径（二选一）：

| 方案 | 说明 |
|------|------|
| **CloudBase 云存储** | 与 CloudBase 环境一体，SDK 接入简单 |
| **COS + CDN** | 与现有腾讯云文档一致，适合大流量 |

集章二维码等若仍依赖 Supabase Storage，需同步改造或暂时保留 Supabase 仅作 Storage/Realtime。

---

## 4. 代码与构建配置

### 4.1 开启 Next.js standalone 输出

`apps/web/next.config.ts` 需包含：

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  // ...其余配置
};
```

`standalone` 会在 `apps/web/.next/standalone/` 生成自包含运行产物，镜像体积可从 1GB+ 降至约 200MB。

### 4.2 仓库内 Dockerfile（monorepo）

项目根目录已提供 `Dockerfile`（pnpm workspace + Prisma generate + Web build）。核心要点：

- 构建阶段：`pnpm db:generate && pnpm --filter @connectiq/web build`
- 运行阶段：复制 `standalone` + `.next/static` + `public`
- **必须**设置 `HOSTNAME=0.0.0.0`、`PORT=3000`

本地验证：

```bash
cd connectiq
docker build -t connectiq-web:local .
docker run -p 3000:3000 --env-file apps/web/.env.production.local connectiq-web:local
curl -I http://127.0.0.1:3000
```

### 4.3 cloudbaserc.json

根目录 `cloudbaserc.json` 为 CLI 部署模板，部署前填入你的 **环境 ID**：

```json
{
  "envId": "your-env-id",
  "cloudrun": {
    "name": "connectiq-web"
  }
}
```

---

## 5. 环境变量

在 CloudBase 控制台 → **云托管 → connectiq-web → 版本管理 → 环境变量** 配置（或通过 CLI / Git 部署注入）。

### 5.1 必填

```bash
# 数据库
DATABASE_URL="postgresql://connectiq_app:密码@内网地址:5432/connectiq?sslmode=require"

# 站点（与自定义域名一致）
NEXTAUTH_URL="https://admin.example.com"
NEXTAUTH_SECRET="openssl rand -base64 32"
NEXT_PUBLIC_APP_URL="https://admin.example.com"

# 微信小程序
WX_MINI_APPID="wx........"
WX_MINI_SECRET="........"
WX_MINI_PROGRAM_STATE="formal"

# 定时 / 内部 API
CRON_SECRET="随机长字符串"
WECHAT_INTERNAL_SECRET="可与 CRON_SECRET 相同"

# AI（DeepSeek）
DEEPSEEK_API_KEY="sk-..."
DEEPSEEK_MODEL="deepseek-v4-flash"
```

### 5.2 构建时变量（NEXT_PUBLIC_*）

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_APP_URL` | 二维码、邀请链接根地址 |
| `NEXT_PUBLIC_SUPABASE_URL` | 若仍使用 Supabase Realtime/Storage |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同上 |

> **注意：** `NEXT_PUBLIC_*` 在 **`next build` 时**写入客户端 bundle。仅修改云托管控制台环境变量**不会**更新已构建的前端资源，需 **重新部署/build**。

服务端密钥（`DEEPSEEK_API_KEY`、`WX_MINI_SECRET`、`DATABASE_URL`）仅服务端可见，可安全放在云托管环境变量。

### 5.3 可选

```bash
REDIS_URL="redis://:密码@内网:6379/0"

# Supabase（大屏 Realtime 等，逐步下线时可保留）
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# 短信（当前代码读阿里云变量名）
ALIYUN_ACCESS_KEY_ID=""
ALIYUN_ACCESS_KEY_SECRET="..."
ALIYUN_SMS_SIGN_NAME="ConnectIQ"
ALIYUN_SMS_TEMPLATE_CODE="SMS_..."

# 订阅消息模板
WX_TMPL_EXCHANGE_REQUEST=""
WX_TMPL_EXCHANGE_RESULT=""
WX_TMPL_MEETING_INVITE=""
WX_TMPL_EXHIBITOR_INVITE=""
WX_TMPL_LOTTERY_RESULT=""
```

完整模板见 `apps/web/.env.example`。

---

## 6. 数据库初始化

在**能访问 TencentDB 的环境**执行（本地 VPN、云托管「Web 终端」、或临时 CVM）：

```bash
cd connectiq
export $(grep -v '^#' apps/web/.env.production.local | xargs)

pnpm db:generate
pnpm db:push          # 首次；稳定后改用 prisma migrate deploy
# pnpm db:seed        # 可选种子数据
```

---

## 7. 部署到 CloudBase 云托管

### 7.1 方式 A：CLI 一键部署（推荐首次验证）

```bash
cd connectiq
tcb login
tcb cloudrun deploy --port 3000 --envId your-env-id
```

按提示选择/创建服务名 `connectiq-web`。CLI 打包上传 Dockerfile 并在云端构建镜像。

部署完成后在控制台查看默认域名，例如：

`https://connectiq-web-xxxxx.ap-shanghai.app.tcloudbase.com`

### 7.2 方式 B：控制台「Git 仓库部署」（推荐生产 CI）

1. CloudBase 控制台 → **云托管 → 新建服务 → 通过 Git 部署**。
2. 绑定 GitHub `cn-ConnectIQ/develop`，分支 `develop` / `main`。
3. 构建配置：

| 配置项 | 值 |
|--------|-----|
| Dockerfile 路径 | `./Dockerfile` |
| 构建目录 | `/`（仓库根目录） |
| 容器端口 | `3000` |
| Node 版本 | 22（由 Dockerfile 控制） |

4. 在「环境变量」中填入第 5 节变量；`NEXT_PUBLIC_*` 需在构建阶段可用（Git 部署构建日志里可配置 build-arg 或在 Dockerfile 中 ARG 传入）。

### 7.3 方式 C：GitHub Actions

在仓库 Secrets 配置：

| Secret | 说明 |
|--------|------|
| `TCB_SECRET_ID` | 腾讯云 API 密钥 ID |
| `TCB_SECRET_KEY` | 腾讯云 API 密钥 Key |
| `TCB_ENV_ID` | CloudBase 环境 ID |

Workflow 示例：

```yaml
name: Deploy to CloudBase Run

on:
  push:
    branches: [develop, main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Install CloudBase CLI
        run: npm i -g @cloudbase/cli

      - name: Login & Deploy
        env:
          TCB_SECRET_ID: ${{ secrets.TCB_SECRET_ID }}
          TCB_SECRET_KEY: ${{ secrets.TCB_SECRET_KEY }}
          TCB_ENV_ID: ${{ secrets.TCB_ENV_ID }}
        run: |
          tcb login --apiKeyId $TCB_SECRET_ID --apiKey $TCB_SECRET_KEY
          tcb cloudrun deploy --port 3000 --envId $TCB_ENV_ID --force
```

> 生产环境建议把 `NEXT_PUBLIC_APP_URL` 等 build 变量通过 Git 部署面板或 Dockerfile `ARG` 注入，避免硬编码。

---

## 8. 自定义域名与 HTTPS

1. 云托管 → **connectiq-web → 自定义域名 → 添加**。
2. 填写 `admin.example.com`，按提示在 DNSPod 添加 **CNAME**。
3. 选择「自动申请免费 SSL 证书」或上传自有证书。
4. 生效后更新环境变量：
   - `NEXTAUTH_URL`
   - `NEXT_PUBLIC_APP_URL`
5. **重新部署**（因 `NEXT_PUBLIC_*` 可能需重新 build）。

微信小程序 **服务器域名** 需配置为同一 HTTPS 域名（不含路径）。

---

## 9. 定时任务（替代 Vercel Cron）

原 Vercel 配置见 `apps/web/vercel.json`：

| 路径 | 说明 | 建议调度 (UTC+8) |
|------|------|------------------|
| `/api/cron/daily` | 日终任务 | 每天 09:00 |
| `/api/cron/update-matching` | AI 配对更新 | 每天 10:00 |
| `/api/cron/post-event-followup` | 会后跟进 | 每天 11:00 |

接口鉴权：请求头 `Authorization: Bearer ${CRON_SECRET}`。

### 9.1 CloudBase 云函数 + 定时触发器（推荐）

1. 控制台 → **云函数 → 新建**（Node.js 18+）。
2. 函数代码（示例，可按 cron 拆分为 3 个函数）：

```javascript
const https = require("https");

exports.main = async () => {
  const host = "admin.example.com";
  const secret = process.env.CRON_SECRET;
  const paths = [
    "/api/cron/daily",
    "/api/cron/update-matching",
    "/api/cron/post-event-followup",
  ];

  for (const path of paths) {
    await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: host,
          path,
          method: "GET",
          headers: { Authorization: `Bearer ${secret}` },
        },
        (res) => {
          res.on("data", () => {});
          res.on("end", resolve);
        },
      );
      req.on("error", reject);
      req.end();
    });
  }
  return { ok: true };
};
```

3. 函数环境变量：`CRON_SECRET`（与云托管一致）。
4. **触发器 → 定时触发器**：`0 9 * * * *`（按 CloudBase cron 表达式配置；若拆函数则分别设 9:00 / 10:00 / 11:00）。

### 9.2 手动验证

```bash
curl -fsS -H "Authorization: Bearer 你的CRON_SECRET" \
  https://admin.example.com/api/cron/daily
```

---

## 10. 微信小程序配置

仓库：`connectiq-user`。

### 10.1 生产环境变量

`apps/miniprogram/.env.production`：

```bash
TARO_APP_API_URL=https://admin.example.com
TARO_APP_ENV=production
TARO_APP_USE_API_MOCK=false
TARO_APP_ENABLE_TEST_LOGIN=false
```

### 10.2 微信公众平台

**开发管理 → 开发设置 → 服务器域名**：

- request / uploadFile / downloadFile：`https://admin.example.com`
- 若文件走 COS/CDN，需追加 CDN 域名

### 10.3 构建与上传

```bash
cd connectiq-user
pnpm install
pnpm --filter @connectiq/miniprogram build:weapp
```

微信开发者工具导入 `apps/miniprogram/dist/` → 上传 → 提审发布。

---

## 11. 从 Vercel 迁移清单

按顺序执行：

| # | 任务 | 状态 |
|---|------|------|
| 1 | 创建 CloudBase 环境 + 开通云托管 | ☐ |
| 2 | 创建 TencentDB PostgreSQL，迁移数据 | ☐ |
| 3 | `next.config.ts` 增加 `output: 'standalone'` | ☐ |
| 4 | 配置云托管环境变量（第 5 节） | ☐ |
| 5 | `pnpm db:push` / `migrate deploy` | ☐ |
| 6 | CLI 或 Git 部署云托管，验证默认域名 | ☐ |
| 7 | 绑定自定义域名 + HTTPS | ☐ |
| 8 | 配置云函数 Cron 替代 Vercel Cron | ☐ |
| 9 | 上传/对象存储改造（若多实例） | ☐ |
| 10 | 更新小程序 `TARO_APP_API_URL` 与微信域名 | ☐ |
| 11 | 端到端验证（登录、采集、AI、Cron） | ☐ |
| 12 | 下线 Vercel 项目（确认 DNS 已切流） | ☐ |

### 11.1 服务对照表

| 原服务 | CloudBase / 腾讯云替代 |
|--------|------------------------|
| Vercel 托管 | **CloudBase 云托管** |
| Vercel Cron | **云函数定时触发器** |
| Supabase Postgres | **TencentDB PostgreSQL** |
| Supabase Realtime | 保留 Supabase 或自建 WS |
| Supabase Storage | **云存储 / COS** |
| Vercel 环境变量 | **云托管环境变量** |
| `LLM_API_KEY` | **`DEEPSEEK_API_KEY`**（当前代码默认 DeepSeek） |

---

## 12. 部署验证

| 步骤 | 操作 | 预期 |
|------|------|------|
| 首页 | `curl -I https://admin.example.com` | HTTP 200 |
| 静态资源 | 浏览器 Network 查看 `/_next/static/*` | 全部 200，非 404 |
| 登录 | Web 管理端 NextAuth 登录 | 成功 |
| 小程序 | 微信开发者工具 → 手机号登录 | `/api/auth/wx-login` 200 |
| AI | 保存活动意向 / 生成破冰话术 | DeepSeek 有响应 |
| Cron | 手动 curl + Bearer | 200，日志无报错 |
| 上传 | 小程序上传头像/语音 | 返回可访问 URL |
| 数据库 | Prisma Studio / SQL 客户端 | 表结构正确 |

---

## 13. 常见问题

### Q1：`/_next/static` 或 CSS 404

Dockerfile 未复制 `.next/static`。确认存在：

```dockerfile
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
```

### Q2：容器启动后外网 503

Next.js 监听 `localhost`。Dockerfile 需：

```dockerfile
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
```

### Q3：Prisma 连接数据库超时

- CloudBase 云托管与 TencentDB 是否 **同 VPC** 且已配置内网联通。
- `DATABASE_URL` 使用 **内网地址**。
- 安全组放行 PostgreSQL 5432。

### Q4：改了 `NEXT_PUBLIC_APP_URL` 前端仍是旧地址

`NEXT_PUBLIC_*` 为构建期注入，需 **重新 build 并部署**。

### Q5：小程序 request 失败

- 域名 HTTPS + **ICP 备案**。
- 微信公众平台域名与 `TARO_APP_API_URL` **完全一致**（无尾部 `/`）。
- 正式版 AppID / Secret 与 `WX_MINI_*` 一致。

### Q6：`next build` 报 Prisma / pg 相关错误

Client Component 不得直接 import 含 `prisma` 的模块；UI 只引用 `*-shared.ts` 等无 DB 依赖文件。

### Q7：AI 接口 503

云托管未配置 `DEEPSEEK_API_KEY`；配置后 **重启/发布新版本**。

---

## 14. 运维与安全

1. **密钥**：使用 CAM 子账号 + 最小权限；API 密钥勿提交 Git。
2. **备份**：TencentDB 自动备份；COS 开启版本控制。
3. **监控**：CloudBase / 云监控查看 QPS、错误率、容器 CPU；日志接入 CLS。
4. **扩缩容**：云托管按 CPU/内存/并发配置最小/最大实例数。
5. **WAF**：公网入口建议叠加 Web 应用防火墙。

---

## 15. 相关文件

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 云托管镜像构建（monorepo） |
| `.dockerignore` | 构建上下文排除项 |
| `cloudbaserc.json` | CloudBase CLI 配置模板 |
| `apps/web/next.config.ts` | 需 `output: 'standalone'` |
| `apps/web/.env.example` | 环境变量模板 |
| `apps/web/vercel.json` | 原 Cron 调度参考 |
| `docs/tencent-cloud-deployment.md` | CVM 自建方案（备选） |
| `docs/api-contract-mobile.md` | 小程序 API 契约 |

---

**文档版本：** 2026-07  
**适用分支：** `develop`  
**维护：** CloudBase 部署流程或 Dockerfile 变更时请同步更新本文档。
