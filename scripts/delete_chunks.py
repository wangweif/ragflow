import requests
import json

def delete_all_chunks(base_url, token, kb_id):
    """
    删除知识库中所有文档的所有分块
    
    Args:
        base_url: API基础URL
        token: 认证token
        kb_id: 知识库ID
    """
    headers = {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Cookie': cookie
    }
    
    # 1. 获取知识库下的所有文档
    try:
        # 这里需要补充获取文档列表的API调用
        docs = requests.get(f"{base_url}/v1/document/list?kb_id={kb_id}&page=1&size=100", headers=headers).json()
        total = docs.get('data', {}).get('total', 0)
        print(total)
        pass
    except Exception as e:
        print(f"获取文档列表失败: {str(e)}")
        return

    deleted_chunks = 0
    
    # 2. 遍历每个文档
    for doc in docs.get('data', []).get('docs', []):
        doc_id = doc.get('id')
        print(doc_id)
        page = 1
        while True:
            # 获取分块列表
            try:
                chunks_resp = requests.post(
                    f"{base_url}/v1/chunk/list",
                    json={
                        "doc_id": doc_id,
                        "page": page,
                        "size": 100
                    },
                    headers=headers
                ).json()
                
                if not chunks_resp.get('data', {}).get('chunks'):
                    break
                    
                chunks = chunks_resp['data']['chunks']
                chunk_ids = [chunk['chunk_id'] for chunk in chunks]
                
                # 删除分块
                if chunk_ids:
                    delete_resp = requests.post(
                        f"{base_url}/v1/chunk/rm",
                        headers=headers,
                        json={
                            "doc_id": doc_id,
                            "chunk_ids": chunk_ids
                        }
                    ).json()
                    
                    if delete_resp.get('code') == 0:
                        deleted_chunks += len(chunk_ids)
                        print(f"成功删除文档 {doc_id} 的 {len(chunk_ids)} 个分块")
                    else:
                        print(f"删除文档 {doc_id} 的分块失败: {delete_resp.get('message')}")
                
                if len(chunks) < 99:  # 如果返回数量小于页大小，说明已经是最后一页
                    break
                    
                page += 1
                
            except Exception as e:
                print(f"处理文档 {doc_id} 时发生错误: {str(e)}")
                continue

    print(f"总共删除了 {deleted_chunks} 个分块")

if __name__ == "__main__":
    # !!!!!如果没删干净，可以多运行几次!!!!!!!!!
    # 使用示例
    base_url = "http://know.baafs.net.cn"  # 替换为实际的API地址
    token = "IjRmODJhMDkyM2NlZjExZjBhNThhMDk2ODEwMDYyMjNkIg.aDj_iQ.RIyNYOLA5RzsSzkPmELsUrvinW0"  # 替换为实际的token
    kb_id = "c701d4ba1e7411f0900f5d9844683d0c"  # 替换为要删除的知识库ID
    cookie = "session=m-yAdK7M7k34UqRampW8NAi5IY9fhrHCHMBlxYgQSrU"
    
    delete_all_chunks(base_url, token, kb_id) 