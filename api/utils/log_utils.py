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
import os.path
import logging
import datetime
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler

# 自定义的每日轮转日志处理器
class DailyRotatingFileHandler(logging.Handler):
    def __init__(self, log_dir, basename, backupCount=30):
        super().__init__()
        self.log_dir = log_dir
        self.basename = basename
        self.backupCount = backupCount
        self.current_date = None
        self.current_file = None
        self._update_file()
    
    def _get_date_str(self):
        return datetime.datetime.now().strftime("%Y-%m-%d")
    
    def _update_file(self):
        date_str = self._get_date_str()
        if date_str != self.current_date:
            self.current_date = date_str
            filename = f"{self.basename}_{date_str}.log"
            filepath = os.path.join(self.log_dir, filename)
            
            # 关闭之前的文件（如果有）
            if self.current_file is not None:
                self.current_file.close()
            
            # 打开新文件
            self.current_file = open(filepath, 'a', encoding='utf-8')
            
            # 清理旧文件
            self._cleanup_old_logs()
    
    def _cleanup_old_logs(self):
        files = []
        for file in os.listdir(self.log_dir):
            if file.startswith(self.basename) and file.endswith('.log'):
                files.append(os.path.join(self.log_dir, file))
        files.sort(reverse=True)  # 最新的文件在前面
        # 保留最新的backupCount个文件
        for file in files[self.backupCount:]:
            try:
                os.remove(file)
            except:
                pass
    
    def emit(self, record):
        try:
            # 检查是否需要切换文件
            self._update_file()
            
            # 格式化记录
            msg = self.format(record)
            
            # 写入文件
            self.current_file.write(msg + '\n')
            self.current_file.flush()
        except Exception:
            self.handleError(record)

initialized_root_logger = False

def get_project_base_directory():
    PROJECT_BASE = os.path.abspath(
        os.path.join(
            os.path.dirname(os.path.realpath(__file__)),
            os.pardir,
            os.pardir,
        )
    )
    return PROJECT_BASE

def initRootLogger(logfile_basename: str, log_format: str = "%(asctime)-15s %(levelname)-8s %(process)d %(message)s"):
    global initialized_root_logger
    if initialized_root_logger:
        return
    initialized_root_logger = True

    logger = logging.getLogger()
    logger.handlers.clear()
    
    # 创建logs/logfile_basename目录
    log_dir = os.path.abspath(os.path.join(get_project_base_directory(), "logs", logfile_basename))
    os.makedirs(log_dir, exist_ok=True)
    
    formatter = logging.Formatter(log_format)

    # 使用自定义的DailyRotatingFileHandler，确保每天严格切换一个新的日志文件
    handler1 = DailyRotatingFileHandler(log_dir, logfile_basename, backupCount=30)
    handler1.setFormatter(formatter)
    logger.addHandler(handler1)

    handler2 = logging.StreamHandler()
    handler2.setFormatter(formatter)
    logger.addHandler(handler2)

    logging.captureWarnings(True)

    LOG_LEVELS = os.environ.get("LOG_LEVELS", "")
    pkg_levels = {}
    for pkg_name_level in LOG_LEVELS.split(","):
        terms = pkg_name_level.split("=")
        if len(terms)!= 2:
            continue
        pkg_name, pkg_level = terms[0], terms[1]
        pkg_name = pkg_name.strip()
        pkg_level = logging.getLevelName(pkg_level.strip().upper())
        if not isinstance(pkg_level, int):
            pkg_level = logging.INFO
        pkg_levels[pkg_name] = logging.getLevelName(pkg_level)

    for pkg_name in ['peewee', 'pdfminer']:
        if pkg_name not in pkg_levels:
            pkg_levels[pkg_name] = logging.getLevelName(logging.WARNING)
    if 'root' not in pkg_levels:
        pkg_levels['root'] = logging.getLevelName(logging.INFO)

    for pkg_name, pkg_level in pkg_levels.items():
        pkg_logger = logging.getLogger(pkg_name)
        pkg_logger.setLevel(pkg_level)

    msg = f"{logfile_basename} log dir: {log_dir}, log levels: {pkg_levels}"
    logger.info(msg)