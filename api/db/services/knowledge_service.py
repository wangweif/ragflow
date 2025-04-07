from typing import List, Dict, Any
from api.db.models.knowledge_authorization import KnowledgeAuthorization
from api.db.models.status_enum import StatusEnum
from api.utils.logger import logger

class KnowledgeService:
    @classmethod
    @DB.connection_context()
    def get_authorized_users(cls, knowledge_id: str) -> List[Dict[str, Any]]:
        """
        获取知识库授权给的用户列表
        
        Args:
            knowledge_id: 知识库ID
            
        Returns:
            授权用户列表，包含用户ID和权限信息
        """
        try:
            # 查询知识库授权表
            authorized_users = KnowledgeAuthorization.select().where(
                KnowledgeAuthorization.knowledge_id == knowledge_id,
                KnowledgeAuthorization.status == StatusEnum.VALID.value
            )
            
            # 转换为字典列表
            result = []
            for auth in authorized_users:
                result.append({
                    'user_id': auth.user_id,
                    'permission': auth.permission,
                    'created_at': auth.created_at,
                    'updated_at': auth.updated_at
                })
            
            return result
        except Exception as e:
            logger.error(f"获取知识库授权用户失败: {str(e)}")
            raise 