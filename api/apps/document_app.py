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
#  limitations under the License
#
import json
import os.path
import pathlib
import re
import logging

import flask
from flask import request, Blueprint
from flask_login import login_required, current_user

from deepdoc.parser.html_parser import RAGFlowHtmlParser
from rag.nlp import search

from api.db import FileType, TaskStatus, ParserType, FileSource
from api.db.db_models import File, Task
from api.db.services.file2document_service import File2DocumentService
from api.db.services.file_service import FileService
from api.db.services.task_service import queue_tasks
from api.db.services.user_service import UserTenantService
from api.db.services import duplicate_name
from api.db.services.knowledgebase_service import KnowledgebaseService
from api.db.services.task_service import TaskService
from api.db.services.document_service import DocumentService, doc_upload_and_parse
from api.db.services.directory_service import DirectoryService
from api.utils.api_utils import (
    server_error_response,
    get_data_error_result,
    validate_request,
)
from api.utils import get_uuid
from api import settings
from api.utils.api_utils import get_json_result
from rag.utils.storage_factory import STORAGE_IMPL
from api.utils.file_utils import filename_type, thumbnail, get_project_base_directory
from api.utils.web_utils import html2pdf, is_valid_url
from api.constants import IMG_BASE64_PREFIX
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

manager = Blueprint("document", __name__)


def create_directory_structure(kb_id, relative_path, user_id, base_directory_id=None):
    """
    根据相对路径创建目录结构
    返回最终目录的ID
    """
    logger.info(f"=== create_directory_structure Debug ===")
    logger.info(f"kb_id: {kb_id}")
    logger.info(f"relative_path: {relative_path}")
    logger.info(f"base_directory_id: {base_directory_id}")
    logger.info(f"========================================")

    if not relative_path:
        logger.info("relative_path为空，返回base_directory_id")
        return base_directory_id

    # 分割路径，去除文件名（最后一部分）
    path_parts = relative_path.split("/")
    logger.info(f"path_parts: {path_parts}")

    if len(path_parts) <= 1:
        logger.info("路径层级 <= 1，返回base_directory_id")
        return base_directory_id

    # 去除文件名，只保留目录路径
    dir_parts = path_parts[:-1]
    logger.info(f"需要创建的目录路径: {dir_parts}")

    # 从基础目录开始，如果没有基础目录则从根目录开始
    current_parent_id = base_directory_id

    for dir_name in dir_parts:
        # 检查当前级别是否已存在该目录
        existing_dirs = DirectoryService.get_directories_by_kb(kb_id, current_parent_id)
        existing_dir = None

        for dir_item in existing_dirs:
            if dir_item.name == dir_name:
                existing_dir = dir_item
                break

        if existing_dir:
            # 目录已存在，使用现有目录ID
            current_parent_id = existing_dir.id
        else:
            # 目录不存在，创建新目录
            new_dir, error = DirectoryService.create_directory(
                kb_id=kb_id,
                name=dir_name,
                parent_id=current_parent_id,
                created_by=user_id,
            )
            if error:
                logger.error(f"创建目录失败: {error}")
                raise RuntimeError(f"创建目录失败: {error}")

            current_parent_id = new_dir.id

    logger.info(f"最终创建的目录ID: {current_parent_id}")
    return current_parent_id


