#
#  Copyright 2024 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#

import logging
from flask import Blueprint, request
from flask_login import login_required, current_user

from api import settings
from api.db.services.team_service import TeamService
from api.db.services.user_service import UserService
from api.utils.api_utils import get_json_result, validate_request, server_error_response, get_data_error_result
from api.db import StatusEnum, UserTenantRole
from api.utils import current_timestamp, datetime_format
from datetime import datetime
from api.utils.remote_user_client import RemoteUserClient
from api.db.services.user_service import UserTenantService

logger = logging.getLogger(__name__)

# 定义应用名称和蓝图
page_name = "team"
manager = Blueprint('team', __name__)


@manager.route('/list', methods=['GET'])
@login_required
def list_teams():
    """获取团队列表"""
    try:
        tenant_id = request.args.get('tenant_id')
        if not tenant_id:
            return get_data_error_result(message="租户ID不能为空")
        
        # 如果是租户管理员，则获取所有团队
        if tenant_id == current_user.id:
            teams = TeamService.list_teams_by_tenant(tenant_id)
            return get_json_result(data=teams)
        return get_json_result(data=[])
        
    except Exception as e:
        logger.exception(f"获取团队列表失败: {str(e)}")
        return server_error_response(e)


@manager.route('', methods=['POST'])
@login_required
@validate_request("tenant_id", "name")
def create_team():
    """创建团队"""
    try:
        data = request.json
        tenant_id = data.get('tenant_id')
        name = data.get('name')
        description = data.get('description', None)  # 使用get方法设置默认值为None
        parent_id = data.get('parent_id', None)  # 父团队ID，可选
        
        # 确保parent_id是字符串类型
        if parent_id is not None:
            parent_id = str(parent_id)
        
        # 验证权限，只有租户管理员才能创建团队
        if tenant_id != current_user.id:
            return get_json_result(
                data=False,
                message='没有创建团队的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        team = TeamService.create_team(
            tenant_id=tenant_id,
            name=name,
            created_by=current_user.id,
            description=description,
            parent_id=parent_id
        )
        
        return get_json_result(data=team)
    except ValueError as e:
        return get_data_error_result(message=str(e))
    except Exception as e:
        logger.exception(f"创建团队失败: {str(e)}")
        return server_error_response(e)


