#!/usr/bin/env bash
set -euo pipefail

echo "🚀 启动后端 API (pnpm server)…"
pnpm server &
API_PID=$!

cleanup() {
  if ps -p "${API_PID}" >/dev/null 2>&1; then
    echo "🧹 停止后端 API (PID: ${API_PID})"
    kill "${API_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

sleep 2
if ! ps -p "${API_PID}" >/dev/null 2>&1; then
  echo "❌ 后端 API 启动失败，请检查日志"
  exit 1
fi

echo "🌐 启动前端开发服务器 (pnpm dev)…"
pnpm dev
