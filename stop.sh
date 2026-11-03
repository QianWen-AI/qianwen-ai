#!/usr/bin/env bash
# QianWen AI Console 停止脚本
# 通过 ss 提取端口 8787 监听 PID 并终止；未运行则幂等返回 0
set -u

PORT=8787

PIDS=$(ss -tlnp | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
if [ -z "$PIDS" ]; then
  echo "QianWen 服务未在运行（端口 $PORT 无监听），无需停止"
  exit 0
fi

echo "正在停止 QianWen 服务 (PID: $(echo "$PIDS" | tr '\n' ' '))..."
kill $PIDS

for i in $(seq 1 15); do
  REMAIN=$(ss -tlnp | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u)
  if [ -z "$REMAIN" ]; then
    echo "QianWen 服务已停止"
    exit 0
  fi
  sleep 0.5
done

echo "优雅停止超时，强制结束剩余进程..." >&2
kill -9 $PIDS
sleep 0.5
echo "QianWen 服务已强制停止"
exit 0
