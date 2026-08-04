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
import hashlib
import logging
from datetime import datetime
from typing import List, Union, Optional
import time

import peewee
from werkzeug.security import generate_password_hash, check_password_hash

from api.db import UserTenantRole
from api.db.db_models import DB, UserTenant
from api.db.db_models import User, Tenant
from api.db.services.common_service import CommonService
from api.utils import get_uuid, current_timestamp, datetime_format
from api.db import StatusEnum
from rag.settings import MINIO
from api.utils.local_user_client import local_user_client

logger = logging.getLogger(__name__)
class UserService(CommonService):
    """Service class for managing user-related database operations.
    
    This class extends CommonService to provide specialized functionality for user management,
    including authentication, user creation, updates, and deletions.
    现已重构为使用本地SQLite数据库。
    
    Attributes:
        model: The User model class for database operations (仅用于兼容性).
    """
    model = User
    
    @classmethod
    def query(cls, **kwargs):
        """通用查询方法，兼容原有代码调用方式"""
        try:
            # 如果查询包含email参数
            if 'email' in kwargs:
                user = cls.get_by_email(kwargs['email'])
                return [user] if user else []
            
            # 如果查询包含access_token参数  
            if 'access_token' in kwargs:
                # 通过验证token获取用户信息
                user = local_user_client.verify_token(kwargs['access_token'])
                return [user] if user else []
            
            # 如果查询包含id参数
            if 'id' in kwargs:
                user = cls.filter_by_id(kwargs['id'])
                return [user] if user else []
            
            # 其他查询参数暂不支持，返回空列表
            logger.warning(f"不支持的查询参数: {kwargs}")
            return []
            
        except Exception as e:
            logger.error(f"查询用户失败: {str(e)}")
            return []
    
    @classmethod
    def update_by_id(cls, user_id, update_dict):
        """根据ID更新用户，兼容原有代码调用方式"""
        return cls.update_user(user_id, update_dict)

    @classmethod
    def filter_by_id(cls, user_id):
        """Retrieve a user by their ID.
        
        Args:
            user_id: The unique identifier of the user.
            
        Returns:
            User object if found, None otherwise.
        """
        try:
            user = local_user_client.get_user_by_id(user_id)
            return user
        except Exception as e:
            logger.error(f"获取用户失败: {str(e)}")
            return None

    @classmethod
    def get_by_email(cls, email):
        """根据邮箱获取用户
        
        Args:
            email: 用户邮箱
            
        Returns:
            User object if found, None otherwise.
        """
        try:
            user = local_user_client.get_user_by_email(email)
            return user
        except Exception as e:
            logger.error(f"根据邮箱获取用户失败: {str(e)}")
            return None

    @classmethod
    def authenticate_user(cls, email, password):
        """用户认证
        
        Args:
            email: 用户邮箱
            password: 用户密码
            
        Returns:
            User object if authentication successful, None otherwise.
        """
        try:
            user = local_user_client.authenticate_user(email, password)
            return user
        except Exception as e:
            logger.error(f"用户认证失败: {str(e)}")
            return None

    @classmethod
    def create_user(cls, **kwargs):
        """创建用户
        
        Args:
            **kwargs: 用户数据
            
        Returns:
            User object if creation successful, None otherwise.
        """
        try:
            user = local_user_client.create_user(kwargs)
            return user
        except Exception as e:
            logger.error(f"创建用户失败: {str(e)}")
            return None

    @classmethod
    @DB.connection_context()
    def delete_user(cls, user_ids, update_user_dict):
        with DB.atomic():
            cls.model.update({"status": 0}).where(
                cls.model.id.in_(user_ids)).execute()

    @classmethod
    def update_user(cls, user_id, user_dict):
        """更新用户信息（通过本地SQLite客户端）"""
        try:
            if user_dict:
                user_dict["updated_at"] = int(time.time())
                return local_user_client.update_user(user_id, user_dict)
        except Exception as e:
            logger.error(f"更新用户失败: {str(e)}")
            return False

    @classmethod
    def get_users_by_team_id(cls, team_id: Union[str, int]) -> List[User]:
        """
        根据team_id(即openwebui的部门/group ID)查询该部门下的成员用户

        Args:
            team_id: 部门(group)ID（字符串或整数类型）

        Returns:
            User列表（成员以group.user_ids为准）
        """
        try:
            # 确保team_id是字符串类型
            team_id_str = str(team_id)

            # 从openwebui数据库按部门(group)获取成员，以group.user_ids为准
            users_data = local_user_client.get_users_by_group_id(team_id_str)

            # 过滤空值
            return [user for user in users_data if user]
        except Exception as e:
            logger.error(f"查询团队用户失败: {str(e)}")
            return []


