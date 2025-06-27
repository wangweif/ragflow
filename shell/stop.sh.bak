#!/bin/bash

# 停止所有进程
pkill -f "launch"
pkill -f "rag/svr"

PORT=9380

# 查找占用端口的进程
PID=$(lsof -ti :$PORT)

if [ -z "$PID" ]; then
    echo "No process found using port $PORT"
    exit 0
fi

# 显示进程信息
echo "Processes using port $PORT:"
lsof -i :$PORT

# 杀死进程
echo "Killing process(es) with PID(s): $PID"
kill -9 $PID

# 验证进程是否已被终止
if [ -z "$(lsof -ti :$PORT)" ]; then
    echo "Successfully terminated process(es) using port $PORT"
else
    echo "Failed to terminate all processes using port $PORT"
    exit 1
fi