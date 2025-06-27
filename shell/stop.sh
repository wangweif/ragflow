#!/bin/bash

echo "正在停止RAGFlow服务..."

# 1. 通过PID文件停止主进程
if [ -f "logs/ragflow.pid" ]; then
    MAIN_PID=$(cat logs/ragflow.pid)
    echo "从PID文件读取主进程ID: $MAIN_PID"
    
    if kill -0 $MAIN_PID 2>/dev/null; then
        echo "正在停止主进程..."
        kill -TERM $MAIN_PID
        
        # 等待优雅退出
        for i in {1..10}; do
            if ! kill -0 $MAIN_PID 2>/dev/null; then
                echo "主进程已优雅退出"
                break
            fi
            echo "等待进程退出... ($i/10)"
            sleep 1
        done
        
        # 如果还没退出，强制杀死
        if kill -0 $MAIN_PID 2>/dev/null; then
            echo "强制终止主进程"
            kill -9 $MAIN_PID
        fi
    else
        echo "主进程已不存在"
    fi
    
    rm -f logs/ragflow.pid
fi

# 2. 停止所有相关进程
echo "停止所有相关进程..."
pkill -f "launch_backend_service.sh"
pkill -f "task_executor.py"
pkill -f "ragflow_server.py"

# 3. 检查并清理端口占用
PORT=9380
echo "检查端口 $PORT 占用情况..."

PID=$(lsof -ti :$PORT 2>/dev/null)
if [ -n "$PID" ]; then
    echo "发现占用端口的进程: $PID"
    lsof -i :$PORT
    echo "终止占用端口的进程..."
    kill -9 $PID
    sleep 1
    
    # 再次检查
    if [ -z "$(lsof -ti :$PORT 2>/dev/null)" ]; then
        echo "✅ 端口 $PORT 已释放"
    else
        echo "❌ 端口 $PORT 仍被占用"
        exit 1
    fi
else
    echo "✅ 端口 $PORT 未被占用"
fi

echo "✅ RAGFlow服务已停止"