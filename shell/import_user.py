#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
从Excel文件导入用户数据脚本
用法: python import_user.py [--file <excel_file_path>]
"""

import os
import sys
import argparse
import logging
import uuid
import pandas as pd
from typing import Dict, Any, Optional, List
import json
from datetime import datetime
import re

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

# 导入初始化设置模块
from api.settings import init_settings

# 先初始化设置
init_settings()

# 导入其他需要的模块
from api.db.init_data import init_custom_admin, init_llm_factory, encode_to_base64
from api.db.db_models import init_database_tables as init_web_db
from api.db.services.user_service import UserService, TenantService, UserTenantService
from api.db.services.team_service import TeamService
from api.db.db_models_extension import Team
from api.db import UserTenantRole, StatusEnum

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
    parser = argparse.ArgumentParser(description='从Excel文件导入用户数据')
    parser.add_argument('--file', default='docs/user.xlsx', help='Excel文件路径(默认: docs/user.xlsx)')
    return parser.parse_args()

def get_admin_tenant_info(admin_email="admin@bjzntd.com"):
    """
    获取管理员账号的租户信息
    
    Args:
        admin_email: 管理员邮箱
        
    Returns:
        管理员账号的租户信息 (tenant_id, admin_id)
    """
    # 查询管理员账号
    admin_user = UserService.get_by_email(admin_email)
    if not admin_user:
        logger.error(f"管理员账号 {admin_email} 不存在，请先创建管理员账号")
        return None, None
    
    admin_id = admin_user.id
    
    # 查询管理员的租户信息
    tenant_id = admin_id  # 默认情况下，租户ID等于管理员用户ID
    
    return tenant_id, admin_id

def create_or_get_team(team_name, tenant_id, created_by):
    """
    创建部门（团队），如果已存在则返回现有部门信息
    
    Args:
        team_name: 部门名称
        tenant_id: 租户ID
        created_by: 创建者ID
        
    Returns:
        部门信息 (team_id, team_info)
    """
    try:
        # 确保部门名称不为空
        if not team_name or team_name.strip() == "":
            logger.error("部门名称不能为空")
            return None, None

        team_name = team_name.strip()
        logger.info(f"处理部门: '{team_name}', 长度: {len(team_name)}")
        
        # 查找现有团队
        logger.info(f"查询租户ID={tenant_id}下的所有团队")
        teams = TeamService.list_teams_by_tenant(tenant_id)
        logger.info(f"查询到{len(teams)}个团队")
        
        # 检查是否已存在同名团队
        for team in teams:
            if team['name'] == team_name:
                logger.info(f"部门 '{team_name}' 已存在，ID: {team['id']}")
                return team['id'], team
        
        # 处理特殊字符，但保留原始长度
        cleaned_name = re.sub(r'[^\w\s\u4e00-\u9fa5\-\+\.\,\，\。]', '_', team_name)
        if cleaned_name != team_name:
            logger.info(f"部门名称已清理特殊字符: '{team_name}' -> '{cleaned_name}'")
            team_name = cleaned_name
        
        # 创建新团队
        logger.info(f"创建新部门: '{team_name}'")
        team_info = TeamService.create_team(
            tenant_id=tenant_id,
            name=team_name,
            created_by=created_by,
            description=f"{team_name}部门"
        )
        logger.info(f"部门 '{team_name}' 创建成功，ID: {team_info['id']}")
        return team_info['id'], team_info
    except ValueError as e:
        # 处理可能的ValueError，比如部门名称已存在
        error_msg = str(e)
        logger.error(f"创建部门 '{team_name}' 失败 (ValueError): {error_msg}")
        
        # 如果是因为部门已存在的错误，尝试再次获取部门信息
        if "已存在" in error_msg:
            try:
                logger.info("检测到部门已存在错误，尝试重新获取部门")
                teams = TeamService.list_teams_by_tenant(tenant_id)
                for team in teams:
                    if team['name'] == team_name:
                        logger.info(f"找到已存在的部门 '{team_name}'，ID: {team['id']}")
                        return team['id'], team
            except Exception as inner_e:
                logger.error(f"尝试获取已存在的部门 '{team_name}' 失败: {str(inner_e)}")
        
        # 尝试使用一个带时间戳的唯一名称
        try:
            unique_suffix = datetime.now().strftime("%m%d%H%M%S") + "_" + str(uuid.uuid4())[:8]
            unique_name = f"{team_name}_{unique_suffix}"
            logger.info(f"尝试使用唯一名称创建部门: '{unique_name}'")
            
            team_info = TeamService.create_team(
                tenant_id=tenant_id,
                name=unique_name,
                created_by=created_by,
                description=f"{team_name}部门"
            )
            logger.info(f"使用唯一名称 '{unique_name}' 成功创建部门，ID: {team_info['id']}")
            return team_info['id'], team_info
        except Exception as retry_e:
            logger.error(f"使用唯一名称创建部门失败: {str(retry_e)}")
            return None, None
    except Exception as e:
        logger.error(f"创建部门 '{team_name}' 失败: {str(e)}, 类型: {type(e)}")
        return None, None

def detect_column_mapping(df):
    """
    使用固定的列名映射，基于截图中的表头
    
    Args:
        df: pandas DataFrame对象
        
    Returns:
        列映射字典
    """
    # 固定的列名映射，基于提供的截图
    fixed_mapping = {
        'email': '账号',         # 表头中的"账号"字段
        'name': '姓名',          # 表头中的"姓名"字段
        'team': '部门',          # 表头中的"部门"字段
        'phone': '手机号码',      # 表头中的"手机号码"字段
        'user_type': '人员类型',  # 表头中的"人员类型"字段
        'note': '备注',          # 表头中的"备注"字段
    }
    
    # 验证所有必要的列是否都存在
    columns = df.columns.tolist()
    logger.info(f"检测到表格列: {columns}")
    
    # 检查必要字段是否存在
    required_fields = ['email', 'name', 'team']
    missing_columns = []
    
    for field in required_fields:
        column_name = fixed_mapping[field]
        if column_name not in columns:
            missing_columns.append(column_name)
    
    if missing_columns:
        logger.error(f"Excel文件缺少必要的列: {', '.join(missing_columns)}")
        logger.error(f"可用的列名: {', '.join(columns)}")
        return None
    
    logger.info(f"使用固定列映射: {fixed_mapping}")
    return fixed_mapping

def read_excel_data(file_path):
    """
    读取Excel文件数据
    
    Args:
        file_path: Excel文件路径
        
    Returns:
        (DataFrame, 列映射): Excel数据和列映射
    """
    try:
        if not os.path.exists(file_path):
            logger.error(f"文件不存在: {file_path}")
            return None, None
            
        # 使用pandas读取Excel文件
        df = pd.read_excel(file_path)
        
        # 检测列映射
        column_mapping = detect_column_mapping(df)
        if column_mapping is None:
            return None, None
            
        return df, column_mapping
    except Exception as e:
        logger.error(f"读取Excel文件失败: {str(e)}")
        return None, None

def main():
    """主函数"""
    try:
        # 设置日志
        setup_logging()
        
        # 解析命令行参数
        args = parse_args()
        
        # 打印开始信息
        logger.info(f"开始导入用户数据")
        
        # 确保数据库表已初始化
        logger.info("初始化数据库表...")
        init_web_db()
        
        # 初始化LLM工厂
        logger.info("初始化LLM工厂...")
        init_llm_factory()
        
        # 获取管理员租户信息
        logger.info("获取管理员租户信息...")
        tenant_id, admin_id = get_admin_tenant_info()
        if not tenant_id or not admin_id:
            logger.error("未找到管理员租户信息，请先运行create_custom_admin.py创建管理员账号")
            return 1
            
        logger.info(f"成功获取租户信息: 租户ID={tenant_id}, 管理员ID={admin_id}")
        
        # 读取Excel文件
        logger.info(f"读取Excel文件: {args.file}")
        df, column_mapping = read_excel_data(args.file)
        if df is None or column_mapping is None:
            return 1
        
        # 移除所有的空行
        initial_count = len(df)
        df = df.dropna(subset=[column_mapping['email'], column_mapping['name'], column_mapping['team']], how='any')
        cleaned_count = len(df)
        
        if initial_count != cleaned_count:
            logger.info(f"移除了{initial_count - cleaned_count}行空数据，实际有效记录数为{cleaned_count}条")
        
        logger.info(f"成功读取Excel文件，共{cleaned_count}条有效记录")
        
        # 处理用户数据并导入
        created_count = 0
        failed_count = 0
        skipped_count = 0
        
        # 收集失败的详细信息
        failed_users = []
        # 用于记录处理每行的结果
        processed_results = {}
        
        for index, row in df.iterrows():
            row_key = f"第{index+2}行"  # Excel中行号从1开始，且有表头
            
            email = row[column_mapping['email']].strip() if isinstance(row[column_mapping['email']], str) else row[column_mapping['email']]
            name = row[column_mapping['name']].strip() if isinstance(row[column_mapping['name']], str) else row[column_mapping['name']]
            team = row[column_mapping['team']].strip() if isinstance(row[column_mapping['team']], str) else row[column_mapping['team']]
            
            # 获取电话号码，如果存在的话
            phone = None
            if 'phone' in column_mapping:
                phone_value = row[column_mapping['phone']]
                if not pd.isna(phone_value):
                    phone = str(phone_value).strip()
            
            # 获取人员类型，如果存在的话
            user_type = None
            if 'user_type' in column_mapping:
                user_type_value = row[column_mapping['user_type']]
                if not pd.isna(user_type_value):
                    user_type = str(user_type_value).strip()
            
            # 获取备注，如果存在的话
            note = None
            if 'note' in column_mapping:
                note_value = row[column_mapping['note']]
                if not pd.isna(note_value):
                    note = str(note_value).strip()
            
            # 跳过空行
            if not email or pd.isna(email) or not name or pd.isna(name) or not team or pd.isna(team):
                logger.warning(f"跳过{row_key}: 邮箱、姓名或部门为空")
                processed_results[row_key] = "跳过: 关键字段为空"
                skipped_count += 1
                continue
            
            # 检查用户是否已存在
            existing_user = UserService.get_by_email(email)
            if existing_user:
                logger.info(f"用户 {email} ({name}) 已存在，跳过")
                processed_results[row_key] = "跳过: 用户已存在"
                skipped_count += 1
                continue
                
            logger.info(f"处理用户: {email} ({name}), 部门: {team}, 类型: {user_type or '无'}, 电话: {phone or '无'}, 备注: {note or '无'}")
            
            # 创建或获取部门（团队）
            team_id, team_info = create_or_get_team(team, tenant_id, admin_id)
            if not team_id:
                error_msg = f"无法为用户 {email} 创建或获取部门 {team}"
                logger.error(error_msg)
                processed_results[row_key] = f"失败: {error_msg}"
                failed_users.append({
                    "row": row_key,
                    "email": email,
                    "name": name,
                    "team": team,
                    "error": error_msg
                })
                failed_count += 1
                continue
                
            # 使用TeamService添加团队成员（将自动创建用户并建立关联）
            try:
                # 创建用户记录
                user = UserService.create_user(
                    email=email,
                    nickname=name,
                    password=encode_to_base64("123456"),
                    team_id=team_id,
                    role="member",
                    tenant_id=tenant_id
                )
                
                # 创建用户与租户的关联
                UserTenantService.save(
                    user_id=user.id,
                    tenant_id=tenant_id,
                    role=UserTenantRole.NORMAL,
                    invited_by=tenant_id,
                    status=StatusEnum.VALID.value
                )
                
                logger.info(f"成功创建用户: {email} ({name}), 角色: member, 部门: {team}, 电话: {phone or '无'}")
                processed_results[row_key] = "创建成功"
                created_count += 1
            except Exception as e:
                error_msg = str(e)
                logger.error(f"创建用户 {email} 失败: {error_msg}")
                processed_results[row_key] = f"失败: {error_msg}"
                failed_users.append({
                    "row": row_key,
                    "email": email,
                    "name": name,
                    "team": team,
                    "error": error_msg
                })
                failed_count += 1
        
        # 打印导入结果
        logger.info(f"用户导入完成!")
        logger.info(f"Excel文件中的记录数: {initial_count} 条")
        logger.info(f"有效记录数: {cleaned_count} 条")
        logger.info(f"成功创建: {created_count} 条")
        logger.info(f"已跳过: {skipped_count} 条")
        logger.info(f"失败: {failed_count} 条")
        logger.info(f"总计处理: {created_count + skipped_count + failed_count} 条")
        
        # 检查总数是否匹配
        total_processed = created_count + skipped_count + failed_count
        if total_processed != cleaned_count:
            logger.warning(f"警告: 处理的记录总数 ({total_processed}) 与有效记录数 ({cleaned_count}) 不匹配!")
            logger.info("详细记录处理情况:")
            for row_key, result in sorted(processed_results.items()):
                logger.info(f"{row_key}: {result}")
        
        # 打印失败详情
        if failed_count > 0:
            logger.info("===== 失败详情 =====")
            for i, user in enumerate(failed_users, 1):
                logger.info(f"[{i}] {user.get('row', '未知行')}: 用户: {user['name']}({user['email']}), 部门: {user['team']}")
                logger.info(f"    错误: {user['error']}")
            logger.info("===================")
        
        return 0
    except Exception as e:
        logger.error(f"导入用户数据失败: {str(e)}")
        import traceback
        logger.error(f"错误详情: {traceback.format_exc()}")
        return 1

if __name__ == '__main__':
    sys.exit(main())