class TenantService(CommonService):
    """Service class for managing tenant-related database operations.
    
    This class extends CommonService to provide functionality for tenant management,
    including tenant information retrieval and credit management.
    
    Attributes:
        model: The Tenant model class for database operations.
    """
    model = Tenant

    @classmethod
    @DB.connection_context()
    def get_info_by(cls, user_id):
        fields = [
            cls.model.id.alias("tenant_id"),
            cls.model.name,
            cls.model.llm_id,
            cls.model.embd_id,
            cls.model.rerank_id,
            cls.model.asr_id,
            cls.model.img2txt_id,
            cls.model.tts_id,
            cls.model.parser_ids,
            UserTenant.role]
        return list(cls.model.select(*fields)
                    .join(UserTenant, on=((cls.model.id == UserTenant.tenant_id) & (UserTenant.user_id == user_id) & (UserTenant.status == StatusEnum.VALID.value)))
                    .where(cls.model.status == StatusEnum.VALID.value).dicts())

    @classmethod
    @DB.connection_context()
    def get_joined_tenants_by_user_id(cls, user_id):
        fields = [
            cls.model.id.alias("tenant_id"),
            cls.model.name,
            cls.model.llm_id,
            cls.model.embd_id,
            cls.model.asr_id,
            cls.model.img2txt_id,
            UserTenant.role]
        return list(cls.model.select(*fields)
                    .join(UserTenant, on=((cls.model.id == UserTenant.tenant_id) & (UserTenant.user_id == user_id) & (UserTenant.status == StatusEnum.VALID.value) & (UserTenant.role == UserTenantRole.NORMAL)))
                    .where(cls.model.status == StatusEnum.VALID.value).dicts())

    @classmethod
    @DB.connection_context()
    def decrease(cls, user_id, num):
        num = cls.model.update(credit=cls.model.credit - num).where(
            cls.model.id == user_id).execute()
        if num == 0:
            raise LookupError("Tenant not found which is supposed to be there")

    @classmethod
    @DB.connection_context()
    def user_gateway(cls, tenant_id):
        hashobj = hashlib.sha256(tenant_id.encode("utf-8"))
        return int(hashobj.hexdigest(), 16)%len(MINIO)


class UserTenantService(CommonService):
    """Service class for managing user-tenant relationship operations.
    
    This class extends CommonService to handle the many-to-many relationship
    between users and tenants, managing user roles and tenant memberships.
    
    Attributes:
        model: The UserTenant model class for database operations.
    """
    model = UserTenant

    @classmethod
    @DB.connection_context()
    def save(cls, **kwargs):
        if "id" not in kwargs:
            kwargs["id"] = get_uuid()
        obj = cls.model(**kwargs).save(force_insert=True)
        return obj

    @classmethod
    @DB.connection_context()
    def get_by_tenant_id(cls, tenant_id):
        fields = [
            cls.model.user_id,
            cls.model.status,
            cls.model.role,
            User.nickname,
            User.email,
            User.avatar,
            User.is_authenticated,
            User.is_active,
            User.is_anonymous,
            User.status,
            User.update_date,
            User.is_superuser]
        return list(cls.model.select(*fields)
                    .join(User, on=((cls.model.user_id == User.id) & (cls.model.status == StatusEnum.VALID.value) & (cls.model.role != UserTenantRole.OWNER)))
                    .where(cls.model.tenant_id == tenant_id)
                    .dicts())

    @classmethod
    @DB.connection_context()
    def get_tenants_by_user_id(cls, user_id):
        fields = [
            cls.model.tenant_id,
            cls.model.role,
            User.nickname,
            User.email,
            User.avatar,
            User.update_date
        ]
        return list(cls.model.select(*fields)
                    .join(User, on=((cls.model.tenant_id == User.id) & (UserTenant.user_id == user_id) & (UserTenant.status == StatusEnum.VALID.value)))
                    .where(cls.model.status == StatusEnum.VALID.value).dicts())
