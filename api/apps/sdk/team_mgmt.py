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

from api.db.services.team_service import TeamService
from api.db.services.user_service import UserService
from api.utils.api_utils import (
    get_result,
    token_required,
    get_error_data_result,
    server_error_response,
)


@manager.route("/team/list", methods=["GET"])  # noqa: F821
@token_required
def team_list(tenant_id):
    """通过 apikey 获取当前租户下的顶层团队(部门)列表，即 parent_id 为空。"""
    try:
        teams = TeamService.list_teams_by_tenant(tenant_id)
        top_teams = [t for t in teams if not t.get("parent_id")]
        return get_result(data=top_teams)
    except Exception as e:
        return server_error_response(e)


@manager.route("/team/<team_id>/sub-teams", methods=["GET"])  # noqa: F821
@token_required
def sub_teams(tenant_id, team_id):
    """通过 apikey 获取特定部门(团队)的子部门列表。"""
    try:
        parent_team = TeamService.get_team(team_id)
        if not parent_team:
            return get_error_data_result(message="父团队不存在")

        return get_result(data=TeamService.list_teams_by_parent_id(team_id))
    except Exception as e:
        return server_error_response(e)


@manager.route("/team/<team_id>/member/list", methods=["GET"])  # noqa: F821
@token_required
def team_member_list(tenant_id, team_id):
    """通过 apikey 获取特定部门(团队)的用户列表。"""
    try:
        team_info = TeamService.get_team(team_id)
        if not team_info:
            return get_error_data_result(message="团队不存在")

        users = UserService.get_users_by_team_id(team_id)
        result = []
        for user in users:
            result.append({
                "id": user.id,
                "email": user.email,
                "nickname": user.nickname,
                "avatar": user.avatar,
                "language": user.language,
                "color_schema": user.color_schema,
                "timezone": user.timezone,
                "last_login_time": user.last_login_time,
                "is_authenticated": user.is_authenticated,
                "is_active": user.is_active,
                "is_anonymous": user.is_anonymous,
                "login_channel": user.login_channel,
                "status": user.status,
                "is_superuser": user.is_superuser,
                "team_id": user.team_id,
                "role": user.role,
                "tenant_id": user.tenant_id,
            })

        return get_result(data=result)
    except Exception as e:
        return server_error_response(e)
