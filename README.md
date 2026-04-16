# Cloudflare Email Worker

接收邮件并存储到 D1 数据库，通过 HTTP API 查询邮件内容。

## 快速部署

### 前置条件

1. 安装 [Node.js](https://nodejs.org/)（>= 18）
2. 登录 Wrangler CLI：

```bash
npx wrangler login
```

浏览器会自动打开 Cloudflare OAuth 授权页面，完成登录后终端会提示 `Successfully logged in`。


### 一键部署

```bash
./deploy.sh
```

或手动执行：

```bash
npm install
npx wrangler d1 create email-db          # 创建数据库（首次）
# 将返回的 database_id 填入 wrangler.jsonc
npx wrangler d1 execute email-db --remote --file=schema.sql  # 建表
npx wrangler deploy                       # 部署 Worker
```

## 配置邮件路由

部署后需在 Cloudflare Dashboard 中配置 Email Routing，将目标域名的邮件路由到此 Worker：

1. 进入 Dashboard → 选择域名 → Email → Email Routing
2. 在 Routing rules 中添加规则，Action 选择 "Send to a Worker"，选择 `email-worker`

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