@manager.route("/upload", methods=["POST"])  # noqa: F821
@login_required
@validate_request("kb_id")
def upload():
    logger.info("文件上传开始")
    try:
        kb_id = request.form.get("kb_id")
        directory_id = request.form.get("directory_id")  # 获取目录ID参数
        logger.info(f"上传参数 - kb_id: {kb_id}, directory_id: {directory_id}")
        if not kb_id:
            return get_json_result(
                data=False, message='缺少"KB ID"', code=settings.RetCode.ARGUMENT_ERROR
            )
        if "file" not in request.files:
            return get_json_result(
                data=False,
                message="没有文件部分！",
                code=settings.RetCode.ARGUMENT_ERROR,
            )

        file_objs = request.files.getlist("file")
        # 获取文件路径信息（用于多级目录上传）
        file_paths = request.form.getlist("webkitRelativePath")
        logger.info(f"文件数量: {len(file_objs)}, 路径数量: {len(file_paths)}")
        logger.info(f"文件路径: {file_paths}")

        for file_obj in file_objs:
            if file_obj.filename == "":
                return get_json_result(
                    data=False,
                    message="未选择文件！",
                    code=settings.RetCode.ARGUMENT_ERROR,
                )

        e, kb = KnowledgebaseService.get_by_id(kb_id)
        if not e:
            raise LookupError("找不到此知识库！")

        # 处理多级目录文件上传
        file_directory_map = {}

        # 为每个文件确定目标目录
        for i, file_obj in enumerate(file_objs):
            relative_path = None
            if file_paths and i < len(file_paths):
                relative_path = file_paths[i]

            if relative_path and relative_path != file_obj.filename:
                # 有相对路径信息，需要创建目录结构
                try:
                    target_directory_id = create_directory_structure(
                        kb_id, relative_path, current_user.id, directory_id
                    )
                    file_directory_map[i] = target_directory_id
                except Exception as e:
                    logger.error(f"创建目录结构失败: {str(e)}")
                    return get_json_result(
                        data=False,
                        message=f"创建目录结构失败: {str(e)}",
                        code=settings.RetCode.SERVER_ERROR,
                    )
            else:
                # 没有相对路径信息，使用传入的directory_id
                file_directory_map[i] = directory_id
                logger.info(
                    f"文件 {i} ({file_obj.filename}) 将上传到目录: {directory_id}"
                )

        logger.info(f"最终文件目录映射: {file_directory_map}")

        err, files = FileService.upload_document(
            kb, file_objs, current_user.id, directory_id, file_directory_map
        )
        files = [f[0] for f in files]  # remove the blob
        if err:
            return get_json_result(
                data=files, message="\n".join(err), code=settings.RetCode.SERVER_ERROR)
        logger.info(f"文件上传成功: {files}")
        return get_json_result(data=files)
    except Exception as e:
        import traceback
        error_message = f"文件上传失败: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_message)  # 输出到服务器日志
        return get_json_result(
            data=False, message=error_message, code=settings.RetCode.SERVER_ERROR)


@manager.route('/web_crawl', methods=['POST'])  # noqa: F821
@login_required
@validate_request("kb_id", "name", "url")
def web_crawl():
    kb_id = request.form.get("kb_id")
    if not kb_id:
        return get_json_result(
            data=False, message='缺少"KB ID"', code=settings.RetCode.ARGUMENT_ERROR)
    name = request.form.get("name")
    url = request.form.get("url")
    if not is_valid_url(url):
        return get_json_result(
            data=False, message='URL格式无效', code=settings.RetCode.ARGUMENT_ERROR)
    e, kb = KnowledgebaseService.get_by_id(kb_id)
    if not e:
        raise LookupError("找不到此知识库！")

    blob = html2pdf(url)
    if not blob:
        return server_error_response(ValueError("下载失败。"))

    root_folder = FileService.get_root_folder(current_user.id)
    pf_id = root_folder["id"]
    FileService.init_knowledgebase_docs(pf_id, current_user.id)
    kb_root_folder = FileService.get_kb_folder(current_user.id)
    kb_folder = FileService.new_a_file_from_kb(kb.tenant_id, kb.name, kb_root_folder["id"])

    try:
        filename = duplicate_name(
            DocumentService.query,
            name=name + ".pdf",
            kb_id=kb.id)
        filetype = filename_type(filename)
        if filetype == FileType.OTHER.value:
            raise RuntimeError("尚不支持此类型的文件！")

        location = filename
        while STORAGE_IMPL.obj_exist(kb_id, location):
            location += "_"
        STORAGE_IMPL.put(kb_id, location, blob)
        doc = {
            "id": get_uuid(),
            "kb_id": kb.id,
            "parser_id": kb.parser_id,
            "parser_config": kb.parser_config,
            "created_by": current_user.id,
            "type": filetype,
            "name": filename,
            "location": location,
            "size": len(blob),
            "thumbnail": thumbnail(filename, blob)
        }
        if doc["type"] == FileType.VISUAL:
            doc["parser_id"] = ParserType.PICTURE.value
        if doc["type"] == FileType.AURAL:
            doc["parser_id"] = ParserType.AUDIO.value
        if re.search(r"\.(ppt|pptx|pages)$", filename):
            doc["parser_id"] = ParserType.PRESENTATION.value
        if re.search(r"\.(eml)$", filename):
            doc["parser_id"] = ParserType.EMAIL.value
        DocumentService.insert(doc)
        FileService.add_file_from_kb(doc, kb_folder["id"], kb.tenant_id)
    except Exception as e:
        return server_error_response(e)
    return get_json_result(data=True)


