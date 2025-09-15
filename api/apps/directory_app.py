from flask import Blueprint, request
from flask_login import login_required, current_user

from api.db.services.directory_service import DirectoryService
from api.utils.api_utils import (
    get_json_result,
    server_error_response,
    get_data_error_result,
)
from api.utils.api_utils import validate_request

manager = Blueprint("directory", __name__)


@manager.route("/create", methods=["POST"])
@login_required
@validate_request("kb_id", "name")
def create_directory():
    """创建目录"""
    req = request.json
    kb_id = req["kb_id"]
    name = req["name"]
    parent_id = req.get("parent_id")

    try:
        directory, error = DirectoryService.create_directory(
            kb_id=kb_id, name=name, parent_id=parent_id, created_by=current_user.id
        )

        if error:
            return get_data_error_result(message=error)

        return get_json_result(data=directory.to_dict())
    except Exception as e:
        return server_error_response(e)


@manager.route("/list", methods=["GET"])
@login_required
def list_directories():
    """获取目录列表"""
    kb_id = request.args.get("kb_id")
    parent_id = request.args.get("parent_id")
    get_all = request.args.get("get_all", "false").lower() == "true"

    if not kb_id:
        return get_data_error_result(message="缺少知识库ID")

    try:
        directories = DirectoryService.get_directories_by_kb(kb_id, parent_id, get_all)
        result = [directory.to_dict() for directory in directories]
        return get_json_result(data=result)
    except Exception as e:
        return server_error_response(e)


@manager.route("/tree", methods=["GET"])
@login_required
def get_directory_tree():
    """获取目录树"""
    kb_id = request.args.get("kb_id")

    if not kb_id:
        return get_data_error_result(message="缺少知识库ID")

    try:
        tree = DirectoryService.get_directory_tree(kb_id)
        return get_json_result(data=tree)
    except Exception as e:
        return server_error_response(e)


@manager.route("/rename", methods=["POST"])
@login_required
@validate_request("directory_id", "name")
def rename_directory():
    """重命名目录"""
    req = request.json
    directory_id = req["directory_id"]
    name = req["name"]

    try:
        success, error = DirectoryService.rename_directory(
            directory_id, name, current_user.id
        )

        if error:
            return get_data_error_result(message=error)

        if not success:
            return get_data_error_result(message="重命名失败")

        return get_json_result(data=True)
    except Exception as e:
        return server_error_response(e)


@manager.route("/delete", methods=["POST"])
@login_required
@validate_request("directory_id")
def delete_directory():
    """删除目录"""
    req = request.json
    directory_id = req["directory_id"]

    try:
        success, error = DirectoryService.delete_directory(
            directory_id, current_user.id
        )

        if error:
            return get_data_error_result(message=error)

        if not success:
            return get_data_error_result(message="删除失败")

        return get_json_result(data=True)
    except Exception as e:
        return server_error_response(e)
