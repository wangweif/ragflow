#!/bin/bash

echo "准备启动服务..."

# 1. 首先停止现有服务
echo "停止现有服务..."
bash shell/stop.sh

# 2. 等待进程完全退出
echo "等待进程完全退出..."
sleep 3

# 3. 检查9380端口占用情况
echo "检查9380端口是否被占用..."
if netstat -tuln | grep -q ":9380 "; then
    echo "端口9380仍被占用，强制终止占用进程..."
    PID=$(lsof -t -i:9380)
    if [ -n "$PID" ]; then
        echo "找到占用端口的进程PID: $PID，正在终止..."
        kill -9 $PID
        sleep 2
    fi
fi

# 4. 设置环境变量
echo "激活Python虚拟环境..."
source .venv/bin/activate
export PYTHONPATH=$(pwd)
# export CUDA_VISIBLE_DEVICES=0,1,2,3,4,5,6,7
export CUDA_VISIBLE_DEVICES=''
export WS=10
export MAX_CONTENT_LENGTH=1073741824

# 5. 启动服务
echo "正在启动后端服务..."
nohup bash docker/launch_backend_service.sh > logs/backend.log 2>&1 &

# 6. 保存主进程PID
MAIN_PID=$!
echo $MAIN_PID > logs/ragflow.pid
echo "主进程PID: $MAIN_PID 已保存到 logs/ragflow.pid"

# 7. 等待服务启动完成
echo "后端服务启动中，请等待..."
MAX_WAIT=120
WAIT_INTERVAL=5
TOTAL_WAIT=0

echo "开始检查服务启动状态..."
while [ $TOTAL_WAIT -lt $MAX_WAIT ]; do
    if netstat -tuln | grep -q ":9380 "; then
        echo "✅ 服务已成功启动，端口9380正在监听"
        break
    else
        echo "服务启动中，已等待 $TOTAL_WAIT 秒..."
        sleep $WAIT_INTERVAL
        TOTAL_WAIT=$((TOTAL_WAIT + WAIT_INTERVAL))
    fi
done

# 8. 健康检查
if [ $TOTAL_WAIT -lt $MAX_WAIT ]; then
    echo "尝试检查服务健康状态..."
    sleep 2
    
    if command -v curl &> /dev/null; then
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9380/health 2>/dev/null || echo "失败")
        if [ "$HTTP_STATUS" = "200" ]; then
            echo "✅ 服务健康检查通过！"
        else
            echo "⚠️ 服务健康检查返回状态码: $HTTP_STATUS"
        fi
    fi
    
    echo "✅ 后端服务启动完成"
    echo "日志文件: logs/backend.log"
    echo "PID文件: logs/ragflow.pid"
else
    echo "❌ 服务启动超时，请检查日志"
fi

echo ""
echo "===== 服务状态摘要 ====="
netstat -tuln | grep :9380
echo "======================="