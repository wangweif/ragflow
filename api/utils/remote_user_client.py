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
import requests
import json
from typing import Optional, Dict, Any, List
from api import settings
from api.constants import REMOTE_USER_API_BASE

logger = logging.getLogger(__name__)

class RemoteUserClient:
    """远程用户服务客户端，用于与192.168.8.88服务器的用户API进行交互"""
    
    def __init__(self, base_url: str = None, token: str = None):
        self.base_url = base_url or REMOTE_USER_API_BASE
        self.timeout = getattr(settings, 'REMOTE_USER_API_TIMEOUT', 30)
        self.session = requests.Session()
        # 设置默认请求头
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'RAGFlow-Remote-Client/1.0'
        })
        if token:
            self.session.headers.update({
                'Authorization': f'Bearer {token}'
            })
    def _make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None, token: str = None) -> Dict[str, Any]:
        """发送HTTP请求到远程服务"""
        url = f"{self.base_url}{endpoint}"
        
        # 合并请求头
        request_headers = self.session.headers.copy()
        if headers:
            request_headers.update(headers)
        if token:
            request_headers['Authorization'] = f'Bearer {token}'
        
        try:
            logger.debug(f"向远程服务发送{method}请求: {url}")
            response = self.session.request(
                method=method.upper(),
                url=url,
                json=data if data else None,
                headers=request_headers,
                timeout=self.timeout
            )
            
            # 检查响应状态
            response.raise_for_status()
            
            # 解析JSON响应
            try:
                result = response.json()
                logger.debug(f"远程服务响应: {result}")
                return result
            except json.JSONDecodeError:
                logger.error(f"无法解析远程服务响应: {response.text}")
                return {
                    'code': -1,
                    'message': '远程服务响应格式错误',
                    'data': None
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"请求远程服务失败: {str(e)}")
            return {
                'code': -1,
                'message': f'请求远程服务失败: {str(e)}',
                'data': None
            }
    
    def create_user(self, user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """创建用户"""
        result = self._make_request('POST', '/v1/auths/signup', user_data)
        return result
    
    def update_user(self, user_id: str, update_data: Dict[str, Any], token: str = None) -> bool:
        """更新用户信息"""
        update_data['user_id'] = user_id
        result = self._make_request('POST', '/user/setting', update_data, token=token)
        return result.get('code') == 0
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """验证用户令牌"""
        result = self._make_request('GET', '/user/info', token=token)
        if result.get('code') == 0:
            return result.get('data')
        else:
            logger.warning(f"令牌验证失败: {result.get('message')}")
            return None
    
    def get_token_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """根据邮箱获取用户令牌"""
        data = {'email': email}
        result = self._make_request('POST', '/user/get_token_by_email', data)
        if result.get('code') == 0:
            return result.get('data')
        else:
            logger.warning(f"获取用户令牌失败: {result.get('message')}")
            return None
    
    def reset_password(self, user_id: str, admin_token: str) -> bool:
        """重置用户密码"""
        data = {'user_id': user_id}
        result = self._make_request('POST', '/user/reset_password', data, token=admin_token)
        return result.get('code') == 0
    
    def get_users_by_team_id(self, team_id: str) -> List[Dict[str, Any]]:
        """根据团队ID获取用户列表"""
        data = {'team_id': team_id}
        result = self._make_request('POST', '/user/get_users_by_team', data)
        if result.get('code') == 0:
            return result.get('data', [])
        else:
            logger.warning(f"获取团队用户失败: {result.get('message')}")
            return []
    
    def delete_user(self, user_id: str, admin_token: str) -> bool:
        """删除用户"""
        data = {'user_id': user_id}
        result = self._make_request('POST', '/user/delete', data, token=admin_token)
        return result.get('code') == 0

# 创建全局实例
remote_user_client = RemoteUserClient()