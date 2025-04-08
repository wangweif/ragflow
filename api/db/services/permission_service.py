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
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from peewee import fn, JOIN

from api.db import StatusEnum
from api.db.db_models import Knowledgebase, DB, User
from api.db.db_models_extension import KnowledgebasePermission, Team
from api.db.services.team_service import TeamService

logger = logging.getLogger(__name__)


class KnowledgebasePermissionService:
    """知识库权限服务类，提供知识库权限管理相关功能"""
    
    @classmethod
    def revoke_permission(cls, kb_id: str, user_id: str) -> bool:
        """
        撤销知识库权限
        
        Args:
            kb_id: 知识库ID
            user_id: 用户ID
            
        Returns:
            是否成功撤销
        """
        try:
            # 查找权限记录
            perm = KnowledgebasePermission.get_or_none(
                KnowledgebasePermission.kb_id == kb_id,
                KnowledgebasePermission.user_id == user_id,
                KnowledgebasePermission.status == StatusEnum.VALID.value
            )
            
            if not perm:
                return False
            
            # 逻辑删除权限记录
            perm.status = StatusEnum.DELETED.value
            perm.save()
            
            return True
        except Exception as e:
            logger.error(f"撤销知识库权限失败: {str(e)}")
            raise
    
    @classmethod
    def get_kb_permissions(cls, kb_id: str) -> List[Dict[str, Any]]:
        """
        获取知识库的所有权限
        
        Args:
            kb_id: 知识库ID
            
        Returns:
            权限信息列表
        """
        try:
            perms = KnowledgebasePermission.select().where(
                KnowledgebasePermission.kb_id == kb_id,
                KnowledgebasePermission.status == StatusEnum.VALID.value
            )
            
            result = []
            for perm in perms:
                perm_dict = perm.to_dict()
                
                # 如果是团队权限，添加团队信息
                if perm.team_id:
                    team = Team.get_or_none(Team.id == perm.team_id, Team.status == StatusEnum.VALID.value)
                    if team:
                        perm_dict['team_info'] = team.to_dict()
                
                result.append(perm_dict)
            
            return result
        except Exception as e:
            logger.error(f"获取知识库权限列表失败: {str(e)}")
            raise
    
    @classmethod
    def can_access_kb(cls, kb_id: str, user_id: str, required_permission: str = 'read') -> bool:
        """
        检查用户是否有权限访问知识库
        
        Args:
            kb_id: 知识库ID
            user_id: 用户ID
            required_permission: 所需的权限类型，可选值: read, write
                               read权限可以查看知识库
                               write权限可以修改知识库
            
        Returns:
            是否有权限访问
        """
        try:
            # 获取知识库信息
            kb = Knowledgebase.get_or_none(Knowledgebase.id == kb_id, Knowledgebase.status == StatusEnum.VALID.value)
            if not kb:
                return False
            
            # 知识库创建者和租户管理员拥有所有权限
            if kb.created_by == user_id or kb.tenant_id == user_id:
                return True
            
            # 检查用户是否有直接授权
            user_perm = KnowledgebasePermission.get_or_none(
                KnowledgebasePermission.kb_id == kb_id,
                KnowledgebasePermission.user_id == user_id,
                KnowledgebasePermission.status == StatusEnum.VALID.value
            )
            
            if user_perm:
                # 如果需要写权限，检查权限类型
                if required_permission == 'write':
                    return user_perm.permission_type == 'write'
                else:
                    # 需要读权限，任何权限类型都可以
                    return True
            
            return False
        except Exception as e:
            logger.error(f"检查知识库访问权限失败: {str(e)}")
            return False
    
    @classmethod
    def get_user_accessible_kbs(cls, user_id: str, required_permission: str = 'read') -> List[str]:
        """
        获取用户可访问的所有知识库ID
        
        Args:
            user_id: 用户ID
            required_permission: 所需的权限类型，可选值: read, write
            
        Returns:
            知识库ID列表
        """
        try:
            # 获取用户创建的或其所在租户的知识库
            kb_ids = set()
            kbs = Knowledgebase.select(Knowledgebase.id).where(
                (Knowledgebase.created_by == user_id) | (Knowledgebase.tenant_id == user_id),
                Knowledgebase.status == StatusEnum.VALID.value
            )
            for kb in kbs:
                kb_ids.add(kb.id)
            
            # 获取直接授权给用户的知识库
            if required_permission == 'write':
                # 需要写权限
                user_perms = KnowledgebasePermission.select(KnowledgebasePermission.kb_id).where(
                    KnowledgebasePermission.user_id == user_id,
                    KnowledgebasePermission.permission_type == 'write',
                    KnowledgebasePermission.status == StatusEnum.VALID.value
                )
            else:
                # 需要读权限，任何权限类型都可以
                user_perms = KnowledgebasePermission.select(KnowledgebasePermission.kb_id).where(
                    KnowledgebasePermission.user_id == user_id,
                    KnowledgebasePermission.status == StatusEnum.VALID.value
                )
                
            for perm in user_perms:
                kb_ids.add(perm.kb_id)
            
            return list(kb_ids)
        except Exception as e:
            logger.error(f"获取用户可访问的知识库列表失败: {str(e)}")
            return []
            
    @classmethod
    @DB.connection_context()
    def get_user_kb_permissions(cls, user_id: str, tenant_id: str) -> List[Dict[str, Any]]:
        """
        获取用户可访问的所有知识库权限信息
        
        Args:
            user_id: 用户ID
            tenant_id: 租户ID
            
        Returns:
            知识库权限信息列表
        """
        try:
            result = []
            
            # 查询用户直接授权的知识库权限
            query = (
                KnowledgebasePermission
                .select(
                    KnowledgebasePermission,
                    Knowledgebase
                )
                .join(
                    Knowledgebase,
                    on=(KnowledgebasePermission.kb_id == Knowledgebase.id)
                )
                .where(
                    KnowledgebasePermission.user_id == user_id,
                    Knowledgebase.tenant_id == tenant_id,
                    KnowledgebasePermission.status == StatusEnum.VALID.value,
                    Knowledgebase.status == StatusEnum.VALID.value
                )
            )
            
            # 处理查询结果
            for record in query:
                # 正确解析联合查询结果
                perm = record  # KnowledgebasePermission对象
                kb_dict = {
                    'id': perm.kb_id,
                    'name': record.knowledgebase.name,
                    'description': record.knowledgebase.description,
                    'created_by': record.knowledgebase.created_by,
                    'doc_num': record.knowledgebase.doc_num
                }
                
                item = {
                    'kb_id': perm.kb_id,
                    'kb_name': record.knowledgebase.name,
                    'permission_type': perm.permission_type,
                    'granted_by': perm.granted_by,
                    'granted_at': perm.granted_at,
                    'kb_info': kb_dict
                }
                
                # 所有权限都是直接授权
                item['permission_source'] = 'direct'
                
                result.append(item)
            
            return result
        except Exception as e:
            logger.error(f"获取用户知识库权限列表失败: {str(e)}")
            return []
    
    @classmethod
    @DB.atomic()
    def batch_update_permissions(cls, kb_id: str, tenant_id: str, granted_by: str, permissions: List[Dict[str, Any]]) -> bool:
        """
        批量更新知识库权限
        
        Args:
            kb_id: 知识库ID
            tenant_id: 租户ID
            granted_by: 授权人ID
            permissions: 权限列表，每项包含user_id和permission_types
            
        Returns:
            是否更新成功
        """
        try:
            # 验证知识库是否存在
            kb = Knowledgebase.get_or_none(Knowledgebase.id == kb_id, Knowledgebase.status == StatusEnum.VALID.value)
            if not kb:
                raise ValueError(f"知识库 {kb_id} 不存在")
                
            # 物理删除该知识库的所有现有权限
            KnowledgebasePermission.delete().where(
                KnowledgebasePermission.kb_id == kb_id
            ).execute()
            
            # 存储新的权限配置
            new_permissions = []
            current_time = datetime.now()
            
            # 记录已处理的权限组合，避免重复
            processed_permissions = set()
            
            for perm in permissions:
                user_id = perm.get('user_id')
                team_id = perm.get('team_id')
                permission_types = perm.get('permission_types', ['read'])
                
                # 确保用户存在且不为空
                if user_id:
                    for perm_type in permission_types:
                        if perm_type in ['read', 'write']:
                            # 检查是否已经处理过相同的组合
                            perm_key = (kb_id, user_id, perm_type)
                            if perm_key in processed_permissions:
                                continue
                                
                            processed_permissions.add(perm_key)
                            
                            # 添加新权限记录，使用 UUID 生成 ID
                            new_permissions.append({
                                'id': str(uuid.uuid4()),
                                'kb_id': kb_id,
                                'tenant_id': tenant_id,
                                'user_id': user_id,
                                'team_id': team_id,
                                'permission_type': perm_type,
                                'granted_by': granted_by,
                                'granted_at': current_time,
                                'status': StatusEnum.VALID.value
                            })
            
            logger.info(f"准备插入的权限记录数: {len(new_permissions)}")
            
            # 批量创建新的权限记录
            if new_permissions:
                try:
                    # 批量插入，如果失败直接抛出异常
                    KnowledgebasePermission.insert_many(new_permissions).execute()
                except Exception as e:
                    logger.error(f"批量插入权限记录失败: {str(e)}")
                    # 不进行单条插入的尝试，直接抛出异常
                    raise
            
            return True
        except Exception as e:
            logger.error(f"批量更新知识库权限失败: {str(e)}")
            # 由于使用了@DB.atomic()，发生异常时会自动回滚事务
            raise 
    
    @classmethod
    @DB.connection_context()
    def get_kb_authorized_users(cls, kb_id: str) -> List[Dict[str, Any]]:
        """
        获取知识库授权给的用户列表
        
        Args:
            kb_id: 知识库ID
            
        Returns:
            授权用户列表，包含用户ID和权限信息
        """
        try:
            # 查询知识库权限表
            authorized_users = KnowledgebasePermission.select().where(
                KnowledgebasePermission.kb_id == kb_id,
                KnowledgebasePermission.status == StatusEnum.VALID.value
            )
            
            # 转换为字典列表
            result = []
            for auth in authorized_users:
                result.append({
                    'user_id': auth.user_id,
                    'permission_type': auth.permission_type
                })
            
            return result
        except Exception as e:
            logger.error(f"获取知识库授权用户失败: {str(e)}")
            raise 