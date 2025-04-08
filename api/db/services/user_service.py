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
from typing import List, Union

import peewee
from werkzeug.security import generate_password_hash, check_password_hash

from api.db import UserTenantRole
from api.db.db_models import DB, UserTenant
from api.db.db_models import User, Tenant
from api.db.services.common_service import CommonService
from api.utils import get_uuid, current_timestamp, datetime_format
from api.db import StatusEnum
from rag.settings import MINIO

logger = logging.getLogger(__name__)
class UserService(CommonService):
    """Service class for managing user-related database operations.
    
    This class extends CommonService to provide specialized functionality for user management,
    including authentication, user creation, updates, and deletions.
    
    Attributes:
        model: The User model class for database operations.
    """
    model = User

    @classmethod
    @DB.connection_context()
    def filter_by_id(cls, user_id):
        """Retrieve a user by their ID.
        
        Args:
            user_id: The unique identifier of the user.
            
        Returns:
            User object if found, None otherwise.
        """
        try:
            user = cls.model.select().where(cls.model.id == user_id).get()
            return user
        except peewee.DoesNotExist:
            return None

    @classmethod
    @DB.connection_context()
    def get_by_email(cls, email):
        """根据邮箱获取用户
        
        Args:
            email: 用户邮箱
            
        Returns:
            User对象，如果未找到则返回None
        """
        try:
            user = cls.model.select().where(
                (cls.model.email == email) & 
                (cls.model.status == StatusEnum.VALID.value)
            ).get()
            return user
        except peewee.DoesNotExist:
            return None

    @classmethod
    @DB.connection_context()
    def query_user(cls, email, password):
        """Authenticate a user with email and password.
        
        Args:
            email: User's email address.
            password: User's password in plain text.
            
        Returns:
            User object if authentication successful, None otherwise.
        """
        user = cls.model.select().where((cls.model.email == email),
                                        (cls.model.status == StatusEnum.VALID.value)).first()
        if user and check_password_hash(str(user.password), password):
            return user
        else:
            return None

    @classmethod
    @DB.connection_context()
    def save(cls, **kwargs):
        if "id" not in kwargs:
            kwargs["id"] = get_uuid()
        if "password" in kwargs:
            kwargs["password"] = generate_password_hash(
                str(kwargs["password"]))

        kwargs["create_time"] = current_timestamp()
        kwargs["create_date"] = datetime_format(datetime.now())
        kwargs["update_time"] = current_timestamp()
        kwargs["update_date"] = datetime_format(datetime.now())
        obj = cls.model(**kwargs).save(force_insert=True)
        return obj

    @classmethod
    @DB.connection_context()
    def create_user(cls, email, nickname, password=None, team_id=None, role=None, tenant_id=None):
        """创建新用户
        
        Args:
            email: 用户邮箱
            nickname: 用户昵称
            password: 用户密码，如果不提供则生成随机密码
            team_id: 团队ID
            role: 用户角色
            tenant_id: 租户ID
            
        Returns:
            新创建的用户对象
        """
        # 检查邮箱是否已存在
        existing_user = cls.get_by_email(email)
        if existing_user:
            return existing_user
            
        # 如果未提供密码，生成随机密码
        if not password:
            password = get_uuid()[:8]
            
        # logger.info(f"创建用户: email={email}, nickname={nickname}, team_id={team_id}, role={role}, tenant_id={tenant_id}")
        # 创建用户
        user_data = {
            "email": email,
            "nickname": nickname,
            "password": password,
            "is_authenticated": "1",
            "is_active": "1",
            "is_anonymous": "0",
            "status": StatusEnum.VALID.value,
            "team_id": team_id,
            "role": role,
            "tenant_id": tenant_id,
            "language": "Chinese"
        }
        
        user = cls.save(**user_data)
        # logger.info(f"用户创建成功: id={user.id}, team_id={user.team_id}, role={user.role}, tenant_id={user.tenant_id}")
        
        # 返回创建的用户
        return cls.get_by_email(email)

    @classmethod
    @DB.connection_context()
    def delete_user(cls, user_ids, update_user_dict):
        with DB.atomic():
            cls.model.update({"status": 0}).where(
                cls.model.id.in_(user_ids)).execute()

    @classmethod
    @DB.connection_context()
    def update_user(cls, user_id, user_dict):
        with DB.atomic():
            if user_dict:
                user_dict["update_time"] = current_timestamp()
                user_dict["update_date"] = datetime_format(datetime.now())
                cls.model.update(user_dict).where(
                    cls.model.id == user_id).execute()

    @classmethod
    @DB.connection_context()
    def get_users_by_team_id(cls, team_id: Union[str, int]) -> List[User]:
        """
        根据team_id查询用户表中的相关用户
        
        Args:
            team_id: 团队ID（字符串或整数类型）
            
        Returns:
            用户列表
        """
        try:
            # 确保team_id是字符串类型
            team_id_str = str(team_id)
            users = User.select().where(
                User.team_id == team_id_str,
                User.status == StatusEnum.VALID.value
            )
            return list(users)
        except Exception as e:
            logger.error(f"查询用户失败: {str(e)}")
            raise


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
