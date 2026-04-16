#!/bin/bash
set -e

echo "=== Cloudflare Email Worker 部署脚本 ==="

# 如果 wrangler.jsonc 不存在，从 example 复制
if [ ! -f wrangler.jsonc ]; then
  echo ">> 从 wrangler.jsonc.example 创建 wrangler.jsonc..."
  cp wrangler.jsonc.example wrangler.jsonc
fi

# 安装依赖
echo ">> 安装依赖..."
npm install

# 检查数据库是否存在
echo ">> 检查 D1 数据库..."
DB_EXISTS=$(npx wrangler d1 list 2>/dev/null | grep -c "email-db" || true)

if [ "$DB_EXISTS" -eq 0 ]; then
  echo ">> 创建 D1 数据库 email-db..."
  DB_OUTPUT=$(npx wrangler d1 create email-db 2>&1)
  echo "$DB_OUTPUT"

  # 提取 database_id 并更新 wrangler.jsonc
  DB_ID=$(echo "$DB_OUTPUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
  if [ -n "$DB_ID" ]; then
    echo ">> 更新 wrangler.jsonc 中的 database_id: $DB_ID"
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/\"database_id\": \"[^\"]*\"/\"database_id\": \"$DB_ID\"/" wrangler.jsonc
    else
      sed -i "s/\"database_id\": \"[^\"]*\"/\"database_id\": \"$DB_ID\"/" wrangler.jsonc
    fi
  fi
else
  echo ">> D1 数据库 email-db 已存在，跳过创建。"
fi

# 执行建表 SQL
echo ">> 执行数据库迁移..."
npx wrangler d1 execute email-db --remote --file=schema.sql 2>&1 || echo ">> 表可能已存在，继续部署..."

# 部署 Worker
echo ">> 部署 Worker..."
npx wrangler deploy

echo "=== 部署完成 ==="
echo "请在 Cloudflare Dashboard 中配置 Email Routing 将邮件路由到 email-worker"
