import api from '@/utils/api';
import registerServer from '@/utils/register-server';
import request from '@/utils/request';

const {
  createDirectory,
  listDirectories,
  getDirectoryTree,
  renameDirectory,
  deleteDirectory,
} = api;

const methods = {
  createDirectory: {
    url: createDirectory,
    method: 'post',
  },
  listDirectories: {
    url: listDirectories,
    method: 'get',
  },
  getDirectoryTree: {
    url: getDirectoryTree,
    method: 'get',
  },
  renameDirectory: {
    url: renameDirectory,
    method: 'post',
  },
  deleteDirectory: {
    url: deleteDirectory,
    method: 'post',
  },
} as const;

const directoryManagerService = registerServer<keyof typeof methods>(
  methods,
  request,
);

export default directoryManagerService;
