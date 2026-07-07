# ConnectIQ 腾讯云部署安装指南

> **迁移到 CloudBase？** 若计划使用 **腾讯云 CloudBase（云开发）** 托管 Next.js，请优先阅读 **[CloudBase 部署指南](./cloudbase-deployment.md)**。  
> 本文档保留 **CVM + Nginx + PM2** 自建方案，适合需要完全自主运维或使用已有 CVM 的场景。

本文档描述如何将 ConnectIQ 全栈系统部署到**腾讯云**体系，覆盖 Web 管理端/API、PostgreSQL 数据库、缓存、对象存储、定时任务与微信小程序发布。

---

## 1. 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户 / 主办方 / 展商                      │
└───────────────┬───────────────────────────────┬─────────────────┘
                │ HTTPS                          │ 微信客户端
                ▼                                ▼
     ┌──────────────────┐              ┌──────────────────┐
     │  CLB 负载均衡     │              │  微信小程序       │
     │  + SSL 证书       │              │  (Taro 构建)      │
     └────────┬─────────┘              └────────┬─────────┘
              │                                  │
              ▼                                  │ TARO_APP_API_URL
     ┌──────────────────┐                       │
     │  CVM / Lighthouse │◄──────────────────────┘
     │  Next.js 16 Web   │
     │  (Node 22 + pnpm) │
     └────────┬─────────┘
              │
    ┌─────────┼─────────┬──────────────┐
    ▼         ▼         ▼              ▼
 TencentDB  TencentDB   COS         云函数 SCF
 PostgreSQL  Redis    对象存储      定时 Cron
