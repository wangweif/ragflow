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
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

# 导入初始化设置模块
from api.settings import init_settings

# 先初始化设置
init_settings()

# 导入其他需要的模块
from api.db.init_data import init_custom_admin, init_llm_factory
from api.db.db_models import init_database_tables as init_web_db

logger = logging.getLogger(__name__)

def setup_logging():
    """设置日志配置"""
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    
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
        
        # 确保数据库表已初始化
        logger.info("初始化数据库表...")
        init_web_db()
        
        # 初始化LLM工厂
        logger.info("初始化LLM工厂...")
        init_llm_factory()
        
        # 调用初始化函数创建管理员
        user = init_custom_admin(
            email=args.email,
            nickname=args.nickname,
            tenant_name=args.tenant_name,
            role=args.role
        )
        
        if user:
            # 打印成功信息
            if isinstance(user, tuple):
                # 如果返回的是元组，取第一个元素作为用户对象
                user_obj = user[0]
                logger.info(f"管理员用户创建成功: {user_obj.id}")
                logger.info(f"邮箱: {user_obj.email}")
                logger.info(f"昵称: {user_obj.nickname}")
                logger.info(f"租户ID: {user_obj.id}")  # 租户ID等于用户ID
                logger.info(f"角色: {user_obj.role if hasattr(user_obj, 'role') else 'owner'}")
            else:
                # 如果返回的是单个对象
                logger.info(f"管理员用户创建成功: {user.id}")
                logger.info(f"邮箱: {user.email}")
                logger.info(f"昵称: {user.nickname}")
                logger.info(f"租户ID: {user.id}")  # 租户ID等于用户ID
                logger.info(f"角色: {user.role if hasattr(user, 'role') else 'owner'}")
            
            logger.info(f"密码: admin (请登录后修改密码)")
            return 0
        else:
            logger.error("创建管理员用户失败")
            return 1
    except Exception as e:
        logger.error(f"创建管理员用户失败: {str(e)}")
        import traceback
        logger.error(f"错误详情: {traceback.format_exc()}")
        return 1

if __name__ == '__main__':
    sys.exit(main()) 