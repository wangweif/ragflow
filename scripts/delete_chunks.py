import requests
import json
from typing import Dict, List, Optional
import time
import pymysql
from pymysql.cursors import DictCursor

class ChunkDeleter:
    def __init__(self, base_url: str, token: str, kb_id: str, cookie: str, db_config: Dict):
        """
        初始化ChunkDeleter
        
        Args:
            base_url: API基础URL
            token: 认证token
            kb_id: 知识库ID
            cookie: Cookie信息
            db_config: 数据库配置
        """
        self.base_url = base_url.rstrip('/')
        self.headers = {
            'Authorization': token,
            'Content-Type': 'application/json',
            'Cookie': cookie
        }
        self.kb_id = kb_id
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        self.total_deleted_chunks = 0
        self.db_config = db_config
        self.db_connection = None

    def _connect_db(self):
        """连接数据库"""
        if not self.db_connection:
            self.db_connection = pymysql.connect(
                **self.db_config,
                cursorclass=DictCursor
            )
        return self.db_connection

    def _make_request(self, method: str, endpoint: str, **kwargs) -> Optional[Dict]:
        """封装HTTP请求"""
        url = f"{self.base_url}{endpoint}"
        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"请求失败: {method} {url} - {str(e)}")
            return None

    def _get_chunks(self, doc_id: str, page: int, size: int = 10) -> Optional[Dict]:
        """获取分块列表"""
        return self._make_request(
            'POST',
            "/v1/chunk/list",
            json={"doc_id": doc_id, "page": page, "size": size}
        )

    def _delete_chunks(self, doc_id: str, chunk_ids: List[str]) -> bool:
        """删除分块"""
        resp = self._make_request(
            'POST',
            "/v1/chunk/rm",
            json={"doc_id": doc_id, "chunk_ids": chunk_ids}
        )
        if resp and resp.get('code') == 0:
            return True
        print(f"删除分块失败: {resp.get('message') if resp else '未知错误'}")
        return False

    def delete_all_chunks(self):
        self._connect_db()  # 确保数据库连接已建立
        select_sql = "SELECT id, chunk_num FROM document WHERE kb_id = %s AND chunk_num > 0"
        with self.db_connection.cursor() as cursor:
            cursor.execute(select_sql, (self.kb_id,))
            docs = cursor.fetchall()
            for doc in docs:
                doc_id = doc.get('id')
                if not doc_id:
                    continue
                if doc.get('chunk_num') == 0:
                    continue
                    
                self._delete_document_chunks(doc_id)
                time.sleep(0.5)
        
        print(f"\n任务完成！总共删除了 {self.total_deleted_chunks} 个分块")

    def _delete_document_chunks(self, doc_id: str):
        """删除单个文档的所有分块
        
        Args:
            doc_id: 文档ID
            
        Returns:
            None
        """
        print(f"\n开始处理文档: {doc_id}")
        doc_deleted_chunks = 0
        page = 1
        size = 10
        
        while True:
            # 同步获取分块列表
            chunks_resp = self._get_chunks(doc_id, page, size)
            print(chunks_resp)
            # 如果没有数据，退出循环
            if not chunks_resp or not chunks_resp.get('data', {}).get('chunks'):
                break
                
            # 获取当前页的分块ID列表
            chunks = chunks_resp['data']['chunks']
            chunk_ids = [chunk['chunk_id'] for chunk in chunks]
            print(len(chunk_ids))
            
            # 同步删除分块
            if chunk_ids:
                delete_success = self._delete_chunks(doc_id, chunk_ids)
                if delete_success:
                    chunk_count = len(chunk_ids)
                    doc_deleted_chunks += chunk_count
                    self.total_deleted_chunks += chunk_count
                    print(f"成功删除 {chunk_count} 个分块 (当前文档: {doc_deleted_chunks}, 总计: {self.total_deleted_chunks})")
            
            # 如果获取的数据少于页大小，说明是最后一页
            if len(chunks) < size:
                break
                
            # 继续处理下一页
            page += 1
        
        print(f"文档 {doc_id} 处理完成，共删除 {doc_deleted_chunks} 个分块")
        return doc_deleted_chunks


if __name__ == "__main__":
    # 使用示例
    base_url = "http://know.baafs.net.cn"  # 替换为实际的API地址
    token = "IjE2MmFjZjk4M2QxZTExZjBhNThhMDk2ODEwMDYyMjNkIg.aDlOAw.Mm3HK4Lr5WQixDq4qDvnIXskbB4"  # 替换为实际的token
    kb_id = "d78680ec258b11f0900f5d9844683d0c"  # 替换为要删除的知识库ID
    cookie = "session=5pA9thWMxt3RpEK2pSM66PHdM2VNdSbnU59rlORbpkA"
    
    # 数据库配置
    db_config = {
        'host': '192.168.8.88',
        'port': 5455,
        'user': 'root',
        'password': 'infini_rag_flow',
        'database': 'rag_flow'
    }
    
    deleter = ChunkDeleter(base_url, token, kb_id, cookie, db_config)
    deleter.delete_all_chunks()