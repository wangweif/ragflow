#!/bin/bash

export CUDA_VISIBLE_DEVICES=''
source .venv/bin/activate
export PYTHONPATH=$(pwd)

docker/launch_backend_service.sh > logs/backend.log 2>&1 &

echo "Backend service started"