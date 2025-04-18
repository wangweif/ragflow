#!/bin/bash

echo "准备启动服务..."

# 检查9380端口占用情况
echo "检查9380端口是否被占用..."
if netstat -tuln | grep -q ":9380 "; then
    echo "端口9380已被占用，尝试终止占用进程..."
    # 查找占用9380端口的进程PID
    PID=$(lsof -t -i:9380)
    if [ -n "$PID" ]; then
        echo "找到占用端口的进程PID: $PID，正在终止..."
        kill -9 $PID
        echo "进程已终止"
    else
        echo "无法找到占用端口的进程，但端口显示被占用"
    fi
else
    echo "端口9380未被占用，可以启动服务"
fi

# 等待2秒确保端口完全释放
echo "等待2秒确保端口完全释放..."
sleep 2

# export CUDA_VISIBLE_DEVICES=''
echo "激活Python虚拟环境..."
source .venv/bin/activate
export PYTHONPATH=$(pwd)
# 设置ONNX Runtime在CUDA环境下的内存设置
export ORT_CUDA_PROVIDER_OPTIONS="arena_extend_strategy=kNextPowerOfTwo"
export ORT_CUDA_PROVIDER_OPTIONS="$ORT_CUDA_PROVIDER_OPTIONS;cuda_mem_limit=2147483648"

echo "正在启动后端服务..."
nohup bash docker/launch_backend_service.sh > logs/backend.log 2>&1 &

echo "后端服务启动中，请等待..."

# 检查服务是否成功启动并监听9380端口
MAX_WAIT=60  # 最长等待时间(秒)
WAIT_INTERVAL=5  # 每次检查间隔(秒)
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

if [ $TOTAL_WAIT -ge $MAX_WAIT ]; then
    echo "❌ 警告：服务可能未正常启动，请检查日志文件"
    echo "请执行 'tail -f logs/backend.log' 查看详细日志"
else
    # 尝试检查服务健康状态
    echo "尝试检查服务健康状态..."
    sleep 2  # 再等待2秒确保服务完全就绪
    
    if command -v curl &> /dev/null; then
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9380/health 2>/dev/null || echo "失败")
        if [ "$HTTP_STATUS" = "200" ]; then
            echo "✅ 服务健康检查通过！"
        else
            echo "⚠️ 服务健康检查返回状态码: $HTTP_STATUS (预期200)"
        fi
    else
        echo "未安装curl，跳过健康检查"
    fi
    
    echo "✅ 后端服务启动完成，日志重定向到logs/backend.log"
    echo "可以通过 'tail -f logs/backend.log' 查看运行日志"
fi

# 打印服务状态摘要
echo ""
echo "===== 服务状态摘要 ====="
netstat -tuln | grep :9380
echo "======================="