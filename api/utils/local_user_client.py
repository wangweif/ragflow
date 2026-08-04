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
import sqlite3
import logging
import hashlib
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from werkzeug.security import generate_password_hash, check_password_hash
from api.utils import get_uuid, current_timestamp, datetime_format
from api.db.db_models import User
logger = logging.getLogger(__name__)

class LocalUserClient:
    """本地SQLite用户服务客户端，用于管理本地用户数据库"""
    
    def __init__(self, db_path: str = None):
        # 使用当前工作目录下的data文件夹，兼容Windows和Linux
        import os
        if db_path:
            self.db_path = db_path
        else:
            self.db_path = os.environ.get("LOCAL_USER_DB_PATH", "./data/webui.db")
        self._init_database()
    
    def _init_database(self):
        """初始化数据库表结构"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
        except Exception as e:
            logger.error(f"初始化数据库失败: {str(e)}")
            raise
    
    def _dict_factory(self, cursor, row):
        """将SQLite行转换为字典"""
        return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}
    
    def _dict_to_user(self, user_dict: Optional[Dict[str, Any]]):
        """将字典转换为User对象"""
        if not user_dict:
            return None
        
        # 创建User实例
        user = User()
        
        # 将字典数据映射到User对象的属性
        for key, value in user_dict.items():
            if hasattr(user, key):
                setattr(user, key, value)
        
        # 字段映射 - 根据实际数据库字段进行映射
        if 'id' in user_dict:
            setattr(user, 'id', user_dict['ragflow_user_id'])
        if 'name' in user_dict:
            setattr(user, 'nickname', user_dict['name'])
        elif 'nickname' not in user_dict and hasattr(user, 'nickname'):
            setattr(user, 'nickname', user_dict.get('email', '').split('@')[0])  # 使用邮箱前缀作为默认昵称
        if 'profile_image_url' in user_dict:
            setattr(user, 'avatar', user_dict['profile_image_url'])
        
        return user
    
    def get_user_by_email(self, email: str) -> Optional['User']:
        """根据邮箱获取用户信息"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = self._dict_factory
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT * FROM user 
                    WHERE email = ? AND status = 1
                """, (email,))
                
                user_dict = cursor.fetchone()
                if user_dict:
                    return self._dict_to_user(user_dict)
                return None
                
        except Exception as e:
            logger.error(f"根据邮箱获取用户失败: {str(e)}")
            return None
    
    def get_user_by_id(self, user_id: str) -> Optional['User']:
        """根据用户ID获取用户信息"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = self._dict_factory
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT * FROM user 
                    WHERE ragflow_user_id = ? AND status = 1 OR id = ? AND status = 1
                """, (user_id, user_id))
                
                user_dict = cursor.fetchone()
                if user_dict:
                    return self._dict_to_user(user_dict)
                return None
                
        except Exception as e:
            logger.error(f"根据ID获取用户失败: {str(e)}")
            return None
    
    def update_user(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        """更新用户信息"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # 如果更新密码，需要哈希
                if 'password' in update_data:
                    update_data['password'] = generate_password_hash(update_data['password'])
                
                # 构建更新语句
                set_clause = ', '.join([f"{key} = ?" for key in update_data.keys()])
                values = list(update_data.values()) + [user_id, user_id]
                
                cursor.execute(f"""
                    UPDATE user 
                    SET {set_clause}
                    WHERE ragflow_user_id = ? OR id = ?
                """, values)
                
                conn.commit()
                
                if cursor.rowcount > 0:
                    return True
                else:
                    logger.warning(f"用户不存在: {user_id}")
                    return False
                    
        except Exception as e:
            logger.error(f"更新用户失败: {str(e)}")
            return False
    
    def get_users_by_team_id(self, team_id: str) -> List['User']:
        """根据团队ID获取用户列表"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = self._dict_factory
                cursor = conn.cursor()  
                
                cursor.execute("""
                    SELECT * FROM user 
                    WHERE team_id = ? AND status = 1
                """, (team_id,))
                
                users_dict = cursor.fetchall()
                users = [self._dict_to_user(user_dict) for user_dict in users_dict if user_dict]
                users = [user for user in users if user is not None]  # 过滤掉None值
                return users
                
        except Exception as e:
            logger.error(f"根据团队ID获取用户失败: {str(e)}")
            return []
    
    def _row_to_group_dict(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """将openwebui的group行转换为ragflow团队字典结构"""
        import json
        try:
            user_ids = json.loads(row.get('user_ids') or '[]')
        except (ValueError, TypeError):
            user_ids = []
        return {
            'id': row.get('id'),
            'name': row.get('name'),
            'description': row.get('description'),
            # openwebui的group没有tenant_id，用owner(user_id)兜底以兼容原有字段
            'tenant_id': row.get('user_id'),
            'created_by': row.get('user_id'),
            'parent_id': row.get('parent_id'),
            'user_ids': user_ids,
        }

    def list_groups(self) -> List[Dict[str, Any]]:
        """获取openwebui中所有部门(group)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = self._dict_factory
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM "group"')
                rows = cursor.fetchall()
                return [self._row_to_group_dict(row) for row in rows]
        except Exception as e:
            logger.error(f"获取部门列表失败: {str(e)}")
            return []

    def get_group_by_id(self, group_id: str) -> Optional[Dict[str, Any]]:
        """根据部门(group)ID获取部门信息"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = self._dict_factory
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM "group" WHERE id = ?', (group_id,))
                row = cursor.fetchone()
                return self._row_to_group_dict(row) if row else None
        except Exception as e:
            logger.error(f"获取部门失败: {str(e)}")
            return None

    def list_groups_by_parent_id(self, parent_id: str) -> List[Dict[str, Any]]:
        """获取指定父部门下的所有子部门"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = self._dict_factory
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM "group" WHERE parent_id = ?', (parent_id,))
                rows = cursor.fetchall()
                return [self._row_to_group_dict(row) for row in rows]
        except Exception as e:
            logger.error(f"获取子部门列表失败: {str(e)}")
            return []

    def get_users_by_group_id(self, group_id: str) -> List['User']:
        """根据部门(group)ID获取成员用户列表，成员以group.user_ids为准"""
        try:
            group = self.get_group_by_id(group_id)
            if not group:
                return []

            user_ids = group.get('user_ids') or []
            if not user_ids:
                return []

            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = self._dict_factory
                cursor = conn.cursor()

                placeholders = ','.join(['?'] * len(user_ids))
                cursor.execute(
                    f"""
                    SELECT * FROM user
                    WHERE id IN ({placeholders}) AND status = 1
                    """,
                    user_ids,
                )
                users_dict = cursor.fetchall()

            users = [self._dict_to_user(user_dict) for user_dict in users_dict if user_dict]
            return [user for user in users if user is not None]
        except Exception as e:
            logger.error(f"根据部门ID获取成员失败: {str(e)}")
            return []

    def delete_user(self, user_id: str) -> bool:
        """删除用户（软删除）"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = datetime.now()

                cursor.execute("""
                    UPDATE user 
                    SET status = 0, update_time = ?, update_date = ?
                    WHERE ragflow_user_id = ?
                """, (current_timestamp(), datetime_format(now), user_id))
                
                conn.commit()
                
                if cursor.rowcount > 0:
                    return True
                else:
                    logger.warning(f"用户不存在: {user_id}")
                    return False
                    
        except Exception as e:
            logger.error(f"删除用户失败: {str(e)}")
            return False

# 创建全局实例
local_user_client = LocalUserClient() 