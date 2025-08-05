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
from api.constants import LOCAL_USER_DB_PATH
logger = logging.getLogger(__name__)

class LocalUserClient:
    """本地SQLite用户服务客户端，用于管理本地用户数据库"""
    
    def __init__(self, db_path: str = None):
        # 使用当前工作目录下的data文件夹，兼容Windows和Linux
        import os
        if db_path:
            self.db_path = db_path
        else:
            self.db_path = LOCAL_USER_DB_PATH
        self._init_database()
    
    def _init_database(self):
        """初始化数据库表结构"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                logger.info("用户数据库表初始化成功")
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
    
    def authenticate_user(self, email: str, password: str) -> Optional['User']:
        """用户认证"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = self._dict_factory
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT * FROM user 
                    WHERE email = ? AND status = 1 AND is_active = 1
                """, (email,))
                
                user_dict = cursor.fetchone()
                if user_dict and check_password_hash(user_dict['password'], password):
                    # 更新最后登录时间
                    now = datetime.now()
                    cursor.execute("""
                        UPDATE user 
                        SET last_login_time = ?, update_time = ?, update_date = ?
                        WHERE id = ?
                    """, (now.strftime('%Y-%m-%d %H:%M:%S'), current_timestamp(), 
                          datetime_format(now), user_dict['id']))
                    conn.commit()
                    
                    logger.info(f"用户认证成功: {email}")
                    return self._dict_to_user(user_dict)
                else:
                    logger.warning(f"用户认证失败: {email}")
                    return None
                    
        except Exception as e:
            logger.error(f"用户认证失败: {str(e)}")
            return None
    
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
                    logger.info(f"根据邮箱获取用户成功: {email}")
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
                    logger.info(f"根据ID获取用户成功: {user_id}")
                    return self._dict_to_user(user_dict)
                return None
                
        except Exception as e:
            logger.error(f"根据ID获取用户失败: {str(e)}")
            return None
    
    def create_user(self, user_data: Dict[str, Any]) -> Optional['User']:
        """创建用户"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = self._dict_factory
                cursor = conn.cursor()
                
                # 检查邮箱是否已存在
                cursor.execute("SELECT id FROM user WHERE email = ?", (user_data.get('email'),))
                if cursor.fetchone():
                    logger.warning(f"邮箱已存在: {user_data.get('email')}")
                    return None
                
                # 准备用户数据
                now = datetime.now()
                user_id = user_data.get('id', get_uuid())
                password_hash = generate_password_hash(user_data.get('password', ''))
                
                insert_data = {
                    'id': user_id,
                    'email': user_data.get('email', ''),
                    'nickname': user_data.get('nickname', ''),
                    'password': password_hash,
                    'avatar': user_data.get('avatar', ''),
                    'is_superuser': int(user_data.get('is_superuser', False)),
                    'status': user_data.get('status', 1),
                    'language': user_data.get('language', 'Chinese'),
                    'login_channel': user_data.get('login_channel', 'password'),
                    'last_login_time': user_data.get('last_login_time', ''),
                    'create_time': current_timestamp(),
                    'create_date': datetime_format(now),
                    'update_time': current_timestamp(),
                    'update_date': datetime_format(now),
                    'is_authenticated': int(user_data.get('is_authenticated', True)),
                    'is_active': int(user_data.get('is_active', True)),
                    'is_anonymous': int(user_data.get('is_anonymous', False)),
                    'team_id': user_data.get('team_id', ''),
                    'role': user_data.get('role', ''),
                    'tenant_id': user_data.get('tenant_id', ''),
                    'access_token': user_data.get('access_token', '')
                }
                
                # 插入用户数据
                placeholders = ', '.join(['?' for _ in insert_data])
                columns = ', '.join(insert_data.keys())
                values = list(insert_data.values())
                
                cursor.execute(f"""
                    INSERT INTO user ({columns}) 
                    VALUES ({placeholders})
                """, values)
                
                conn.commit()
                
                # 返回创建的用户信息
                created_user = self.get_user_by_id(user_id)
                logger.info(f"创建用户成功: {user_data.get('email')}")
                return created_user
                
        except Exception as e:
            logger.error(f"创建用户失败: {str(e)}")
            return None
    
    def update_user(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        """更新用户信息"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # 准备更新数据
                now = datetime.now()
                update_data['update_time'] = current_timestamp()
                update_data['update_date'] = datetime_format(now)
                
                # 如果更新密码，需要哈希
                if 'password' in update_data:
                    update_data['password'] = generate_password_hash(update_data['password'])
                
                # 构建更新语句
                set_clause = ', '.join([f"{key} = ?" for key in update_data.keys()])
                values = list(update_data.values()) + [user_id]
                
                cursor.execute(f"""
                    UPDATE user 
                    SET {set_clause}
                    WHERE ragflow_user_id = ?
                """, values)
                
                conn.commit()
                
                if cursor.rowcount > 0:
                    logger.info(f"更新用户成功: {user_id}")
                    return True
                else:
                    logger.warning(f"用户不存在: {user_id}")
                    return False
                    
        except Exception as e:
            logger.error(f"更新用户失败: {str(e)}")
            return False
    
    def verify_token(self, token: str) -> Optional['User']:
        """验证用户令牌（这里简单实现，实际应该用JWT）"""
        try:
            # 这里简单按access_token字段查询，实际应该验证JWT
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = self._dict_factory
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT * FROM user 
                    WHERE access_token = ? AND status = 1 AND is_active = 1
                """, (token,))
                
                user_dict = cursor.fetchone()
                if user_dict:
                    logger.info(f"令牌验证成功: {user_dict['email']}")
                    return self._dict_to_user(user_dict)
                return None
                
        except Exception as e:
            logger.error(f"令牌验证失败: {str(e)}")
            return None
    
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
                logger.info(f"根据团队ID获取用户成功: {team_id}, 用户数: {len(users)}")
                return users
                
        except Exception as e:
            logger.error(f"根据团队ID获取用户失败: {str(e)}")
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
                    logger.info(f"删除用户成功: {user_id}")
                    return True
                else:
                    logger.warning(f"用户不存在: {user_id}")
                    return False
                    
        except Exception as e:
            logger.error(f"删除用户失败: {str(e)}")
            return False

# 创建全局实例
local_user_client = LocalUserClient() 