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
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Union

from api.db import StatusEnum, UserTenantRole
from api.db.db_models_extension import Team
from api.db.init_data import encode_to_base64
from api.db.services.user_service import UserService, UserTenantService
from api.utils import current_timestamp, datetime_format, get_uuid

logger = logging.getLogger(__name__)


class TeamService:
    """团队服务类，提供团队管理和团队成员管理相关功能"""
    
    # 有效的团队成员角色
    VALID_ROLES = ['owner', 'admin', 'member']
    
    @classmethod
    def create_team(cls, tenant_id: str, name: str, created_by: str, description: Optional[str] = None, parent_id: Optional[str] = None) -> Dict[str, Any]:
        """
        创建新团队
        
        Args:
            tenant_id: 租户ID
            name: 团队名称
            created_by: 创建者ID
            description: 团队描述
            parent_id: 父团队ID，用于创建子团队
            
        Returns:
            团队信息字典
        """
        try:
            # 检查同一租户下是否已存在同名团队
            existing_team = Team.get_or_none(
                Team.tenant_id == tenant_id, 
                Team.name == name,
                Team.status == StatusEnum.VALID.value
            )
            if existing_team:
                raise ValueError(f"团队名称 '{name}' 已存在")
            
            # 如果指定了父团队，检查父团队是否存在
            if parent_id:
                parent_team = Team.get_or_none(
                    Team.id == parent_id,
                    Team.status == StatusEnum.VALID.value
                )
                if not parent_team:
                    raise ValueError(f"父团队 {parent_id} 不存在")
            
            # 创建团队
            team_id = get_uuid()
            
            team = Team.create(
                id=team_id,
                tenant_id=tenant_id,
                name=name,
                description=description,
                created_by=created_by,
                parent_id=parent_id,
                status=StatusEnum.VALID.value
            )
            
            return team.to_dict()
        except Exception as e:
            logger.error(f"创建团队失败: {str(e)}")
            raise
    
    @classmethod
    def get_team(cls, team_id: str) -> Optional[Dict[str, Any]]:
        """
        获取团队信息
        
        Args:
            team_id: 团队ID
            
        Returns:
            团队信息字典，如果不存在则返回None
        """
        team = Team.get_or_none(Team.id == team_id, Team.status == StatusEnum.VALID.value)
        if not team:
            return None
            
        result = team.to_dict()
        # 解析成员JSON数据
        if team.members:
            result['members'] = json.loads(team.members)
        else:
            result['members'] = {}
            
        return result
    
    # description: str = None
    # description: 新的团队描述
    @classmethod
    def update_team(cls, team_id: str, name: str = None) -> Dict[str, Any]:
        """
        更新团队信息
        
        Args:
            team_id: 团队ID
            name: 新的团队名称
            
        Returns:
            更新后的团队信息字典
        """
        try:
            team = Team.get_or_none(Team.id == team_id, Team.status == StatusEnum.VALID.value)
            if not team:
                raise ValueError(f"团队 {team_id} 不存在")
            
            # 检查同一租户下是否已存在同名团队
            if name and name != team.name:
                existing_team = Team.get_or_none(
                    Team.tenant_id == team.tenant_id, 
                    Team.name == name,
                    Team.id != team_id,
                    Team.status == StatusEnum.VALID.value
                )
                if existing_team:
                    raise ValueError(f"团队名称 '{name}' 已存在")
                team.name = name
            
            # if description is not None:
                # team.description = description
            
            team.save()
            
            result = team.to_dict()
            # # 解析成员JSON数据
            # if team.members:
            #     result['members'] = json.loads(team.members)
            # else:
            #     result['members'] = {}
                
            return result
        except Exception as e:
            logger.error(f"更新团队失败: {str(e)}")
            raise
    
    @classmethod
    def delete_team(cls, team_id: str) -> bool:
        """
        删除团队（逻辑删除）
        
        Args:
            team_id: 团队ID
            
        Returns:
            是否成功删除
        """
        try:
            team = Team.get_or_none(Team.id == team_id, Team.status == StatusEnum.VALID.value)
            if not team:
                return False
            
            # 逻辑删除团队
            team.status = StatusEnum.INVALID.value
            team.save()
            
            return True
        except Exception as e:
            logger.error(f"删除团队失败: {str(e)}")
            raise
    
    @classmethod
    def list_teams_by_tenant(cls, tenant_id: str) -> List[Dict[str, Any]]:
        """
        获取租户下的所有团队
        
        Args:
            tenant_id: 租户ID
            
        Returns:
            团队信息列表
        """
        teams = Team.select().where(
            Team.tenant_id == tenant_id,
            Team.status == StatusEnum.VALID.value
        )
        
        result = []
        for team in teams:
            team_dict = {
                "id": team.id,
                "name": team.name,
                "tenant_id": team.tenant_id,
            }
            result.append(team_dict)
        
        return result
    
    @classmethod
    def list_teams_by_user(cls, user_id: str, tenant_id: str = None) -> List[Dict[str, Any]]:
        """
        获取用户所在的所有团队
        
        Args:
            user_id: 用户ID
            tenant_id: 租户ID，可选过滤条件
            
        Returns:
            团队信息列表，包含用户在每个团队中的角色
        """
        query = Team.select().where(
            Team.status == StatusEnum.VALID.value
        )
        
        if tenant_id:
            query = query.where(Team.tenant_id == tenant_id)
        
        teams = []
        for team in query:
            if not team.members:
                continue
                
            members = json.loads(team.members)
            if user_id in members:
                team_dict = team.to_dict()
                team_dict['role'] = members[user_id]['role']
                team_dict['members'] = members
                teams.append(team_dict)
        
        return teams
    
    @classmethod
    def list_teams_by_parent_id(cls, parent_id: str) -> List[Dict[str, Any]]:
        """
        获取指定父团队下的所有子团队
        
        Args:
            parent_id: 父团队ID
            
        Returns:
            子团队信息列表
        """
        teams = Team.select().where(
            Team.parent_id == parent_id,
            Team.status == StatusEnum.VALID.value
        )
        
        result = []
        for team in teams:
            team_dict = {
                "id": team.id,
                "name": team.name,
                "tenant_id": team.tenant_id,
                "parent_id": team.parent_id,
                "description": team.description
            }
            result.append(team_dict)
        
        return result
    
    # ========== 团队成员管理方法 ==========
    
    @classmethod
    def add_member_by_email(cls, team_id: str, email: str, nickname: str, role: str, tenant_id: str) -> Dict[str, Any]:
        """
        通过邮箱添加团队成员，如果用户不存在则创建用户
        
        Args:
            team_id: 团队ID
            email: 用户邮箱
            nickname: 用户昵称
            role: 角色，可选值: owner, admin, member
            tenant_id: 租户ID，用于创建用户与租户的关联
            
        Returns:
            团队成员信息字典
        """
        try:
            # 验证角色有效性
            if role not in cls.VALID_ROLES:
                raise ValueError(f"无效的角色: {role}，有效角色: {', '.join(cls.VALID_ROLES)}")
            
            # 检查团队是否存在
            team = Team.get_or_none(Team.id == team_id, Team.status == StatusEnum.VALID.value)
            if not team:
                raise ValueError(f"团队 {team_id} 不存在")
            
            # 获取或创建用户
            user = UserService.get_by_email(email)
            if not user:
                logger.info(f"team_id: {team_id}, role: {role}, tenant_id: {tenant_id}")
                # 创建新用户，使用默认密码123456
                user = UserService.create_user(email=email, nickname=nickname, password=encode_to_base64("123456"), team_id=team_id, role=role, tenant_id=tenant_id)
                if not user:
                    raise ValueError(f"创建用户失败")
                
                # 创建用户与租户的关联
                UserTenantService.save(
                    user_id=user.id,
                    tenant_id=tenant_id,
                    role=UserTenantRole.NORMAL,
                    invited_by=tenant_id,
                    status=StatusEnum.VALID.value
                )
            
            
            team.save()
            
            return {
                "team_id": team_id,
                "user_id": user.id,
                "email": user.email,
                "nickname": user.nickname,
                "role": role
            }
        except Exception as e:
            logger.error(f"添加团队成员失败: {str(e)}")
            raise
    
    @classmethod
    def remove_member(cls, team_id: str, user_id: str) -> bool:
        """
        移除团队成员
        
        Args:
            team_id: 团队ID
            user_id: 用户ID
            
        Returns:
            是否成功移除
        """
        try:
            # 检查团队是否存在
            team = Team.get_or_none(Team.id == team_id, Team.status == StatusEnum.VALID.value)
            if not team:
                return False

            # 调用 UserService 的方法来更新用户状态
            UserService.update_user(
                user_id,
                {
                    "status": StatusEnum.INVALID.value,
                    "update_time": current_timestamp(),
                    "update_date": datetime_format(datetime.now())
                }
            )
            return True
        except Exception as e:
            logger.error(f"Failed to remove team member: {e}")
            raise
    
    @classmethod
    def update_member_role(cls, team_id: str, user_id: str, role: str) -> Dict[str, Any]:
        """
        更新团队成员角色
        
        Args:
            team_id: 团队ID
            user_id: 用户ID
            role: 新角色
            
        Returns:
            更新后的成员信息字典
        """
        try:
            # 验证角色有效性
            if role not in cls.VALID_ROLES:
                raise ValueError(f"无效的角色: {role}，有效角色: {', '.join(cls.VALID_ROLES)}")
            
            # 检查团队是否存在
            team = Team.get_or_none(Team.id == team_id, Team.status == StatusEnum.VALID.value)
            if not team:
                raise ValueError(f"团队 {team_id} 不存在")
            
            # 解析现有成员数据
            if not team.members:
                raise ValueError(f"团队成员不存在")
                
            members = json.loads(team.members)
            
            # 检查成员是否存在
            if user_id not in members:
                raise ValueError(f"团队成员不存在")
            
            # 检查是否是最后一个拥有者
            if members[user_id]["role"] == "owner" and role != "owner":
                owner_count = 0
                for uid, info in members.items():
                    if info["role"] == "owner":
                        owner_count += 1
                
                if owner_count <= 1:
                    raise ValueError("不能降级团队的最后一个拥有者")
            
            # 更新角色
            members[user_id]["role"] = role
            
            # 保存到数据库
            team.members = json.dumps(members)
            team.save()
            
            return {
                "team_id": team_id,
                "user_id": user_id,
                "role": role,
                "joined_at": members[user_id]["joined_at"]
            }
        except Exception as e:
            logger.error(f"更新团队成员角色失败: {str(e)}")
            raise
    
    @classmethod
    def is_team_member(cls, team_id: str, user_id: str, roles: List[str] = None) -> bool:
        """
        检查用户是否是团队成员，可选指定角色
        
        Args:
            team_id: 团队ID
            user_id: 用户ID
            roles: 角色列表，如果指定，则检查用户是否具有指定角色之一
            
        Returns:
            是否是团队成员
        """
        # 获取团队信息
        team = Team.get_or_none(Team.id == team_id, Team.status == StatusEnum.VALID.value)
        if not team or not team.members:
            return False
            
        members = json.loads(team.members)
        
        # 检查用户是否是团队成员
        if user_id not in members:
            return False
            
        # 如果指定了角色，检查用户角色
        if roles and members[user_id]["role"] not in roles:
            return False
            
        return True 