@manager.route('/create', methods=['POST'])  # noqa: F821
@login_required
@validate_request("name", "kb_id")
def create():
    req = request.json
    kb_id = req["kb_id"]
    if not kb_id:
        return get_json_result(
            data=False, message='缺少"KB ID"', code=settings.RetCode.ARGUMENT_ERROR)

    try:
        e, kb = KnowledgebaseService.get_by_id(kb_id)
        if not e:
            return get_data_error_result(
                message="找不到此知识库！")

        if DocumentService.query(name=req["name"], kb_id=kb_id):
            return get_data_error_result(
                message="同一知识库中存在重复的文档名称。")

        doc = DocumentService.insert({
            "id": get_uuid(),
            "kb_id": kb.id,
            "parser_id": kb.parser_id,
            "parser_config": kb.parser_config,
            "created_by": current_user.id,
            "type": FileType.VIRTUAL,
            "name": req["name"],
            "location": "",
            "size": 0
        })
        return get_json_result(data=doc.to_json())
    except Exception as e:
        return server_error_response(e)


@manager.route('/list', methods=['GET'])  # noqa: F821
@login_required
def list_docs():
    kb_id = request.args.get("kb_id")
    if not kb_id:
        return get_json_result(
            data=False, message='缺少"KB ID"', code=settings.RetCode.ARGUMENT_ERROR)
    tenants = UserTenantService.query(user_id=current_user.id)
    for tenant in tenants:
        if KnowledgebaseService.query(
                tenant_id=tenant.tenant_id, id=kb_id):
            break
    else:
        return get_json_result(
            data=False, message='只有知识库所有者有权进行此操作。',
            code=settings.RetCode.OPERATING_ERROR)
    keywords = request.args.get("keywords", "")
    directory_id = request.args.get("directory_id")
    page_number = int(request.args.get("page", 1))
    items_per_page = int(request.args.get("page_size", 15))
    orderby = request.args.get("orderby", "create_time")
    desc_param = request.args.get("desc")
    if desc_param is None:
        desc = True
    else:
        desc_param = str(desc_param).strip().lower()
        desc = desc_param not in ("false", "0", "no")
    try:
        docs, tol = DocumentService.get_by_kb_id(
            kb_id, page_number, items_per_page, orderby, desc, keywords, directory_id
        )

        for doc_item in docs:
            if doc_item['thumbnail'] and not doc_item['thumbnail'].startswith(IMG_BASE64_PREFIX):
                doc_item['thumbnail'] = f"/v1/document/image/{kb_id}-{doc_item['thumbnail']}"

        return get_json_result(data={"total": tol, "docs": docs})
    except Exception as e:
        return server_error_response(e)


