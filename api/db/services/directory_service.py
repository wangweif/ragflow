#
#  Copyright 2024 The InfiniFlow Authors. All Rights Reserved.
#

import time
from api.db.db_models import DB, Document
from api.db.db_models_extension import Directory
from api.db.services.common_service import CommonService
from api.utils import get_uuid


class DirectoryService(CommonService):
    """目录服务类"""

    model = Directory

    @classmethod
    @DB.connection_context()
    def create_directory(cls, kb_id, name, parent_id=None, created_by=None):
        """创建目录"""
        # 检查同级目录下名称是否重复
        existing_directory = Directory.get_or_none(
            Directory.kb_id == kb_id,
            Directory.parent_id == parent_id,
            Directory.name == name,
        )
        if existing_directory:
            return None, "目录名称重复!"

        # 创建目录
        directory = Directory.create(
            id=get_uuid(),
            kb_id=kb_id,
            name=name,
            parent_id=parent_id,
            created_by=created_by,
            create_time=int(time.time() * 1000),
            create_date=time.strftime("%Y-%m-%d %H:%M:%S"),
            update_time=int(time.time() * 1000),
            update_date=time.strftime("%Y-%m-%d %H:%M:%S"),
        )

        return directory, None

    @classmethod
    @DB.connection_context()
    def get_directories_by_kb(cls, kb_id, parent_id=None, get_all=False):
        """根据知识库ID获取目录列表"""
        query = cls.model.select().where(cls.model.kb_id == kb_id)
        if get_all:
            # 如果get_all为True，返回所有目录
            pass
        elif parent_id is not None:
            query = query.where(cls.model.parent_id == parent_id)
        else:
            query = query.where(cls.model.parent_id.is_null())

        return list(query.order_by(cls.model.name))

    @classmethod
    @DB.connection_context()
    def get_directory_tree(cls, kb_id, parent_id=None):
        """获取目录树结构"""
        directories = cls.get_directories_by_kb(kb_id, parent_id)
        result = []

        for directory in directories:
            directory_dict = directory.to_dict()
            # 递归获取子目录
            children = cls.get_directory_tree(kb_id, directory.id)
            if children:
                directory_dict["children"] = children
            result.append(directory_dict)

        return result

    @classmethod
    @DB.connection_context()
    def rename_directory(cls, directory_id, new_name, user_id):
        """重命名目录"""
        # 获取目录
        directory = cls.model.get_or_none(cls.model.id == directory_id)
        if not directory:
            return False, "目录不存在"

        # 检查同级目录下名称是否重复
        existing_directory = cls.model.get_or_none(
            cls.model.kb_id == directory.kb_id,
            cls.model.parent_id == directory.parent_id,
            cls.model.name == new_name,
            cls.model.id != directory_id,
        )
        if existing_directory:
            return False, "目录名称重复"

        # 更新目录名称
        directory.name = new_name
        directory.update_time = int(time.time() * 1000)
        directory.update_date = time.strftime("%Y-%m-%d %H:%M:%S")
        directory.save()

        return True, None

    @classmethod
    @DB.connection_context()
    def delete_directory(cls, directory_id, user_id):
        """删除目录"""
        # 获取目录
        directory = cls.model.get_or_none(cls.model.id == directory_id)
        if not directory:
            return False, "目录不存在"

        # # 检查目录是否为空（包括子目录）
        # is_empty, error_msg = cls.is_directory_empty_recursive(directory_id)
        # if not is_empty:
        #     return False, f"无法删除目录：{error_msg}"

        # # 删除目录
        # directory.delete_instance()
        # 递归删除目录下的所有内容
        success, error_msg = cls._delete_directory_recursive(directory_id, user_id)
        if not success:
            return False, error_msg

        return True, None

    @classmethod
    @DB.connection_context()
    def has_subdirectories(cls, directory_id):
        """检查目录是否有子目录"""
        return cls.model.select().where(cls.model.parent_id == directory_id).exists()

    @classmethod
    @DB.connection_context()
    def get_directory_path(cls, directory_id):
        """获取目录路径"""
        path = []
        current_id = directory_id

        while current_id:
            directory = cls.model.get_or_none(cls.model.id == current_id)
            if not directory:
                break
            path.insert(0, {"id": directory.id, "name": directory.name})
            current_id = directory.parent_id

        return path

    @classmethod
    @DB.connection_context()
    def has_documents(cls, directory_id):
        """检查目录是否有文档"""
        return Document.select().where(Document.directory_id == directory_id).exists()

    @classmethod
    @DB.connection_context()
    def get_documents_count(cls, directory_id):
        """获取目录下文档数量"""
        return Document.select().where(Document.directory_id == directory_id).count()

    @classmethod
    @DB.connection_context()
    def get_all_subdirectory_ids(cls, directory_id):
        """递归获取所有子目录ID"""
        subdirectory_ids = []

        def _get_subdirectories(parent_id):
            subdirectories = cls.model.select().where(cls.model.parent_id == parent_id)
            for subdir in subdirectories:
                subdirectory_ids.append(subdir.id)
                _get_subdirectories(subdir.id)

        _get_subdirectories(directory_id)
        return subdirectory_ids

    @classmethod
    @DB.connection_context()
    def is_directory_empty_recursive(cls, directory_id):
        """递归检查目录及其所有子目录是否为空（没有文档和子目录）"""
        # 检查当前目录是否有文档
        if cls.has_documents(directory_id):
            return False, "目录下还有文档"

        # 检查是否有子目录
        subdirectories = cls.model.select().where(cls.model.parent_id == directory_id)
        if not subdirectories.exists():
            return True, None

        # 递归检查每个子目录
        for subdir in subdirectories:
            is_empty, error = cls.is_directory_empty_recursive(subdir.id)
            if not is_empty:
                return False, f"子目录 '{subdir.name}' {error}"

        return False, "目录下还有子目录"

    @classmethod
    @DB.connection_context()
    def _delete_directory_recursive(cls, directory_id, user_id):
        """递归删除目录及其所有内容（包括文档和子目录）"""
        try:
            # 1. 获取目录下的所有文档并删除
            documents = Document.select().where(Document.directory_id == directory_id)
            doc_ids = [doc.id for doc in documents]

            if doc_ids:
                # 使用 delete_documents_core 函数删除文档
                from api.db.services.document_service import delete_documents_core

                success, error_msg = delete_documents_core(doc_ids, user_id)

                # 检查删除结果
                if not success:
                    return False, f"删除文档失败：{error_msg}"

            # 2. 递归删除所有子目录
            subdirectories = cls.model.select().where(
                cls.model.parent_id == directory_id
            )
            for subdir in subdirectories:
                success, error_msg = cls._delete_directory_recursive(subdir.id, user_id)
                if not success:
                    return False, f"删除子目录 '{subdir.name}' 失败：{error_msg}"

            # 3. 删除目录本身
            directory = cls.model.get_or_none(cls.model.id == directory_id)
            if directory:
                directory.delete_instance()

            return True, None

        except Exception as e:
            return False, f"删除过程中发生错误：{str(e)}"
