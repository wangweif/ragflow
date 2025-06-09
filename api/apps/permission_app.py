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
from api.db import StatusEnum
from api.db.db_models import Knowledgebase
from api.db.services.dialog_service import DialogService
from api.db.services.permission_service import KnowledgebasePermissionService
from api.utils.api_utils import get_json_result, validate_request, server_error_response, get_data_error_result

logger = logging.getLogger(__name__)

# 定义应用名称和蓝图
page_name = "permission"
manager = Blueprint('permission', __name__)


# ================ 知识库权限接口 ================

@manager.route('/kb/<kb_id>/list', methods=['GET'])
@login_required
def kb_permission_list(kb_id):
    """获取知识库的权限列表"""
    try:
        # 获取知识库信息
        kb = Knowledgebase.get_or_none(Knowledgebase.id == kb_id, Knowledgebase.status == StatusEnum.VALID.value)
        if not kb:
            return get_data_error_result(message="知识库不存在")
        
        # 验证用户权限
        if kb.tenant_id != current_user.id and kb.created_by != current_user.id:
            return get_json_result(
                data=False,
                message='没有查看知识库权限的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 获取权限列表
        permissions = KnowledgebasePermissionService.get_kb_permissions(kb_id)
        
        # 补充用户和团队信息
        result = []
        for perm in permissions:
            perm_info = perm.copy()
            
            # 添加用户信息
            if perm.get('user_id'):
                user = UserService.get_by_id(perm['user_id'])
                if user:
                    perm_info['user_info'] = {
                        'id': user.id,
                        'email': user.email,
                        'nickname': user.nickname,
                        'avatar': user.avatar
                    }
            
            # 添加授权人信息
            granted_by_user = UserService.get_by_id(perm['granted_by'])
            if granted_by_user:
                perm_info['granted_by_info'] = {
                    'id': granted_by_user.id,
                    'email': granted_by_user.email,
                    'nickname': granted_by_user.nickname,
                    'avatar': granted_by_user.avatar
                }
            
            result.append(perm_info)
        
        return get_json_result(data=result)
    except Exception as e:
        logger.exception(f"获取知识库权限列表失败: {str(e)}")
        return server_error_response(e)



@manager.route('/kb/<kb_id>/team', methods=['POST'])
@login_required
@validate_request("team_id", "permission_type")
def grant_kb_team_permission(kb_id):
    """为团队授予知识库权限"""
    try:
        data = request.json
        team_id = data.get('team_id')
        permission_type = data.get('permission_type')
        
        # 验证权限类型是否有效
        if permission_type not in ['read', 'write']:
            return get_data_error_result(message="无效的权限类型，应为 'read' 或 'write'")
        
        # 获取知识库信息
        kb = Knowledgebase.get_or_none(Knowledgebase.id == kb_id, Knowledgebase.status == StatusEnum.VALID.value)
        if not kb:
            return get_data_error_result(message="知识库不存在")
        
        # 验证用户权限
        if kb.tenant_id != current_user.id and kb.created_by != current_user.id:
            return get_json_result(
                data=False,
                message='没有授予知识库权限的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 授予权限
        permission = KnowledgebasePermissionService.grant_permission(
            kb_id=kb_id,
            tenant_id=kb.tenant_id,
            granted_by=current_user.id,
            permission_type=permission_type,
            team_id=team_id
        )
        
        return get_json_result(data=permission)
    except ValueError as e:
        return get_data_error_result(message=str(e))
    except Exception as e:
        logger.exception(f"授予团队知识库权限失败: {str(e)}")
        return server_error_response(e)


@manager.route('/kb/<kb_id>/user/<user_id>', methods=['POST'])
@login_required
def revoke_kb_user_permission(kb_id, user_id):
    """撤销用户的知识库权限"""
    try:
        # 获取知识库信息
        kb = Knowledgebase.get_or_none(Knowledgebase.id == kb_id, Knowledgebase.status == StatusEnum.VALID.value)
        if not kb:
            return get_data_error_result(message="知识库不存在")
        
        # 验证用户权限
        if kb.tenant_id != current_user.id and kb.created_by != current_user.id:
            return get_json_result(
                data=False,
                message='没有撤销知识库权限的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 撤销权限
        success = KnowledgebasePermissionService.revoke_permission(kb_id, user_id=user_id)
        
        return get_json_result(data=success)
    except Exception as e:
        logger.exception(f"撤销用户知识库权限失败: {str(e)}")
        return server_error_response(e)


@manager.route('/kb/<kb_id>/team/<team_id>', methods=['POST'])
@login_required
def revoke_kb_team_permission(kb_id, team_id):
    """撤销团队的知识库权限"""
    try:
        # 获取知识库信息
        kb = Knowledgebase.get_or_none(Knowledgebase.id == kb_id, Knowledgebase.status == StatusEnum.VALID.value)
        if not kb:
            return get_data_error_result(message="知识库不存在")
        
        # 验证用户权限
        if kb.tenant_id != current_user.id and kb.created_by != current_user.id:
            return get_json_result(
                data=False,
                message='没有撤销知识库权限的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 撤销权限
        success = KnowledgebasePermissionService.revoke_permission(kb_id, team_id=team_id)
        
        return get_json_result(data=success)
    except Exception as e:
        logger.exception(f"撤销团队知识库权限失败: {str(e)}")
        return server_error_response(e)


@manager.route('/kb/accessible', methods=['GET'])
@login_required
def user_accessible_kb():
    """获取用户可访问的所有知识库权限"""
    try:
        tenant_id = request.args.get('tenant_id')
        user_id = request.args.get('user_id')
        if not tenant_id:
            return get_data_error_result(message="租户ID不能为空")
        
        # 获取用户可访问的知识库权限 
        if user_id:
            permissions = KnowledgebasePermissionService.get_user_kb_permissions(user_id, tenant_id)
        else:
            permissions = KnowledgebasePermissionService.get_user_kb_permissions(current_user.id, tenant_id)
        
        return get_json_result(data=permissions)
    except Exception as e:
        logger.exception(f"获取用户可访问的知识库权限失败: {str(e)}")
        return server_error_response(e)

@manager.route('/kb/assistant_accessible', methods=['GET'])
@login_required
def assistant_accessible_kb():
    """获取用户可访问的所有知识库权限"""
    try:
        assistant_id = request.args.get('assistant_id')
        if not assistant_id:
            return get_data_error_result(message="助手ID不能为空")
        
        # 根据助手id获取用户id
        e, assistant = DialogService.get_by_id(assistant_id)
        if not e:
            return get_data_error_result(message="助手不存在")
        
        user_id = assistant.user_id
        tenant_id = assistant.tenant_id
        
        # 获取用户可访问的知识库权限
        permissions = KnowledgebasePermissionService.get_user_kb_permissions(user_id, tenant_id)
        
        return get_json_result(data=permissions)
    except Exception as e:
        logger.exception(f"获取助手可访问的知识库权限失败: {str(e)}")
        return server_error_response(e)


@manager.route('/kb/<kb_id>/permissions', methods=['POST'])
@login_required
@validate_request("permissions")
def update_kb_permissions(kb_id):
    """批量更新知识库权限"""
    try:
        data = request.json
        permissions = data.get('permissions', [])
        
        # 获取知识库信息
        kb = Knowledgebase.get_or_none(Knowledgebase.id == kb_id, Knowledgebase.status == StatusEnum.VALID.value)
        if not kb:
            return get_data_error_result(message="知识库不存在")
        
        # 验证权限，只有租户管理员或知识库创建者才能管理权限
        if kb.tenant_id != current_user.id and kb.created_by != current_user.id:
            return get_json_result(
                data=False,
                message='没有管理知识库权限的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 批量更新权限
        result = KnowledgebasePermissionService.batch_update_permissions(
            kb_id=kb_id,
            tenant_id=kb.tenant_id,
            granted_by=current_user.id,
            permissions=permissions
        )
        
        return get_json_result(data=result)
    except ValueError as e:
        return get_data_error_result(message=str(e))
    except Exception as e:
        logger.exception(f"更新知识库权限失败: {str(e)}")
        return server_error_response(e)


@manager.route('/kb/<kb_id>/authorized_users', methods=['GET'])
@login_required
def get_kb_authorized_users(kb_id):
    """
    获取知识库授权给的用户ID列表
    
    Args:
        kb_id: 知识库ID
        
    Returns:
        授权用户ID列表
    """
    try:
        # 获取知识库信息
        kb = Knowledgebase.get_or_none(Knowledgebase.id == kb_id, Knowledgebase.status == StatusEnum.VALID.value)
        if not kb:
            return get_data_error_result(message="知识库不存在")
        
        # 验证权限，只有知识库所有者或租户管理员才能查看授权用户
        if kb.tenant_id != current_user.id and kb.created_by != current_user.id:
            return get_json_result(
                data=False,
                message='没有查看知识库授权用户的权限',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
        
        # 获取知识库授权用户列表
        authorized_users = KnowledgebasePermissionService.get_kb_authorized_users(kb_id)
        
        return get_json_result(data=authorized_users)
    except Exception as e:
        logger.exception(f"获取知识库授权用户失败: {str(e)}")
        return server_error_response(e)
