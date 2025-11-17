#!/usr/bin/env bash
set -euo pipefail

export FRONTEND_PORT=${FRONTEND_PORT:-8888}
export SQLITE_DB_PATH=${SQLITE_DB_PATH:-./data/xcodereviewer.db}
export CORS_ORIGIN=${CORS_ORIGIN:-*}
export JWT_SECRET=${JWT_SECRET:-xcodereviewer-secret}
export VITE_API_BASE_URL=${VITE_API_BASE_URL:-/api}
export VITE_USE_LOCAL_DB=${VITE_USE_LOCAL_DB:-false}

echo "📦 使用以下配置启动 Docker Compose："
echo "  FRONTEND_PORT=${FRONTEND_PORT}"
echo "  SQLITE_DB_PATH=${SQLITE_DB_PATH}"
echo "  CORS_ORIGIN=${CORS_ORIGIN}"
echo "  JWT_SECRET=${JWT_SECRET}"
echo "  VITE_API_BASE_URL=${VITE_API_BASE_URL}"

docker compose up -d --build "$@"
