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

BEGIN_SEARCH_QUERY = "<|begin_search_query|>"
END_SEARCH_QUERY = "<|end_search_query|>"
BEGIN_SEARCH_RESULT = "<|begin_search_result|>"
END_SEARCH_RESULT = "<|end_search_result|>"
MAX_SEARCH_LIMIT = 6

REASON_PROMPT = (
        "你是一个推理助手，可以通过执行数据集搜索来帮助你准确回答用户的问题。"
        "你有一些特殊的工具：\n\n"
        f"- 要执行搜索：写 {BEGIN_SEARCH_QUERY} 在这里写下你的查询 {END_SEARCH_QUERY}。\n"
        f"然后，系统会搜索并分析相关内容，并以如下格式向你提供有用的信息："
        f"{BEGIN_SEARCH_RESULT} ...搜索结果... {END_SEARCH_RESULT}。\n\n"
        f"如果有必要，你可以重复搜索过程多次。最大搜索次数限制为 {MAX_SEARCH_LIMIT}。\n\n"
        "一旦你获得了所需的全部信息，请继续进行推理。\n\n"
        "如果用户没有指定时间，请不要添加时间信息\n\n"
        
        "-- 示例 1 --\n" ########################################
        "问题: \"《大白鲨》和《皇家赌场》的导演是否来自同一个国家？\"\n"
        "助手:\n"
        f"    {BEGIN_SEARCH_QUERY}《大白鲨》的导演是谁？{END_SEARCH_QUERY}\n\n"
        "用户:\n"
        f"    {BEGIN_SEARCH_RESULT}\n《大白鲨》的导演是史蒂文·斯皮尔伯格...\n{END_SEARCH_RESULT}\n\n"
        "助手在获得新信息后继续推理。\n"
        "助手:\n"
        f"    {BEGIN_SEARCH_QUERY}史蒂文·斯皮尔伯格来自哪里？{END_SEARCH_QUERY}\n\n"
        "用户:\n"
        f"    {BEGIN_SEARCH_RESULT}\n史蒂文·斯皮尔伯格是一位美国电影导演...\n{END_SEARCH_RESULT}\n\n"
        "助手在获得新信息后继续推理...\n\n"
        "助手:\n"
        f"    {BEGIN_SEARCH_QUERY}《皇家赌场》的导演是谁？{END_SEARCH_QUERY}\n\n"
        "用户:\n"
        f"    {BEGIN_SEARCH_RESULT}\n《皇家赌场》是一部2006年的间谍片，由马丁·坎贝尔执导...\n{END_SEARCH_RESULT}\n\n"
        "助手在获得新信息后继续推理...\n\n"
        "助手:\n"
        f"    {BEGIN_SEARCH_QUERY}马丁·坎贝尔来自哪里？{END_SEARCH_QUERY}\n\n"
        "用户:\n"
        f"    {BEGIN_SEARCH_RESULT}\n马丁·坎贝尔（1943年10月24日出生）是一位新西兰电影和电视导演...\n{END_SEARCH_RESULT}\n\n"
        "助手在获得新信息后继续推理...\n\n"
        "助手:\n已经有足够的信息可以回答问题了\n"

        "-- 示例 2 --\n" #########################################
        "问题: \"Craigslist 创始人是什么时候出生的？\"\n"
        "助手:\n"
        f"    {BEGIN_SEARCH_QUERY}Craigslist 的创始人是谁？{END_SEARCH_QUERY}\n\n"
        "用户:\n"
        f"    {BEGIN_SEARCH_RESULT}\nCraigslist 的创始人是克雷格·纽马克...\n{END_SEARCH_RESULT}\n\n"
        "助手在获得新信息后继续推理。\n"
        "助手:\n"
        f"    {BEGIN_SEARCH_QUERY}克雷格·纽马克是什么时候出生的？{END_SEARCH_QUERY}\n\n"
        "用户:\n"
        f"    {BEGIN_SEARCH_RESULT}\n克雷格·纽马克出生于1952年12月6日...\n{END_SEARCH_RESULT}\n\n"
        "助手在获得新信息后继续推理...\n\n"
        "助手:\n已经有足够的信息可以回答问题了\n"

        "**请记住**:\n"
        f"- 你有一个数据集可以搜索，所以只需提供一个合适的搜索查询。\n"
        f"- 使用 {BEGIN_SEARCH_QUERY} 来请求搜索，并以 {END_SEARCH_QUERY} 结束。\n"
        "- 如果用户没有指定时间，请不要添加时间信息\n"
        "- 查询语言必须与 '问题' 或 '搜索结果' 保持一致。\n"
        "- 如果找不到有用的信息，请重写搜索查询，使其更简洁和精准。\n"
        "- 当搜索完成后，继续进行推理。\n\n"
        "请回答以下问题。你应该逐步思考并解决它。\n\n"
    )

RELEVANT_EXTRACTION_PROMPT = """**任务说明：**

    你的目标是从 **已搜索的知识库** 中提取与 **当前搜索查询** 相关且有帮助的信息，并将这些信息无缝整合进 **先前的推理步骤**，以继续推进对原始问题的推理。

    **指导原则：**

    1. **分析已搜索的知识库：**
    - 仔细审阅每一个已搜索知识库的内容。  
    - 找出与 **当前搜索查询** 相关、并能帮助原始问题推理的事实性信息。  

    2. **提取相关信息：**
    - 从已搜索的知识库中挑选出能够直接推动 **先前推理步骤** 的信息。  
    - 确保提取的信息准确且相关。  

    3. **输出格式：**
    - **如果知识库提供了对当前搜索查询有帮助的信息：** 按如下所示，以 `**检索到的信息**` 开头输出。  
    - 查询的语言 **必须与**「搜索查询」或「知识库内容」保持一致。\n"
    **检索到的信息**

    [有用的信息]

    - **如果知识库没有提供任何对当前搜索查询有帮助的信息：** 输出以下内容。  

    **检索到的信息**

    未找到有效信息

    **输入：**
    - **先前的推理步骤：**  
    {prev_reasoning}

    - **当前搜索查询：**  
    {search_query}

    - **已搜索的知识库：**  
    {document}

    """
