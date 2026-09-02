#!/usr/bin/env bash
# QianWen AI Console 启动脚本
# 端口固定 8787；已启动则返回 0；启动成功返回 0；启动失败返回 2
set -u

PORT=8787
ROOT="/workspace"
WORKDIR="$ROOT/backend"
FRONTEND="$ROOT/frontend"
LOG_DIR="$ROOT/logs"
SERVER_LOG="$LOG_DIR/server.log"
PID_FILE="$LOG_DIR/server.pid"
MAX_WAIT=30

mkdir -p "$LOG_DIR"

# 1. 已启动则直接返回 0
PIDS=$(ss -tlnp | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
if [ -n "$PIDS" ]; then
  echo "QianWen 服务已在运行 (PID: $(echo "$PIDS" | tr '\n' ' '))，端口 $PORT，无需重复启动"
  exit 0
fi

# 2. 启动前清理构建缓存，并确保生产构建产物存在
if [ -d "$FRONTEND/node_modules/.vite" ]; then
  echo "清理 Vite 构建缓存..."
  rm -rf "$FRONTEND/node_modules/.vite"
fi
if [ ! -f "$FRONTEND/dist/index.html" ]; then
  echo "前端未构建，先执行生产构建..."
  (cd "$FRONTEND" && npm run build) || {
    echo "前端构建失败，服务无法启动" >&2
    exit 2
  }
fi

# 3. 后台启动服务（生产模式，限制内存防 OOM）
#    注意：环境变量必须用 export 先行设置，不能写成 nohup MODE=xxx node ...
echo "正在启动 QianWen 服务（端口 $PORT）..."
export MODE=online
cd "$WORKDIR" || exit 2
nohup node --max-old-space-size=512 server.mjs > "$SERVER_LOG" 2>&1 &
echo $! > "$PID_FILE"

# 4. 等待服务就绪
for i in $(seq 1 "$MAX_WAIT"); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/health" || echo 000)
  if [ "$code" = "200" ]; then
    echo "QianWen 服务启动成功：http://localhost:$PORT （PID: $(cat "$PID_FILE")）"
    exit 0
  fi
  sleep 1
done

echo "QianWen 服务启动失败，请查看日志：$SERVER_LOG" >&2
exit 2
