#!/bin/bash

export CUDA_VISIBLE_DEVICES=''
source .venv/bin/activate
export PYTHONPATH=$(pwd)

bash docker/launch_backend_service.sh

echo "Backend service started"