```

| 组件 | 仓库 | 技术栈 | 腾讯云推荐产品 |
|------|------|--------|----------------|
| Web + API | `connectiq` | Next.js 16、Prisma、NextAuth | **CloudBase 云托管**（推荐）或 **CVM** / **Lighthouse** |
| 数据库 | `connectiq/packages/database` | PostgreSQL 15+ | **TencentDB for PostgreSQL** |
| 缓存（可选） | `apps/web/src/lib/redis.ts` | Redis | **TencentDB for Redis** |
| 文件上传 | `/api/upload` | 本地目录（生产建议 COS） | **对象存储 COS** + **CDN** |
| 大屏 Realtime（可选） | Supabase Realtime | WebSocket | 保留 Supabase **或** 自建 WS / 腾讯云 IM |
| 定时任务 | `/api/cron/*` | HTTP + `CRON_SECRET` | **云函数 SCF 定时触发器** |
| 短信 | 邀请/登录 | 当前默认阿里云变量 | **腾讯云短信 SMS**（需改代码或适配层） |
| 小程序 | `connectiq-user` | Taro 4 + 微信 | **微信公众平台**（与腾讯云同账号体系） |

---

## 2. 部署前准备

### 2.1 本地环境

| 工具 | 版本要求 |
|------|----------|
| Node.js | **22.x**（与根目录 `engines` 一致） |
| pnpm | **11.6.0**（`corepack enable && corepack prepare pnpm@11.6.0 --activate`） |
| Git | 2.x |
| 微信开发者工具 | 最新稳定版（小程序上传） |

### 2.2 腾讯云账号与权限

1. 注册并完成 [腾讯云实名认证](https://cloud.tencent.com/document/product/378/3629)。
2. 开通：**云服务器 CVM**、**云数据库 PostgreSQL**、**对象存储 COS**、**云函数 SCF**、**访问管理 CAM**。
3. 建议创建子账号并授予最小权限（CVM、CDB、COS、SCF、DNSPod 只读/运维策略）。

### 2.3 域名与备案

- 在中国大陆提供 Web 服务需 **ICP 备案**（可通过腾讯云备案系统提交）。
- 在 **DNSPod** 添加域名解析，例如：
  - `api.example.com` → CLB / CVM 公网 IP
  - `admin.example.com` → 同上（或与 API 共用）

---

## 3. 创建云资源

### 3.1 TencentDB for PostgreSQL

1. 控制台 → **云数据库 PostgreSQL** → 新建实例。
2. 建议配置：
   - 版本：**PostgreSQL 15** 或更高
   - 规格：生产 2C4G 起；测试可用 1C2G
   - 网络：与 CVM **同一 VPC**
   - 存储：SSD，50GB 起
3. 创建数据库与用户：

```sql
CREATE DATABASE connectiq;
CREATE USER connectiq_app WITH PASSWORD '强密码';
GRANT ALL PRIVILEGES ON DATABASE connectiq TO connectiq_app;
```

4. 安全组：仅允许 CVM 子网访问 **5432** 端口。
5. 连接串（写入环境变量）：

```bash
DATABASE_URL="postgresql://connectiq_app:强密码@10.x.x.x:5432/connectiq?sslmode=require"
```

> Prisma CLI 与运行时共用 `DATABASE_URL`（见 `packages/database/prisma.config.ts`）。高并发时可额外配置连接池（PgBouncer / 数据库代理），当前代码未强制要求 `DATABASE_URL_POOLER`。

### 3.2 TencentDB for Redis（可选，推荐生产启用）

1. 新建 Redis 实例（VPC 与 CVM 相同）。
2. 设置密码，安全组放行 **6379**。
3. 环境变量：

```bash
REDIS_URL="redis://:密码@10.x.x.x:6379/0"
```

未配置时系统自动降级为进程内内存缓存（多实例部署时**不推荐**）。

### 3.3 对象存储 COS（推荐）

当前 `/api/upload` 默认写入服务器本地 `public/uploads`，**多机或容器重建会丢文件**。生产环境建议：

1. 创建存储桶，例如 `connectiq-prod-1250000000`，地域选与 CVM 相同（如 `ap-guangzhou`）。
2. 访问权限：私有读写 + CDN 回源，或公共读（仅静态资源桶）。
3. 配置 **CDN** 加速域名，例如 `https://cdn.example.com`。
4. 在 CAM 创建 API 密钥，后续将上传逻辑改为 COS SDK（或使用 COS 挂载到 CVM）。

> 集章二维码等能力当前依赖 Supabase Storage（`stamp-qrcode.ts`）。若完全去 Supabase，需同步改造为 COS 或保留 Supabase 仅作 Realtime/Storage。

### 3.4 云服务器 CVM

**推荐规格（生产起步）：**

| 场景 | CPU | 内存 | 系统盘 | 带宽 |
|------|-----|------|--------|------|
| 测试 | 2 核 | 4 GB | 50 GB SSD | 5 Mbps |
| 生产 | 4 核 | 8 GB | 100 GB SSD | 10 Mbps+ |

**操作系统：** Ubuntu 22.04 LTS 或 TencentOS Server 4。

**安全组入站：**

| 端口 | 来源 | 说明 |
|------|------|------|
| 22 | 运维 IP | SSH |
| 80 | 0.0.0.0/0 | HTTP（重定向 HTTPS） |
| 443 | 0.0.0.0/0 | HTTPS |

数据库、Redis 端口**不对公网开放**。

---

## 4. 服务器初始化

SSH 登录 CVM 后执行：

```bash
# 基础工具
sudo apt update && sudo apt install -y git curl build-essential nginx certbot python3-certbot-nginx

# Node 22（使用 NodeSource）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
corepack enable
corepack prepare pnpm@11.6.0 --activate

# 运行用户（可选）
sudo useradd -m -s /bin/bash connectiq
sudo mkdir -p /opt/connectiq
sudo chown connectiq:connectiq /opt/connectiq
```

### 4.1 拉取代码

```bash
cd /opt/connectiq
git clone https://github.com/cn-ConnectIQ/develop.git connectiq
cd connectiq
git checkout develop   # 或生产分支
pnpm install --frozen-lockfile
```

---

## 5. 环境变量配置

在 `apps/web/` 下创建生产环境文件（**勿提交 Git**）：

```bash
cp apps/web/.env.example apps/web/.env.production.local
vim apps/web/.env.production.local
```

### 5.1 必填项

```bash
# ── 数据库（TencentDB PostgreSQL）──
DATABASE_URL="postgresql://connectiq_app:密码@内网地址:5432/connectiq?sslmode=require"

# ── 站点 ──
NEXTAUTH_URL="https://admin.example.com"
NEXTAUTH_SECRET="随机 32 字节 Base64"   # openssl rand -base64 32
NEXT_PUBLIC_APP_URL="https://admin.example.com"

# ── 微信小程序 ──
WX_MINI_APPID="wx........"
WX_MINI_SECRET="........"
WX_MINI_PROGRAM_STATE="formal"          # 正式版

# ── 定时任务 / 内部 API 鉴权 ──
CRON_SECRET="随机长字符串"
WECHAT_INTERNAL_SECRET="可与 CRON_SECRET 相同"

# ── AI（DeepSeek）──
DEEPSEEK_API_KEY="sk-..."
DEEPSEEK_MODEL="deepseek-v4-flash"
```

### 5.2 推荐项

```bash
# Redis 缓存
REDIS_URL="redis://:密码@内网地址:6379/0"

# 短信（当前代码读取阿里云变量名；接入腾讯云短信前可暂留或做适配）
ALIYUN_ACCESS_KEY_ID=""
ALIYUN_ACCESS_KEY_SECRET=""
ALIYUN_SMS_SIGN_NAME="ConnectIQ"
ALIYUN_SMS_TEMPLATE_CODE="SMS_..."

# 邮件（SMTP_HOST 未配置时仅打日志）
SMTP_HOST="smtp.exmail.qq.com"
SMTP_PORT="465"
SMTP_USER="noreply@example.com"
SMTP_PASS="..."
```

### 5.3 Supabase（可选）

大屏抽奖 Realtime、二维码 Storage 等能力依赖 Supabase。若继续使用：

```bash
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
```

完全迁移到腾讯云时，需另行实现 Realtime（WebSocket）与 COS 存储。

---

## 6. 数据库初始化

在**能访问 TencentDB 的内网环境**执行（CVM 上或本地 VPN）：

```bash
cd /opt/connectiq/connectiq

# 加载环境变量
export $(grep -v '^#' apps/web/.env.production.local | xargs)

# 生成 Prisma Client
pnpm db:generate

# 同步 Schema（首次部署）
pnpm db:push

# 可选：种子数据
pnpm db:seed
```

> 生产环境稳定后建议改用 `prisma migrate deploy` 管理版本化迁移。

---

## 7. 构建与启动 Web 服务

### 7.1 构建

```bash
cd /opt/connectiq/connectiq
export $(grep -v '^#' apps/web/.env.production.local | xargs)

pnpm db:generate
pnpm --filter @connectiq/web build
```

构建成功后产物位于 `apps/web/.next/`。

### 7.2 使用 PM2 守护进程

```bash
sudo npm install -g pm2

cd /opt/connectiq/connectiq/apps/web

# 启动（端口 3000）
pm2 start npm --name connectiq-web -- start
pm2 save
pm2 startup   # 按提示执行 sudo 命令，实现开机自启
```

验证：

```bash
curl -I http://127.0.0.1:3000
```

### 7.3 Nginx 反向代理 + HTTPS

```nginx
# /etc/nginx/sites-available/connectiq
server {
    listen 80;
    server_name admin.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.example.com;

    ssl_certificate     /etc/letsencrypt/live/admin.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.example.com/privkey.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 本地上传目录（未接 COS 前）
    location /uploads/ {
        alias /opt/connectiq/connectiq/apps/web/public/uploads/;
        expires 30d;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/connectiq /etc/nginx/sites-enabled/
sudo certbot --nginx -d admin.example.com
sudo nginx -t && sudo systemctl reload nginx
```

### 7.4 使用 CLB（可选）

多台 CVM 时，在前端加 **负载均衡 CLB**：

1. 创建 CLB 实例（公网）。
2. 监听 443 → 后端 CVM:80（Nginx）或 CVM:3000。
3. 在 CLB 绑定腾讯云 **SSL 证书**（或上传自有证书）。
4. DNSPod 将域名 A 记录指向 CLB VIP。

---

## 8. 定时任务（Cron）

项目内置 3 个 HTTP Cron（原 Vercel 配置见 `apps/web/vercel.json`）：

| 路径 | 说明 | 建议调度（UTC+8） |
|------|------|-------------------|
| `/api/cron/daily` | 日终任务 | 每天 09:00 |
| `/api/cron/update-matching` | AI 配对更新 | 每天 10:00 |
| `/api/cron/post-event-followup` | 会后跟进 | 每天 11:00 |

### 方案 A：云函数 SCF + 定时触发器（推荐）

1. 创建 **事件函数**，运行环境 Node.js 18+。
2. 代码示例：

```javascript
const https = require('https');

exports.main_handler = async () => {
  const paths = [
    '/api/cron/daily',
    '/api/cron/update-matching',
    '/api/cron/post-event-followup',
  ];
  const host = 'admin.example.com';
  const secret = process.env.CRON_SECRET;

  for (const path of paths) {
    await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: host,
          path,
          method: 'GET',
          headers: { Authorization: `Bearer ${secret}` },
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        },
      );
      req.on('error', reject);
      req.end();
    });
  }
  return { ok: true };
};
```

3. 配置定时触发器：`0 9 * * *`（可按需拆分三个函数分别触发）。
4. 在 SCF 环境变量中设置 `CRON_SECRET`（与 Web 一致）。

### 方案 B：CVM crontab

```bash
crontab -e
```

```cron
0 9 * * * curl -fsS -H "Authorization: Bearer 你的CRON_SECRET" https://admin.example.com/api/cron/daily
0 10 * * * curl -fsS -H "Authorization: Bearer 你的CRON_SECRET" https://admin.example.com/api/cron/update-matching
0 11 * * * curl -fsS -H "Authorization: Bearer 你的CRON_SECRET" https://admin.example.com/api/cron/post-event-followup
```

---

## 9. 微信小程序部署

仓库：`connectiq-user`（与 Web 分仓）。

### 9.1 配置 API 地址

编辑 `apps/miniprogram/.env.production`：

```bash
TARO_APP_API_URL=https://admin.example.com
TARO_APP_ENV=production
TARO_APP_USE_API_MOCK=false
TARO_APP_ENABLE_TEST_LOGIN=false
```

### 9.2 构建

```bash
cd connectiq-user
pnpm install
pnpm --filter @connectiq/miniprogram build:weapp
```

产物目录：`apps/miniprogram/dist/`。

### 9.3 上传与发布

1. 打开 **微信开发者工具** → 导入项目 → 选择 `apps/miniprogram/dist`。
2. **详情 → 本地设置**：确认 AppID 与服务器域名一致。
3. 在微信公众平台 **开发管理 → 开发设置 → 服务器域名** 配置：
   - `request 合法域名`：`https://admin.example.com`
   - `uploadFile` / `downloadFile`：同上（若使用 COS/CDN 需一并添加）。
4. 上传代码 → 提交审核 → 发布。

### 9.4 订阅消息模板

在 `.env.production.local` 中填入微信公众平台申请的模板 ID：

```bash
WX_TMPL_EXCHANGE_REQUEST=""
WX_TMPL_EXCHANGE_RESULT=""
WX_TMPL_MEETING_INVITE=""
WX_TMPL_EXHIBITOR_INVITE=""
WX_TMPL_LOTTERY_RESULT=""
```

---

## 10. CI/CD（可选）

### 10.1 CODING DevOps（腾讯云）

1. 在 [CODING](https://coding.net/) 导入 GitHub/Git 仓库。
2. 构建计划：
   - 镜像：Node 22
   - 安装：`corepack enable && pnpm install --frozen-lockfile`
   - 构建：`pnpm db:generate && pnpm --filter @connectiq/web build`
   - 部署：SSH 到 CVM 执行 `git pull && pnpm install && pnpm --filter @connectiq/web build && pm2 restart connectiq-web`

### 10.2 GitHub Actions → CVM

在仓库 Secrets 中配置 `SSH_HOST`、`SSH_KEY`、`ENV_FILE`，push 到 `main`/`develop` 后自动部署。

---

## 11. 部署验证清单

| 步骤 | 命令 / 操作 | 预期 |
|------|-------------|------|
| 健康检查 | `curl https://admin.example.com` | 200，登录页可打开 |
| 数据库 | `pnpm db:studio`（内网） | 可连库、表存在 |
| 小程序登录 | 微信开发者工具 → 手机号登录 | `/api/auth/wx-login` 正常 |
| 上传 | 小程序上传头像 | 返回 `/uploads/xxx` 或 COS URL |
| Cron | 手动 curl cron 接口 + Bearer | 200，日志无报错 |
| AI | 主办方后台触发配对 | LLM API 有响应 |

---

## 12. 安全与运维建议

1. **密钥管理**：使用腾讯云 **SSM 凭据管理** 或 CVM 环境变量文件（权限 `600`），禁止写入 Git。
2. **网络**：数据库、Redis 仅 VPC 内网访问；CVM 启用 **安全组** + **云防火墙**。
3. **备份**：TencentDB 开启自动备份（7 天保留起）；COS 开启版本控制。
4. **监控**：接入 **云监控** + **日志服务 CLS**（Nginx access log、PM2 log）。
5. **WAF**：公网入口建议加 **Web 应用防火墙**，防护 API 滥用。
6. **上传目录**：单机部署时定期备份 `public/uploads`；多实例必须迁移 COS。

---

## 13. 从 Vercel / Supabase 迁移对照

| 原服务 | 腾讯云替代 | 备注 |
|--------|-----------|------|
| Vercel 托管 | **CloudBase 云托管**（推荐）或 CVM + Nginx + PM2 | 见 [cloudbase-deployment.md](./cloudbase-deployment.md) |
| Vercel Cron | CloudBase 云函数定时 / SCF / crontab | 调用时需带 `CRON_SECRET` |
| Supabase Postgres | TencentDB PostgreSQL | 改 `DATABASE_URL` 即可 |
| Supabase Realtime | 保留或自建 WS | 抽奖大屏需单独方案 |
| Supabase Storage | COS | 需改 `stamp-qrcode.ts` 等 |
| 阿里云短信 | 腾讯云 SMS | 需新增 SDK 或适配 env |
| 本地 uploads | COS + CDN | 需改 `/api/upload` |

---

## 14. 常见问题

### Q1：`next build` 报 `Can't resolve 'util/types'` / `pg`

Client Component 不得 import 含 `prisma` 的模块。确保 UI 组件只引用 `*-shared.ts` 等无数据库依赖的文件（参见 `intent-tag-library-shared.ts`、`participant-tags.ts`）。

### Q2：Prisma 连接超时

- 确认 CVM 与 TencentDB **同 VPC**。
- 连接串使用**内网地址**。
- 检查安全组 5432 是否对 CVM 子网放行。

### Q3：小程序 request 失败

- 域名必须 **HTTPS + 备案**。
- 微信公众平台服务器域名与 `TARO_APP_API_URL` 完全一致（不含路径）。
- 正式版 AppID / Secret 与 `WX_MINI_*` 环境变量匹配。

### Q4：上传图片 404

- 确认 Nginx `location /uploads/` 已配置。
- PM2 工作目录为 `apps/web`。
- 多实例场景请迁移 COS。

---

## 15. 相关文件索引

| 文件 | 说明 |
|------|------|
| `docs/cloudbase-deployment.md` | **CloudBase 云托管部署（推荐）** |
| `Dockerfile` | 云托管镜像构建 |
| `cloudbaserc.json` | CloudBase CLI 配置 |
| `apps/web/.env.example` | Web 环境变量模板 |
| `apps/web/vercel.json` | 原 Cron 调度参考 |
| `packages/database/prisma/schema.prisma` | 数据库模型 |
| `connectiq-user/apps/miniprogram/.env.example` | 小程序 API 配置模板 |
| `docs/api-contract-mobile.md` | 移动端 API 契约 |

---

**文档版本：** 2026-06  
**适用代码分支：** `develop`  
**维护：** 部署架构变更时请同步更新本文档。