@manager.route('/infos', methods=['POST'])  # noqa: F821
@login_required
def docinfos():
    req = request.json
    doc_ids = req["doc_ids"]
    for doc_id in doc_ids:
        if not DocumentService.accessible(doc_id, current_user.id):
            return get_json_result(
                data=False,
                message='没有授权。',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
    docs = DocumentService.get_by_ids(doc_ids)
    return get_json_result(data=list(docs.dicts()))


@manager.route('/thumbnails', methods=['GET'])  # noqa: F821
# @login_required
def thumbnails():
    doc_ids = request.args.get("doc_ids").split(",")
    if not doc_ids:
        return get_json_result(
            data=False, message='缺少"文档ID"', code=settings.RetCode.ARGUMENT_ERROR)

    try:
        docs = DocumentService.get_thumbnails(doc_ids)

        for doc_item in docs:
            if doc_item['thumbnail'] and not doc_item['thumbnail'].startswith(IMG_BASE64_PREFIX):
                doc_item['thumbnail'] = f"/v1/document/image/{doc_item['kb_id']}-{doc_item['thumbnail']}"

        return get_json_result(data={d["id"]: d["thumbnail"] for d in docs})
    except Exception as e:
        return server_error_response(e)


@manager.route('/change_status', methods=['POST'])  # noqa: F821
@login_required
@validate_request("doc_id", "status")
def change_status():
    req = request.json
    if str(req["status"]) not in ["0", "1"]:
        return get_json_result(
            data=False,
            message='"状态"必须为0或1！',
            code=settings.RetCode.ARGUMENT_ERROR)

    if not DocumentService.accessible(req["doc_id"], current_user.id):
        return get_json_result(
            data=False,
            message='没有授权。',
            code=settings.RetCode.AUTHENTICATION_ERROR)

    try:
        e, doc = DocumentService.get_by_id(req["doc_id"])
        if not e:
            return get_data_error_result(message="未找到文档！")
        e, kb = KnowledgebaseService.get_by_id(doc.kb_id)
        if not e:
            return get_data_error_result(
                message="找不到此知识库！")

        if not DocumentService.update_by_id(
                req["doc_id"], {"status": str(req["status"])}):
            return get_data_error_result(
                message="数据库错误（文档更新）！")

        status = int(req["status"])
        settings.docStoreConn.update({"doc_id": req["doc_id"]}, {"available_int": status},
                                     search.index_name(kb.tenant_id), doc.kb_id)
        return get_json_result(data=True)
    except Exception as e:
        return server_error_response(e)


@manager.route('/rm', methods=['POST'])  # noqa: F821
@login_required
@validate_request("doc_id")
def rm():
    req = request.json
    doc_ids = req["doc_id"]
    from api.db.services.document_service import delete_documents_core

    success, error_msg = delete_documents_core(doc_ids, current_user.id)

    if not success:
        return get_json_result(
            data=False, message=error_msg, code=settings.RetCode.SERVER_ERROR
        )

    return get_json_result(data=True)


@manager.route('/run', methods=['POST'])  # noqa: F821
@login_required
@validate_request("doc_ids", "run")
def run(): 
    req = request.json
    for doc_id in req["doc_ids"]:
        if not DocumentService.accessible(doc_id, current_user.id):
            return get_json_result(
                data=False,
                message='没有授权。',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
    try:
        for id in req["doc_ids"]:
            info = {"run": str(req["run"]), "progress": 0}
            if str(req["run"]) == TaskStatus.RUNNING.value and req.get("delete", False):
                info["progress_msg"] = ""
                info["chunk_num"] = 0
                info["token_num"] = 0
            DocumentService.update_by_id(id, info)
            tenant_id = DocumentService.get_tenant_id(id)
            if not tenant_id:
                return get_data_error_result(message="未找到租户！")
            e, doc = DocumentService.get_by_id(id)
            if not e:
                return get_data_error_result(message="未找到文档！")
            if req.get("delete", False):
                TaskService.filter_delete([Task.doc_id == id])
                if settings.docStoreConn.indexExist(search.index_name(tenant_id), doc.kb_id):
                    settings.docStoreConn.delete({"doc_id": id}, search.index_name(tenant_id), doc.kb_id)

            if str(req["run"]) == TaskStatus.RUNNING.value:
                e, doc = DocumentService.get_by_id(id)
                doc = doc.to_dict()
                doc["tenant_id"] = tenant_id
                bucket, name = File2DocumentService.get_storage_address(doc_id=doc["id"])
                queue_tasks(doc, bucket, name, 0)

        return get_json_result(data=True)
    except Exception as e:
        return server_error_response(e)


@manager.route('/rename', methods=['POST'])  # noqa: F821
@login_required
@validate_request("doc_id", "name")
def rename():
    req = request.json
    if not DocumentService.accessible(req["doc_id"], current_user.id):
        return get_json_result(
            data=False,
            message='没有授权。',
            code=settings.RetCode.AUTHENTICATION_ERROR
        )
    try:
        e, doc = DocumentService.get_by_id(req["doc_id"])
        if not e:
            return get_data_error_result(message="未找到文档！")
        if pathlib.Path(req["name"].lower()).suffix != pathlib.Path(
                doc.name.lower()).suffix:
            return get_json_result(
                data=False,
                message="不能更改文件的扩展名",
                code=settings.RetCode.ARGUMENT_ERROR)
        for d in DocumentService.query(name=req["name"], kb_id=doc.kb_id):
            if d.name == req["name"]:
                return get_data_error_result(
                    message="同一知识库中存在重复的文档名称。")

        if not DocumentService.update_by_id(
                req["doc_id"], {"name": req["name"]}):
            return get_data_error_result(
                message="数据库错误（文档重命名）！")

        informs = File2DocumentService.get_by_document_id(req["doc_id"])
        if informs:
            e, file = FileService.get_by_id(informs[0].file_id)
            FileService.update_by_id(file.id, {"name": req["name"]})

        return get_json_result(data=True)
    except Exception as e:
        return server_error_response(e)


@manager.route('/get/<doc_id>', methods=['GET'])  # noqa: F821
# @login_required
def get(doc_id):
    try:
        e, doc = DocumentService.get_by_id(doc_id)
        if not e:
            return get_data_error_result(message="未找到文档！")

        b, n = File2DocumentService.get_storage_address(doc_id=doc_id)
        response = flask.make_response(STORAGE_IMPL.get(b, n))

        ext = re.search(r"\.([^.]+)$", doc.name)
        if ext:
            if doc.type == FileType.VISUAL.value:
                response.headers.set('Content-Type', 'image/%s' % ext.group(1))
            else:
                response.headers.set(
                    'Content-Type',
                    'application/%s' %
                    ext.group(1))
        return response
    except Exception as e:
        return server_error_response(e)

@manager.route('/download/<doc_id>', methods=['GET'])  # noqa: F821
def download(doc_id):
    try:
        e, doc = DocumentService.get_by_id(doc_id)
        if not e:
            return get_data_error_result(message="未找到文档！")

        b, n = File2DocumentService.get_storage_address(doc_id=doc_id)
        response = flask.make_response(STORAGE_IMPL.get(b, n))

        ext = re.search(r"\.([^.]+)$", doc.name)
        if ext:
            if doc.type == FileType.VISUAL.value:
                response.headers.set('Content-Type', 'image/%s' % ext.group(1))
            else:
                response.headers.set(
                    'Content-Type',
                    'application/%s' %
                    ext.group(1))
            import urllib.parse
            filename = urllib.parse.quote(doc.name.encode('utf-8'))
            response.headers.set(
                "Content-Disposition",
                f"attachment; filename*=UTF-8''{filename}"
            )
        return response
    except Exception as e:
        return server_error_response(e)


@manager.route('/change_parser', methods=['POST'])  # noqa: F821
@login_required
@validate_request("doc_id", "parser_id")
def change_parser():
    req = request.json

    if not DocumentService.accessible(req["doc_id"], current_user.id):
        return get_json_result(
            data=False,
            message='没有授权。',
            code=settings.RetCode.AUTHENTICATION_ERROR
        )
    try:
        e, doc = DocumentService.get_by_id(req["doc_id"])
        if not e:
            return get_data_error_result(message="未找到文档！")
        if doc.parser_id.lower() == req["parser_id"].lower():
            if "parser_config" in req:
                if req["parser_config"] == doc.parser_config:
                    return get_json_result(data=True)
            else:
                return get_json_result(data=True)

        if ((doc.type == FileType.VISUAL and req["parser_id"] != "picture")
                or (re.search(
                    r"\.(ppt|pptx|pages)$", doc.name) and req["parser_id"] != "presentation")):
            return get_data_error_result(message="尚不支持此功能！")

        e = DocumentService.update_by_id(doc.id,
                                         {"parser_id": req["parser_id"], "progress": 0, "progress_msg": "",
                                          "run": TaskStatus.UNSTART.value})
        if not e:
            return get_data_error_result(message="未找到文档！")
        if "parser_config" in req:
            DocumentService.update_parser_config(doc.id, req["parser_config"])
        if doc.token_num > 0:
            e = DocumentService.increment_chunk_num(doc.id, doc.kb_id, doc.token_num * -1, doc.chunk_num * -1,
                                                    doc.process_duation * -1)
            if not e:
                return get_data_error_result(message="未找到文档！")
            tenant_id = DocumentService.get_tenant_id(req["doc_id"])
            if not tenant_id:
                return get_data_error_result(message="未找到租户！")
            if settings.docStoreConn.indexExist(search.index_name(tenant_id), doc.kb_id):
                settings.docStoreConn.delete({"doc_id": doc.id}, search.index_name(tenant_id), doc.kb_id)

        return get_json_result(data=True)
    except Exception as e:
        return server_error_response(e)


@manager.route('/image/<image_id>', methods=['GET'])  # noqa: F821
# @login_required
def get_image(image_id):
    try:
        arr = image_id.split("-")
        if len(arr) != 2:
            return get_data_error_result(message="未找到图片。")
        bkt, nm = image_id.split("-")
        response = flask.make_response(STORAGE_IMPL.get(bkt, nm))
        response.headers.set('Content-Type', 'image/JPEG')
        return response
    except Exception as e:
        return server_error_response(e)


@manager.route('/upload_and_parse', methods=['POST'])  # noqa: F821
@login_required
@validate_request("conversation_id")
def upload_and_parse():
    if 'file' not in request.files:
        return get_json_result(
            data=False, message='没有文件部分！', code=settings.RetCode.ARGUMENT_ERROR)

    file_objs = request.files.getlist('file')
    for file_obj in file_objs:
        if file_obj.filename == '':
            return get_json_result(
                data=False, message='未选择文件！', code=settings.RetCode.ARGUMENT_ERROR)

    doc_ids = doc_upload_and_parse(request.form.get("conversation_id"), file_objs, current_user.id)

    return get_json_result(data=doc_ids)


@manager.route('/parse', methods=['POST'])  # noqa: F821
@login_required
def parse():
    url = request.json.get("url") if request.json else ""
    if url:
        if not is_valid_url(url):
            return get_json_result(
                data=False, message='URL格式无效', code=settings.RetCode.ARGUMENT_ERROR)
        download_path = os.path.join(get_project_base_directory(), "logs/downloads")
        os.makedirs(download_path, exist_ok=True)
        from seleniumwire.webdriver import Chrome, ChromeOptions
        options = ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--disable-gpu')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_experimental_option('prefs', {
            'download.default_directory': download_path,
            'download.prompt_for_download': False,
            'download.directory_upgrade': True,
            'safebrowsing.enabled': True
        })
        driver = Chrome(options=options)
        driver.get(url)
        res_headers = [r.response.headers for r in driver.requests if r and r.response]
        if len(res_headers) > 1:
            sections = RAGFlowHtmlParser().parser_txt(driver.page_source)
            driver.quit()
            return get_json_result(data="\n".join(sections))

        class File:
            filename: str
            filepath: str

            def __init__(self, filename, filepath):
                self.filename = filename
                self.filepath = filepath

            def read(self):
                with open(self.filepath, "rb") as f:
                    return f.read()

        r = re.search(r"filename=\"([^\"]+)\"", str(res_headers))
        if not r or not r.group(1):
            return get_json_result(
                data=False, message="无法识别下载的文件", code=settings.RetCode.ARGUMENT_ERROR)
        f = File(r.group(1), os.path.join(download_path, r.group(1)))
        txt = FileService.parse_docs([f], current_user.id)
        return get_json_result(data=txt)

    if 'file' not in request.files:
        return get_json_result(
            data=False, message='没有文件部分！', code=settings.RetCode.ARGUMENT_ERROR)

    file_objs = request.files.getlist('file')
    txt = FileService.parse_docs(file_objs, current_user.id)

    return get_json_result(data=txt)


@manager.route('/set_meta', methods=['POST'])  # noqa: F821
@login_required
@validate_request("doc_id", "meta")
def set_meta():
    req = request.json
    if not DocumentService.accessible(req["doc_id"], current_user.id):
        return get_json_result(
            data=False,
            message='没有授权。',
            code=settings.RetCode.AUTHENTICATION_ERROR
        )
    try:
        meta = json.loads(req["meta"])
    except Exception as e:
        return get_json_result(
            data=False, message=f'Json语法错误: {e}', code=settings.RetCode.ARGUMENT_ERROR)
    if not isinstance(meta, dict):
        return get_json_result(
            data=False, message='元数据应为Json映射格式，如{"key": "value"}', code=settings.RetCode.ARGUMENT_ERROR)

    try:
        e, doc = DocumentService.get_by_id(req["doc_id"])
        if not e:
            return get_data_error_result(message="未找到文档！")

        if not DocumentService.update_by_id(
                req["doc_id"], {"meta_fields": meta}):
            return get_data_error_result(
                message="数据库错误（元数据更新）！")

        return get_json_result(data=True)
    except Exception as e:
        return server_error_response(e)