@manager.route('/<team_id>', methods=['POST'])
@login_required
def update_team(team_id):
    """更新团队信息"""
    try:
        data = request.json
        name = data.get('name')
        description = data.get('description')
        
        # 获取团队信息
        team_info = TeamService.get_team(team_id)
        if not team_info:
            return get_data_error_result(message="团队不存在")
        
        # 验证权限，只有租户管理员或团队管理员才能更新团队信息
        if team_info['tenant_id'] != current_user.id and not TeamService.is_team_member(team_id, current_user.id, ['owner', 'admin']):
            return get_json_result(
                data=False,
                message='没有更新团队信息的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 至少需要更新一项
        if name is None and description is None:
            return get_data_error_result(message="请至少提供一项要更新的信息")
        
        team = TeamService.update_team(
            team_id=team_id,
            name=name,
            # description=description
        )
        
        return get_json_result(data=team)
    except ValueError as e:
        return get_data_error_result(message=str(e))
    except Exception as e:
        logger.exception(f"更新团队信息失败: {str(e)}")
        return server_error_response(e)


@manager.route('/delete/<team_id>', methods=['POST'])
@login_required
def delete_team(team_id):
    return get_json_result(data=False, message='暂时不允许删除')
    """删除团队（递归删除子团队及其成员）"""
    try:
        # 获取团队信息
        team_info = TeamService.get_team(team_id)
        if not team_info:
            return get_data_error_result(message="团队不存在")
        
        # 验证权限，只有租户管理员或团队拥有者才能删除团队
        if team_info['tenant_id'] != current_user.id and not TeamService.is_team_member(team_id, current_user.id, ['owner']):
            return get_json_result(
                data=False,
                message='没有删除团队的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 递归删除子团队及其成员
        success = delete_team_recursively(team_id)
        
        if success:
            return get_json_result(data=True, message="团队及其子团队已成功删除")
        else:
            return get_json_result(data=False, message="删除团队失败，请稍后重试")
    except Exception as e:
        logger.exception(f"删除团队失败: {str(e)}")
        return server_error_response(e)

def delete_team_recursively(team_id):
    """递归删除团队及其子团队、成员
    
    Args:
        team_id: 团队ID
    """
    try:
        # 获取团队信息用于日志记录
        team_info = TeamService.get_team(team_id)
        team_name = team_info.get('name', '未知') if team_info else '未知'
        logger.info(f"开始删除团队: ID={team_id}, 名称={team_name}")
        
        # 先获取所有子团队
        sub_teams = TeamService.list_teams_by_parent_id(team_id)
        logger.info(f"团队 {team_id} 有 {len(sub_teams)} 个子团队需要删除")
        
        # 递归删除每个子团队
        for sub_team in sub_teams:
            delete_team_recursively(sub_team['id'])
        
        # 获取当前团队的所有成员并删除
        users = UserService.get_users_by_team_id(team_id)
        user_count = len(users)
        logger.info(f"团队 {team_id} 有 {user_count} 个成员需要删除")
        
        # 删除每个成员
        for i, user in enumerate(users, 1):
            logger.debug(f"删除团队 {team_id} 的成员 ({i}/{user_count}): ID={user.id}, 邮箱={user.email}")
            UserService.update_user(
                user.id,
                {
                    "status": StatusEnum.INVALID.value,
                    "update_time": current_timestamp(),
                    "update_date": datetime_format(datetime.now())
                }
            )
        
        # 删除当前团队
        success = TeamService.delete_team(team_id)
        logger.info(f"成功删除团队 {team_id}（{team_name}）及其所有子团队和成员")
        return success
    except Exception as e:
        logger.error(f"删除团队 {team_id} 过程中发生错误: {str(e)}")
        raise


@manager.route('/<team_id>/member/list', methods=['GET'])
@login_required
def list_team_members(team_id):
    """
    根据team_id查询用户表中的相关用户信息
    
    Args:
        team_id: 团队ID
        
    Returns:
        用户信息列表（不包含密码）
    """
    try:
        # 获取团队信息
        team_info = TeamService.get_team(team_id)
        if not team_info:
            return get_data_error_result(message="团队不存在")
        
        # 验证权限，只有租户管理员、团队成员才能查看团队成员列表
        if team_info['tenant_id'] != current_user.id and not TeamService.is_team_member(team_id, current_user.id):
            return get_json_result(
                data=False,
                message='没有查看团队成员列表的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 直接从用户表查询与team_id相关的用户(without members at team)
        users = UserService.get_users_by_team_id(team_id)
        
        # 处理返回数据，排除敏感信息
        result = []
        for user in users:
            user_info = {
                'id': user.id,
                'email': user.email,
                'nickname': user.nickname,
                'avatar': user.avatar,
                'language': user.language,
                'color_schema': user.color_schema,
                'timezone': user.timezone,
                'last_login_time': user.last_login_time,
                'is_authenticated': user.is_authenticated,
                'is_active': user.is_active,
                'is_anonymous': user.is_anonymous,
                'login_channel': user.login_channel,
                'status': user.status,
                'is_superuser': user.is_superuser,
                'team_id': user.team_id,
                'role': user.role,
                'tenant_id': user.tenant_id
            }
            result.append(user_info)
        
        return get_json_result(data=result)
    except Exception as e:
        logger.exception(f"获取团队成员列表失败: {str(e)}")
        return server_error_response(e)


@manager.route('/<team_id>/member', methods=['POST'])
@login_required
@validate_request("email", "role")
def add_team_member(team_id):
    """添加团队成员"""
    try:
        data = request.json
        email = data.get('email')
        nickname = data.get('nickname', email.split('@')[0])  # 如果没有提供昵称，使用邮箱用户名作为昵称
        role = data.get('role')
        password = data.get('password', "123456")
        token = request.headers.get('Authorization')
        token = token[7:]
        
        # 获取团队信息
        team_info = TeamService.get_team(team_id)
        if not team_info:
            return get_data_error_result(message="团队不存在")
        
        # 验证权限，只有租户管理员或团队管理员/拥有者才能添加成员
        if team_info['tenant_id'] != current_user.id and not TeamService.is_team_member(team_id, current_user.id, ['owner', 'admin']):
            return get_json_result(
                data=False,
                message='没有添加团队成员的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 验证角色
        if role not in TeamService.VALID_ROLES:
            return get_data_error_result(message=f"无效的角色: {role}，有效角色: {', '.join(TeamService.VALID_ROLES)}")
        
        # 普通管理员不能添加 owner 角色
        if role == 'owner' and team_info['tenant_id'] != current_user.id and not TeamService.is_team_member(team_id, current_user.id, ['owner']):
            return get_json_result(
                data=False,
                message='只有租户管理员或团队拥有者才能添加拥有者角色',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 验证邮箱是否重复
        member = UserService.get_by_email(email)
        if member:
            return get_data_error_result(message="邮箱已存在")
        remote_user_client = RemoteUserClient(token = token)
        user = remote_user_client.create_user({"email": email, "password": password, "name": nickname})
        logger.info(f"------------user: {user}")
        if user:
            # 添加记录到用户租户表
            UserTenantService.save(
                user_id=user['id'],
                tenant_id=team_info['tenant_id'],
                role=UserTenantRole.NORMAL,
                invited_by=team_info['tenant_id'],
                status=StatusEnum.VALID.value
            )
            # 完善信息到用户表
            UserService.update_user(
                user['id'],
                {
                    "team_id": team_id,
                    "ragflow_user_id": user['id'],
                    "tenant_id": team_info['tenant_id'],
                }
            )
        
        return get_json_result(data=member)
    except ValueError as e:
        return get_data_error_result(message=str(e))
    except Exception as e:
        logger.exception(f"添加团队成员失败: {str(e)}")
        return server_error_response(e)


@manager.route('/<team_id>/member/<user_id>', methods=['POST'])
@login_required
def remove_team_member(team_id, user_id):
    # 不允许移除
    return get_json_result(data=False, message='暂时不允许移除')
    """移除团队成员"""
    try:
        # 获取团队信息
        team_info = TeamService.get_team(team_id)
        if not team_info:
            return get_data_error_result(message="团队不存在")
        
        # 验证权限
        is_tenant_admin = team_info['tenant_id'] == current_user.id
        is_team_admin = TeamService.is_team_member(team_id, current_user.id, ['owner', 'admin'])
        is_self_removal = user_id == current_user.id
        
        if not (is_tenant_admin or is_team_admin or is_self_removal):
            return get_json_result(
                data=False,
                message='没有移除团队成员的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 检查被移除成员的角色
        target_is_owner = TeamService.is_team_member(team_id, user_id, ['owner'])
        
        # 只有租户管理员或团队拥有者可以移除拥有者
        if target_is_owner and not (is_tenant_admin or TeamService.is_team_member(team_id, current_user.id, ['owner'])):
            return get_json_result(
                data=False,
                message='只有租户管理员或团队拥有者才能移除拥有者',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        success = TeamService.remove_member(team_id, user_id)
        
        return get_json_result(data=success)
    except ValueError as e:
        return get_data_error_result(message=str(e))
    except Exception as e:
        logger.exception(f"移除团队成员失败: {str(e)}")
        return server_error_response(e)


@manager.route('/<team_id>/member/<user_id>/role', methods=['POST'])
@login_required
@validate_request("role")
def update_member_role(team_id, user_id):
    """更新团队成员角色"""
    try:
        data = request.json
        role = data.get('role')
        
        # 获取团队信息
        team_info = TeamService.get_team(team_id)
        if not team_info:
            return get_data_error_result(message="团队不存在")
        
        # 验证权限，只有租户管理员或团队拥有者才能更新角色
        is_tenant_admin = team_info['tenant_id'] == current_user.id
        is_team_owner = TeamService.is_team_member(team_id, current_user.id, ['owner'])
        
        if not (is_tenant_admin or is_team_owner):
            return get_json_result(
                data=False,
                message='没有更新团队成员角色的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 验证角色
        if role not in TeamService.VALID_ROLES:
            return get_data_error_result(message=f"无效的角色: {role}，有效角色: {', '.join(TeamService.VALID_ROLES)}")
        
        member = TeamService.update_member_role(team_id, user_id, role)
        
        return get_json_result(data=member)
    except ValueError as e:
        return get_data_error_result(message=str(e))
    except Exception as e:
        logger.exception(f"更新团队成员角色失败: {str(e)}")
        return server_error_response(e)


@manager.route('/tenant/<tenant_id>/tree', methods=['GET'])
@login_required
def get_tenant_team_tree(tenant_id):
    """
    获取租户下的团队及用户树形结构
    
    Args:
        tenant_id: 租户ID
        
    Returns:
        树形结构数据，包含团队和用户信息
    """
    try:
        # 验证权限，只有租户管理员才能查看租户下的所有团队
        if tenant_id != current_user.id:
            return get_json_result(
                data=False,
                message='没有查看租户团队的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 获取租户下的所有团队
        teams = TeamService.list_teams_by_tenant(tenant_id)
        
        # 构建树形结构
        tree = []
        for team in teams:
            team_node = {
                'id': team['id'],
                'name': team['name'],
                'description': team['description'],
                'tenant_id': team['tenant_id'],
                'children': []  # 用户列表
            }
            
            # 获取团队下的用户
            users = UserService.get_users_by_team_id(str(team['id']))
            for user in users:
                user_node = {
                    'id': user.id,
                    'email': user.email,
                    'nickname': user.nickname,
                    'avatar': user.avatar,
                    'language': user.language,
                    'color_schema': user.color_schema,
                    'timezone': user.timezone,
                    'last_login_time': user.last_login_time,
                    'is_authenticated': user.is_authenticated,
                    'is_active': user.is_active,
                    'is_anonymous': user.is_anonymous,
                    'login_channel': user.login_channel,
                    'status': user.status,
                    'is_superuser': user.is_superuser,
                    'team_id': user.team_id,
                    'role': user.role,
                    'tenant_id': user.tenant_id
                }
                team_node['children'].append(user_node)
            
            tree.append(team_node)
        
        return get_json_result(data=tree)
    except Exception as e:
        logger.exception(f"获取租户团队树失败: {str(e)}")
        return server_error_response(e)


@manager.route('/<parent_id>/sub-teams', methods=['GET'])
@login_required
def list_sub_teams(parent_id):
    """获取子团队列表"""
    try:
        # 验证父团队是否存在
        parent_team = TeamService.get_team(parent_id)
        if not parent_team:
            return get_data_error_result(message="父团队不存在")
        
        # 验证权限，只有租户管理员或团队成员才能查看子团队
        if parent_team['tenant_id'] != current_user.id and not TeamService.is_team_member(parent_id, current_user.id):
            return get_json_result(
                data=False,
                message='没有查看子团队的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 获取子团队列表
        sub_teams = TeamService.list_teams_by_parent_id(parent_id)
        return get_json_result(data=sub_teams)
        
    except Exception as e:
        logger.exception(f"获取子团队列表失败: {str(e)}")
        return server_error_response(e) 