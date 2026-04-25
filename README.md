# Cloudflare Email Worker

接收邮件并存储到 [D1 数据库](https://developers.cloudflare.com/d1/)，通过 HTTP API 查询、删除和发送邮件。

## 快速部署

### 前置条件

1. 安装 [Node.js](https://nodejs.org/)（>= 18）
2. 拥有 [Cloudflare 账号](https://dash.cloudflare.com/sign-up) 并将域名托管在 Cloudflare
3. 登录 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)：

```bash
npx wrangler login
```

浏览器会自动打开 [Cloudflare OAuth 授权页面](https://developers.cloudflare.com/workers/wrangler/commands/#login)，完成登录后终端会提示 `Successfully logged in`。

### 一键部署

```bash
./deploy.sh
```

或手动执行：

```bash
npm install
npx wrangler d1 create email-db          # 创建 D1 数据库（首次）
# 将返回的 database_id 填入 wrangler.jsonc
npx wrangler d1 execute email-db --remote --file=schema.sql  # 建表
npx wrangler deploy                       # 部署 Worker
```

> 详见 [D1 快速入门](https://developers.cloudflare.com/d1/get-started/) 和 [Workers 部署文档](https://developers.cloudflare.com/workers/get-started/guide/)。

## 配置邮件路由

部署后需在 Cloudflare Dashboard 中配置 [Email Routing](https://developers.cloudflare.com/email-routing/)，将目标域名的邮件路由到此 Worker：

1. 进入 [Dashboard](https://dash.cloudflare.com/) → 选择域名 → **Email** → **Email Routing**
2. 在 **Routing rules** 中添加规则，Action 选择 "Send to a Worker"，选择 `email-worker`

> 详见 [Email Routing 配置文档](https://developers.cloudflare.com/email-routing/setup/) 和 [Email Workers 文档](https://developers.cloudflare.com/email-routing/email-workers/)。

## 配置邮件发送

发送邮件功能使用 Cloudflare 的 [Send Email 绑定](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/)，需满足：

1. `from` 地址所在域名已在 Cloudflare [Email Routing](https://developers.cloudflare.com/email-routing/setup/) 中完成验证
2. `wrangler.jsonc` 中已配置 `send_email` 绑定（默认已配置）

## API 说明

### 查询邮件列表

**GET** `/api/emails`  
**POST** `/api/emails`（JSON body）

| 参数 | 类型 | 说明 |
|------|------|------|
| `from` | string | 发件人地址（精确匹配） |
| `to` | string | 收件人地址（精确匹配） |
| `subject` | string | 主题关键词（模糊匹配） |
| `minutes` | number | 最近 X 分钟内的邮件 |
| `search` | string | 全文搜索（主题 + 正文） |
| `limit` | number | 返回数量，默认 50，最大 200 |
| `offset` | number | 偏移量，默认 0 |

默认按收件时间倒序返回，最新邮件排在最前面。

**示例：**

```bash
# GET 查询
curl "https://email-worker.YOUR_SUBDOMAIN.workers.dev/api/emails?to=me@example.com&minutes=10"

# POST 查询
curl -X POST "https://email-worker.YOUR_SUBDOMAIN.workers.dev/api/emails" \
  -H "Content-Type: application/json" \
  -d '{"from": "noreply@example.com", "subject": "验证码", "minutes": 5}'
```

### 查询单封邮件

**GET** `/api/emails/:id`

```bash
curl "https://email-worker.YOUR_SUBDOMAIN.workers.dev/api/emails/1"
```

### 删除全部邮件

**GET** `/api/emails/delete`

```bash
curl "https://email-worker.YOUR_SUBDOMAIN.workers.dev/api/emails/delete"
```

### 发送（回复）邮件

**POST** `/api/emails/send`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `from` | string | 是 | 发件人地址（须为已验证域名下的地址） |
| `to` | string | 是 | 收件人地址 |
| `subject` | string | 是 | 邮件主题 |
| `body` | string | 是 | 邮件正文（纯文本） |
| `inReplyTo` | string | 否 | 原邮件 Message-ID（用于回复时设置线程关联） |

```bash
# 发送邮件
curl -X POST "https://email-worker.YOUR_SUBDOMAIN.workers.dev/api/emails/send" \
  -H "Content-Type: application/json" \
  -d '{"from": "noreply@yourdomain.com", "to": "user@example.com", "subject": "Hello", "body": "你好！"}'

# 回复邮件（设置 inReplyTo 关联原邮件）
curl -X POST "https://email-worker.YOUR_SUBDOMAIN.workers.dev/api/emails/send" \
  -H "Content-Type: application/json" \
  -d '{"from": "noreply@yourdomain.com", "to": "user@example.com", "subject": "Re: Hello", "body": "收到，谢谢！", "inReplyTo": "<original-message-id@example.com>"}'
```

> **注意**：发送邮件需要 `from` 地址所在域名已在 Cloudflare [Email Routing](https://developers.cloudflare.com/email-routing/setup/) 中完成验证，详见[发送邮件文档](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/)。

## 数据库结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER | 自增主键 |
| `message_id` | TEXT | 邮件 Message-ID |
| `sender` | TEXT | 发件人 |
| `recipient` | TEXT | 收件人 |
| `subject` | TEXT | 主题 |
| `body` | TEXT | 正文内容 |
| `received_at` | TEXT | 收件时间（ISO 8601） |
