#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 打印带颜色的消息
echo_color() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# 检查命令是否存在
check_command() {
  if ! command -v $1 &> /dev/null; then
    echo_color $RED "错误: 找不到 $1 命令，请先安装."
    exit 1
  fi
}

# 检查必要的命令
check_command git

# 打印帮助信息
print_help() {
  echo "使用方法: $0 [选项]"
  echo "选项:"
  echo "  -h, --help          显示此帮助信息"
  echo "  -b, --branch        指定分支名，默认为 'main'"
  echo "  -u, --upstream-url  上游仓库的 URL，默认为 'https://github.com/infiniflow/ragflow.git'"
  echo ""
  echo "示例:"
  echo "  $0 -b develop"
}

# 默认参数
UPSTREAM_URL="https://github.com/infiniflow/ragflow.git"
BRANCH="main"

# 解析命令行参数
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      print_help
      exit 0
      ;;
    -b|--branch)
      BRANCH="$2"
      shift 2
      ;;
    -u|--upstream-url)
      UPSTREAM_URL="$2"
      shift 2
      ;;
    *)
      echo_color $RED "未知参数: $1"
      print_help
      exit 1
      ;;
  esac
done

# 检查是否有 upstream 远程仓库
UPSTREAM_EXISTS=$(git remote | grep upstream || echo "")
if [ -z "$UPSTREAM_EXISTS" ]; then
  echo_color $BLUE "添加 upstream 远程仓库..."
  git remote add upstream "$UPSTREAM_URL"
else
  # 确保 upstream URL 正确
  CURRENT_UPSTREAM=$(git remote get-url upstream 2>/dev/null || echo "")
  if [ "$CURRENT_UPSTREAM" != "$UPSTREAM_URL" ]; then
    echo_color $BLUE "更新 upstream 远程仓库..."
    git remote set-url upstream "$UPSTREAM_URL"
  fi
fi

# 获取最新变化
echo_color $BLUE "获取 fork 仓库(origin)的最新变化..."
git fetch origin

echo_color $BLUE "获取上游仓库(upstream)的最新变化..."
git fetch upstream

# 确保在正确的分支上
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo_color $YELLOW "当前在 '$CURRENT_BRANCH' 分支，切换到 '$BRANCH' 分支..."
  git checkout "$BRANCH"
fi

# 获取上游更新的详细信息
echo_color $BLUE "分析上游仓库 '$BRANCH' 分支的更新..."
COMMITS_BEHIND=$(git rev-list --count HEAD..upstream/$BRANCH)
COMMITS_AHEAD=$(git rev-list --count upstream/$BRANCH..HEAD)

echo_color $GREEN "状态: 你的 '$BRANCH' 分支落后上游 $COMMITS_BEHIND 个提交，领先 $COMMITS_AHEAD 个提交。"

# 显示最近的 upstream 提交
# echo_color $BLUE "上游仓库 '$BRANCH' 分支的最近10个提交:"
# git log --oneline -n 10 upstream/$BRANCH

# echo ""
# if [ $COMMITS_BEHIND -gt 0 ]; then
#   echo_color $YELLOW "你可以查看本地分支与上游分支的具体差异:"
#   echo "git diff HEAD..upstream/$BRANCH --name-status  # 查看文件变化"
#   echo "git log HEAD..upstream/$BRANCH --oneline  # 查看提交日志"
#   echo ""
#   echo_color $YELLOW "要同步上游更改但不合并，可以使用以下命令:"
#   echo "git fetch upstream $BRANCH  # 只获取上游更改"
#   echo ""
#   echo_color $YELLOW "要手动合并上游更改到当前分支，可以使用以下命令:"
#   echo "git merge upstream/$BRANCH  # 直接合并"
#   echo "或"
#   echo "git checkout -b merge-upstream  # 创建新分支合并"
#   echo "git merge upstream/$BRANCH"
#   echo ""
#   echo_color $YELLOW "要将本地更改推送到你的 fork，可以使用以下命令:"
#   echo "git push origin $BRANCH"
# fi

echo ""
echo_color $GREEN "完成! 已同步仓库信息。你可以手动比对和合并变化。"
