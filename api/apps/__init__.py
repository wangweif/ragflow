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
import os
import sys
import logging
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from flask import Blueprint, Flask, Request as FlaskRequest
from werkzeug.wrappers.request import Request
from flask_cors import CORS
from flasgger import Swagger
from itsdangerous.url_safe import URLSafeTimedSerializer as Serializer

from api.db import StatusEnum
from api.db.db_models import close_connection
from api.db.services import UserService
from api.utils import CustomJSONEncoder, commands

from flask_session import Session
from flask_login import LoginManager
from api import settings
from api.utils.api_utils import server_error_response
from api.constants import API_VERSION, XIAOZHI_JWT_SECRET_KEY
import jwt

__all__ = ["app"]

# Extend Flask Request to add max_form_parts property
# This allows uploading more than the default 1000 files/parts
original_request_class = FlaskRequest


class CustomRequest(FlaskRequest):
    @property
    def max_form_parts(self) -> int | None:  # type: ignore[override]
        """Read-only view of the MAX_FORM_PARTS config key."""
        from flask import current_app
        if current_app:
            return current_app.config.get("MAX_FORM_PARTS", None)  # type: ignore[no-any-return]
        else:
            return None


# Set custom request class
FlaskRequest.json = property(lambda self: self.get_json(force=True, silent=True))

app = Flask(__name__)
app.request_class = CustomRequest

# Add this at the beginning of your file to configure Swagger UI
swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: True,  # Include all endpoints
            "model_filter": lambda tag: True,  # Include all models
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs/",
}

swagger = Swagger(
    app,
    config=swagger_config,
    template={
        "swagger": "2.0",
        "info": {
            "title": "RAGFlow API",
            "description": "",
            "version": "1.0.0",
        },
        "securityDefinitions": {
            "ApiKeyAuth": {"type": "apiKey", "name": "Authorization", "in": "header"}
        },
    },
)

CORS(app, supports_credentials=True, max_age=2592000)
app.url_map.strict_slashes = False
app.json_encoder = CustomJSONEncoder
app.errorhandler(Exception)(server_error_response)

## convince for dev and debug
# app.config["LOGIN_DISABLED"] = True
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
app.config["MAX_CONTENT_LENGTH"] = int(
    os.environ.get("MAX_CONTENT_LENGTH", 1024 * 1024 * 1024)
)

# Configure werkzeug multipart parser to handle many files
# max_form_memory_size: data in memory beyond this size goes to disk (default: 128KB)
# Set to 16MB to reduce memory pressure when uploading many small files
app.config["MAX_FORM_MEMORY_SIZE"] = int(
    os.environ.get("MAX_FORM_MEMORY_SIZE", 16 * 1024 * 1024)
)
# max_form_parts: maximum number of multipart parts (files + form fields)
# Default werkzeug limit is 1000, increase to allow more files
app.config["MAX_FORM_PARTS"] = int(
    os.environ.get("MAX_FORM_PARTS", 10000)
)

Session(app)
login_manager = LoginManager()
login_manager.init_app(app)

commands.register_commands(app)


def search_pages_path(pages_dir):
    app_path_list = [
        path for path in pages_dir.glob("*_app.py") if not path.name.startswith(".")
    ]
    api_path_list = [
        path for path in pages_dir.glob("*sdk/*.py") if not path.name.startswith(".")
    ]
    app_path_list.extend(api_path_list)
    return app_path_list


def register_page(page_path):
    path = f"{page_path}"

    page_name = page_path.stem.rstrip("_app")
    module_name = ".".join(
        page_path.parts[page_path.parts.index("api"): -1] + (page_name,)
    )

    spec = spec_from_file_location(module_name, page_path)
    page = module_from_spec(spec)
    page.app = app
    page.manager = Blueprint(page_name, module_name)
    sys.modules[module_name] = page
    spec.loader.exec_module(page)
    page_name = getattr(page, "page_name", page_name)
    sdk_path = "\\sdk\\" if sys.platform.startswith("win") else "/sdk/"
    url_prefix = (
        f"/api/{API_VERSION}" if sdk_path in path else f"/{API_VERSION}/{page_name}"
    )

    app.register_blueprint(page.manager, url_prefix=url_prefix)
    return url_prefix


pages_dir = [
    Path(__file__).parent,
    Path(__file__).parent.parent / "api" / "apps",
    Path(__file__).parent.parent / "api" / "apps" / "sdk",
]

client_urls_prefix = [
    register_page(path) for dir in pages_dir for path in search_pages_path(dir)
]


@login_manager.request_loader
def load_user(web_request):
    from api.utils.local_user_client import LocalUserClient
    from flask_login import login_user
    import re

    try:
        # 优先从Authorization头获取token
        authorization_header = web_request.headers.get("Authorization")
        authorization = None
        
        if authorization_header:
            # 处理 "Bearer token" 格式
            if authorization_header.startswith("Bearer "):
                authorization = authorization_header[7:]  # 移除 "Bearer " 前缀
            else:
                authorization = authorization_header
        else:
            # 如果没有Authorization头，尝试从Cookie中获取（兼容性）
            cookie_header = web_request.headers.get("Cookie")
            if cookie_header:
                # 使用正则表达式提取token值
                token_match = re.search(r'token=([^;]+)', cookie_header)
                if token_match:
                    authorization = token_match.group(1)
        
        # 验证token不为空且格式合理
        if not authorization or len(authorization) < 10:
            return None
        
        local_user_client = LocalUserClient()
        
        try:
            # 直接从JWT中解析用户信息，无需远程API验证
            user_info = jwt.decode(authorization, XIAOZHI_JWT_SECRET_KEY, algorithms=["HS256"])
            
            # 如果JWT中包含完整的用户信息，直接创建用户对象
            if user_info is not None and "id" in user_info:
                user = local_user_client.get_user_by_id(user_info["id"])
                logging.info(f"------------load_user user: {user}")
                login_user(user)
                return user
            return None
                
        except jwt.InvalidTokenError as e:
            logging.warning(f"load_user JWT解码失败: {e}")
            return None
        except jwt.DecodeError as e:
            logging.warning(f"load_user JWT格式错误: {e}")
            return None
        except Exception as e:
            logging.warning(f"load_user got exception: {e}")
            return None
            
    except Exception as e:
        logging.warning(f"load_user 认证处理失败: {e}")
        return None


@app.teardown_request
def _db_close(exc):
    close_connection()
