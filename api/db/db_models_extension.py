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

from datetime import datetime
from peewee import *
from playhouse.shortcuts import model_to_dict

# ================== 团队相关模型 ==================

# 基础模型定义，避免循环导入
class BaseModelExtension(Model):
    """基础模型，替代从db_models导入的BaseModel"""
    create_time = BigIntegerField(null=True, index=True)
    create_date = DateTimeField(null=True, index=True)
    update_time = BigIntegerField(null=True, index=True)
    update_date = DateTimeField(null=True, index=True)

    def to_dict(self):
        return self.__dict__["__data__"]

class DataBaseModelExtension(BaseModelExtension):
    """数据库模型基类，替代从db_models导入的DataBaseModel"""
    class Meta:
        database = None  # 会在register_models中设置

class Team(DataBaseModelExtension):
    """团队模型"""
    id = CharField(max_length=64, primary_key=True)  # 使用 UUID 字符串作为主键
    tenant_id = CharField(max_length=64, null=False, help_text="租户ID", index=True)
    name = CharField(max_length=64, null=False, help_text="团队名称", index=True)
    description = TextField(null=True, help_text="团队描述")
    created_by = CharField(max_length=64, null=False, help_text="创建者ID", index=True)
    members = TextField(null=True, help_text="团队成员JSON，存储格式：{user_id: {role: 'owner|admin|member', joined_at: timestamp}}")
    parent_id = CharField(max_length=64, null=True, help_text="父团队ID", index=True)
    status = CharField(max_length=1, null=True, help_text="状态(0: 已删除, 1: 有效)", default="1", index=True)
    
    class Meta:
        table_name = "teams"
        
    def to_dict(self):
        """转换为字典"""
        return model_to_dict(self)


# ================== 权限相关模型 ==================

class KnowledgebasePermission(DataBaseModelExtension):
    """知识库权限模型"""
    id = CharField(max_length=64, primary_key=True)  # 使用 UUID 字符串作为主键
    kb_id = CharField(max_length=64, null=False, help_text="知识库ID", index=True)
    tenant_id = CharField(max_length=64, null=False, help_text="租户ID", index=True)
    user_id = CharField(max_length=64, null=True, help_text="用户ID", index=True)
    team_id = CharField(max_length=64, null=True, help_text="团队ID", index=True)
    permission_type = CharField(max_length=16, null=False, help_text="权限类型: read, write", index=True)
    granted_by = CharField(max_length=64, null=False, help_text="授权人ID", index=True)
    granted_at = DateTimeField(default=datetime.now, help_text="授权时间")
    status = CharField(max_length=1, null=True, help_text="状态(0: 已撤销, 1: 有效)", default="1", index=True)
    
    class Meta:
        table_name = "kb_permissions"
        indexes = [
            (('kb_id', 'user_id', 'permission_type'), True)  # 联合唯一索引：知识库ID、用户ID和权限类型
        ]

    def to_dict(self):
        """转换为字典"""
        return model_to_dict(self)


# ================== 目录相关模型 ==================


class Directory(DataBaseModelExtension):
    """目录模型"""

    id = CharField(max_length=32, primary_key=True)
    kb_id = CharField(max_length=256, null=False, help_text="知识库ID", index=True)
    name = CharField(max_length=255, null=False, help_text="目录名称", index=True)
    parent_id = CharField(max_length=32, null=True, help_text="父目录ID", index=True)
    created_by = CharField(max_length=32, null=False, help_text="创建者ID", index=True)

    class Meta:
        table_name = "directory"

    def to_dict(self):
        """转换为字典"""
        return model_to_dict(self)


# 注册模型，确保数据库初始化时创建表
def register_models():
    """注册模型到数据库"""
    # 在函数内部导入DB，避免循环依赖
    from api.db.db_models import DB
    
    # 设置数据库连接
    DataBaseModelExtension._meta.database = DB
    Team._meta.database = DB
    KnowledgebasePermission._meta.database = DB
    Directory._meta.database = DB

    models = [Team, KnowledgebasePermission, Directory]
    DB.create_tables(models, safe=True)
