# 部署配置说明

本项目支持两种不同的部署配置：

## 1. 北京市农林科学院知识库系统

默认配置，主题色为绿色，显示logo，名称为"北京市农林科学院知识库系统"。

## 2. 北京市农业农村局

蓝色主题，不显示logo，名称为"北京市农业农村局"。

## 环境变量配置

通过环境变量 `DEPLOY_TYPE` 控制不同的部署类型：

- `DEPLOY_TYPE=bjnl`: 北京市农林科学院知识库系统（默认）
- `DEPLOY_TYPE=bjny`: 北京市农业农村局

## 部署方法

### 方法一：使用配置文件

1. 根据需要，复制对应的环境变量文件：

```bash
# 北京市农林科学院知识库系统
cp .env.bjnl .env

# 或者北京市农业农村局
cp .env.bjny .env
```

2. 启动应用

```bash
npm run dev
```

### 方法二：直接设置环境变量

```bash
# Windows PowerShell
$env:DEPLOY_TYPE="bjny"; npm run dev

# Windows CMD
set DEPLOY_TYPE=bjny && npm run dev

# Linux/Mac
DEPLOY_TYPE=bjny npm run dev
```

## 打包部署

```bash
# 北京市农林科学院知识库系统
DEPLOY_TYPE=bjnl npm run build

# 北京市农业农村局
DEPLOY_TYPE=bjny npm run build
``` 