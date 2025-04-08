#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
创建自定义管理员用户的脚本
用法: python create_custom_admin.py --email <email> --nickname <nickname>
"""

import os
import sys
import argparse
import logging

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.db.init_data import init_custom_admin

logger = logging.getLogger(__name__)
def setup_logging():
    """设置日志配置"""
    # 创建控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    # 设置日志格式
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    
    # 添加处理器到日志记录器
    logger.addHandler(console_handler)
    logger.setLevel(logging.INFO)

def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='创建自定义管理员用户')
    parser.add_argument('--email', required=True, help='管理员邮箱')
    parser.add_argument('--nickname', required=True, help='管理员昵称')
    parser.add_argument('--tenant_name', help='租户名称（可选）')
    parser.add_argument('--role', default='owner', help='用户角色（默认为owner）')
    return parser.parse_args()

def main():
    """主函数"""
    try:
        # 设置日志
        setup_logging()
        
        # 解析命令行参数
        args = parse_args()
        
        # 打印开始信息
        logger.info(f"开始创建管理员用户: {args.email}")
        
        # 调用初始化函数创建管理员
        user = init_custom_admin(
            email=args.email,
            nickname=args.nickname,
            tenant_name=args.tenant_name,
            role=args.role
        )
        
        if user:
            # 打印成功信息
            logger.info(f"管理员用户创建成功: {user.id}")
            logger.info(f"邮箱: {user.email}")
            logger.info(f"昵称: {user.nickname}")
            logger.info(f"租户ID: {user.id}")  # 租户ID等于用户ID
            logger.info(f"角色: {user.role}")
            logger.info(f"密码: admin (请登录后修改密码)")
            return 0
        else:
            logger.error("创建管理员用户失败")
            return 1
    except Exception as e:
        logger.error(f"创建管理员用户失败: {str(e)}")
        return 1

if __name__ == '__main__':
    sys.exit(main()) 