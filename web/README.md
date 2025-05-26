# 部署配置说明

本项目支持两种不同的部署配置：

## 1. 北京市农林科学院知识库系统

默认配置，主题色为绿色，显示logo，名称为"北京市农林科学院知识库系统"。

## 2. 北京市农业农村局

蓝色主题，不显示logo，名称为"北京市农业农村局专用知识库"。

## 配置方式

本项目使用Umi框架的官方环境配置方式，通过 `UMI_ENV` 环境变量自动加载对应的配置文件：

- `UMI_ENV=bjnl`: 自动加载 `config.bjnl.ts` - 北京市农林科学院知识库系统（默认）
- `UMI_ENV=bjny`: 自动加载 `config.bjny.ts` - 北京市农业农村局专用知识库

## 开发运行

```bash
# 北京市农林科学院知识库系统（默认）
npm run dev:bjnl

# 北京市农业农村局专用知识库
npm run dev:bjny

# 或者直接使用默认启动命令（默认为bjnl）
npm start
```

## 打包部署

```bash
# 北京市农林科学院知识库系统
npm run build:bjnl

# 北京市农业农村局专用知识库
npm run build:bjny
```

## 手动设置环境变量

如果需要手动设置环境变量，可以使用：

```bash
# Windows PowerShell
$env:UMI_ENV="bjny"; npm run dev

# Windows CMD
set UMI_ENV=bjny && npm run dev

# Linux/Mac
UMI_ENV=bjny npm run dev
```