import { IReferenceChunk } from '@/interfaces/database/chat';
import { IDocumentInfo } from '@/interfaces/database/document';
import { IChunk } from '@/interfaces/database/knowledge';
import {
  IChangeParserConfigRequestBody,
  IDocumentMetaRequestBody,
} from '@/interfaces/request/document';
import i18n from '@/locales/config';
import chatService from '@/services/chat-service';
import directoryManagerService from '@/services/directory-manager-service';
import kbService from '@/services/knowledge-service';
import api, { api_host } from '@/utils/api';
import { getAuthorization } from '@/utils/authorization-util';
import { buildChunkHighlights } from '@/utils/document-util';
import { post } from '@/utils/request';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UploadFile, message } from 'antd';
import axios from 'axios';
import { get } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { IHighlight } from 'react-pdf-highlighter';
import { useParams, useSearchParams } from 'umi';
import {
  useGetPaginationWithRouter,
  useHandleSearchChange,
} from './logic-hooks';
import {
  useGetKnowledgeSearchParams,
  useSetPaginationParams,
} from './route-hook';

// 定义混合数据项的接口
export interface IMixedItem {
  id: string;
  name: string;
  type: 'directory' | 'document';
  create_time?: number;
  chunk_num?: number;
  parser_id?: string;
  status?: string;
  run?: any;
  parent_id?: string;
  kb_id?: string;
  parser_config?: any;
  meta_fields?: any;
  thumbnail?: string;
}

export const useGetDocumentUrl = (documentId?: string) => {
  const getDocumentUrl = useCallback(
    (id?: string) => {
      return `${api_host}/document/get/${documentId || id}`;
    },
    [documentId],
  );

  return getDocumentUrl;
};

export const useGetChunkHighlights = (
  selectedChunk: IChunk | IReferenceChunk,
) => {
  const [size, setSize] = useState({ width: 849, height: 1200 });

  const highlights: IHighlight[] = useMemo(() => {
    return buildChunkHighlights(selectedChunk, size);
  }, [selectedChunk, size]);

  const setWidthAndHeight = (width: number, height: number) => {
    setSize((pre) => {
      if (pre.height !== height || pre.width !== width) {
        return { height, width };
      }
      return pre;
    });
  };

  return { highlights, setWidthAndHeight };
};

export const useFetchNextDocumentList = () => {
  const { knowledgeId } = useGetKnowledgeSearchParams();
  const { searchString, handleInputChange } = useHandleSearchChange();
  const { pagination, setPagination } = useGetPaginationWithRouter();
  const { id } = useParams();

  const { data, isFetching: loading } = useQuery<{
    docs: IDocumentInfo[];
    total: number;
  }>({
    queryKey: ['fetchDocumentList', searchString, pagination],
    initialData: { docs: [], total: 0 },
    refetchInterval: 15000,
    enabled: !!knowledgeId || !!id,
    queryFn: async () => {
      const ret = await kbService.get_document_list({
        kb_id: knowledgeId || id,
        keywords: searchString,
        page_size: pagination.pageSize,
        page: pagination.current,
      });
      if (ret.data.code === 0) {
        return ret.data.data;
      }

      return {
        docs: [],
        total: 0,
      };
    },
  });

  const onInputChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      setPagination({ page: 1 });
      handleInputChange(e);
    },
    [handleInputChange, setPagination],
  );

  return {
    loading,
    searchString,
    documents: data.docs,
    pagination: { ...pagination, total: data?.total },
    handleInputChange: onInputChange,
    setPagination,
  };
};

export const useSetNextDocumentStatus = () => {
  const queryClient = useQueryClient();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['updateDocumentStatus'],
    mutationFn: async ({
      status,
      documentId,
    }: {
      status: boolean;
      documentId: string;
    }) => {
      const { data } = await kbService.document_change_status({
        doc_id: documentId,
        status: Number(status),
      });
      if (data.code === 0) {
        message.success(i18n.t('message.modified'));
        // queryClient.invalidateQueries({ queryKey: ['fetchDocumentList'] });
        queryClient.invalidateQueries({ queryKey: ['fetchMixedContentList'] });
      }
      return data;
    },
  });

  return { setDocumentStatus: mutateAsync, data, loading };
};

export const useSaveNextDocumentName = () => {
  const queryClient = useQueryClient();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['saveDocumentName'],
    mutationFn: async ({
      name,
      documentId,
    }: {
      name: string;
      documentId: string;
    }) => {
      const { data } = await kbService.document_rename({
        doc_id: documentId,
        name: name,
      });
      if (data.code === 0) {
        message.success(i18n.t('message.renamed'));
        // queryClient.invalidateQueries({ queryKey: ['fetchDocumentList'] });
        queryClient.invalidateQueries({ queryKey: ['fetchMixedContentList'] });
      }
      return data.code;
    },
  });

  return { loading, saveName: mutateAsync, data };
};

export const useCreateNextDocument = () => {
  const { knowledgeId } = useGetKnowledgeSearchParams();
  const { setPaginationParams, page } = useSetPaginationParams();
  const queryClient = useQueryClient();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['createDocument'],
    mutationFn: async (name: string) => {
      const { data } = await kbService.document_create({
        name,
        kb_id: knowledgeId,
      });
      if (data.code === 0) {
        if (page === 1) {
          // queryClient.invalidateQueries({ queryKey: ['fetchDocumentList'] });
          queryClient.invalidateQueries({
            queryKey: ['fetchMixedContentList'],
          });
        } else {
          setPaginationParams(); // fetch document list
        }

        message.success(i18n.t('message.created'));
      }
      return data.code;
    },
  });

  return { createDocument: mutateAsync, loading, data };
};

export const useSetNextDocumentParser = () => {
  const queryClient = useQueryClient();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['setDocumentParser'],
    mutationFn: async ({
      parserId,
      documentId,
      parserConfig,
    }: {
      parserId: string;
      documentId: string;
      parserConfig: IChangeParserConfigRequestBody;
    }) => {
      const { data } = await kbService.document_change_parser({
        parser_id: parserId,
        doc_id: documentId,
        parser_config: parserConfig,
      });
      if (data.code === 0) {
        // queryClient.invalidateQueries({ queryKey: ['fetchDocumentList'] });
        queryClient.invalidateQueries({ queryKey: ['fetchMixedContentList'] });

        message.success(i18n.t('message.modified'));
      }
      return data.code;
    },
  });

  return { setDocumentParser: mutateAsync, data, loading };
};

export const useUploadNextDocument = () => {
  const queryClient = useQueryClient();
  const { knowledgeId } = useGetKnowledgeSearchParams();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['uploadDocument'],
    mutationFn: async (params: {
      fileList: UploadFile[];
      directoryId?: string;
    }) => {
      const { fileList, directoryId } = params;
      const formData = new FormData();
      formData.append('kb_id', knowledgeId);

      // 如果有directory_id，则添加到formData中
      if (directoryId) {
        formData.append('directory_id', directoryId);
      }

      fileList.forEach((file: any) => {
        if (file.originFileObj) {
          formData.append('file', file.originFileObj);
        } else {
          formData.append('file', file);
        }
        // 添加文件的相对路径信息（用于多级目录上传）
        const relativePath = (file as any).webkitRelativePath || file.name;
        formData.append('webkitRelativePath', relativePath);
      });

      try {
        const ret = await axios.post(api.document_upload, formData, {
          headers: {
            Authorization: getAuthorization(),
          },
        });
        const code = get(ret, 'data.code');

        if (code === 0 || code === 500) {
          // queryClient.invalidateQueries({ queryKey: ['fetchDocumentList'] });
          queryClient.invalidateQueries({
            queryKey: ['fetchMixedContentList'],
          });
        }
        return ret?.data;
      } catch (error) {
        console.warn(error);
        return {
          code: 500,
          message: error + '',
        };
      }
    },
  });

  return { uploadDocument: mutateAsync, loading, data };
};

export const useNextWebCrawl = () => {
  const { knowledgeId } = useGetKnowledgeSearchParams();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['webCrawl'],
    mutationFn: async ({ name, url }: { name: string; url: string }) => {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('url', url);
      formData.append('kb_id', knowledgeId);

      const ret = await kbService.web_crawl(formData);
      const code = get(ret, 'data.code');
      if (code === 0) {
        message.success(i18n.t('message.uploaded'));
      }

      return code;
    },
  });

  return {
    data,
    loading,
    webCrawl: mutateAsync,
  };
};

export const useRunNextDocument = () => {
  const queryClient = useQueryClient();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['runDocumentByIds'],
    mutationFn: async ({
      documentIds,
      run,
      shouldDelete,
    }: {
      documentIds: string[];
      run: number;
      shouldDelete: boolean;
    }) => {
      const ret = await kbService.document_run({
        doc_ids: documentIds,
        run,
        delete: shouldDelete,
      });
      const code = get(ret, 'data.code');
      if (code === 0) {
        // queryClient.invalidateQueries({ queryKey: ['fetchDocumentList'] });
        queryClient.invalidateQueries({ queryKey: ['fetchMixedContentList'] });
        message.success(i18n.t('message.operated'));
      }

      return code;
    },
  });

  return { runDocumentByIds: mutateAsync, loading, data };
};

export const useFetchDocumentInfosByIds = () => {
  const [ids, setDocumentIds] = useState<string[]>([]);

  const idList = useMemo(() => {
    return ids.filter((x) => typeof x === 'string' && x !== '');
  }, [ids]);

  const { data } = useQuery<IDocumentInfo[]>({
    queryKey: ['fetchDocumentInfos', idList],
    enabled: idList.length > 0,
    initialData: [],
    queryFn: async () => {
      const { data } = await kbService.document_infos({ doc_ids: idList });
      if (data.code === 0) {
        return data.data;
      }

      return [];
    },
  });

  return { data, setDocumentIds };
};

export const useFetchDocumentThumbnailsByIds = () => {
  const [ids, setDocumentIds] = useState<string[]>([]);
  const { data } = useQuery<Record<string, string>>({
    queryKey: ['fetchDocumentThumbnails', ids],
    enabled: ids.length > 0,
    initialData: {},
    queryFn: async () => {
      const { data } = await kbService.document_thumbnails({ doc_ids: ids });
      if (data.code === 0) {
        return data.data;
      }
      return {};
    },
  });

  return { data, setDocumentIds };
};

export const useRemoveNextDocument = () => {
  const queryClient = useQueryClient();
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['removeDocument'],
    mutationFn: async (documentIds: string | string[]) => {
      const { data } = await kbService.document_rm({ doc_id: documentIds });
      if (data.code === 0) {
        message.success(i18n.t('message.deleted'));
        // queryClient.invalidateQueries({ queryKey: ['fetchDocumentList'] });
        queryClient.invalidateQueries({ queryKey: ['fetchMixedContentList'] });
      }
      return data.code;
    },
  });

  return { data, loading, removeDocument: mutateAsync };
};

export const useDeleteDocument = () => {
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['deleteDocument'],
    mutationFn: async (documentIds: string[]) => {
      const data = await kbService.document_delete({ doc_ids: documentIds });

      return data;
    },
  });

  return { data, loading, deleteDocument: mutateAsync };
};

export const useUploadAndParseDocument = (uploadMethod: string) => {
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['uploadAndParseDocument'],
    mutationFn: async ({
      conversationId,
      fileList,
    }: {
      conversationId: string;
      fileList: UploadFile[];
    }) => {
      try {
        const formData = new FormData();
        formData.append('conversation_id', conversationId);
        fileList.forEach((file: UploadFile) => {
          formData.append('file', file as any);
        });
        if (uploadMethod === 'upload_and_parse') {
          const data = await kbService.upload_and_parse(formData);
          return data?.data;
        }
        const data = await chatService.uploadAndParseExternal(formData);
        return data?.data;
      } catch (error) {}
    },
  });

  return { data, loading, uploadAndParseDocument: mutateAsync };
};

export const useParseDocument = () => {
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['parseDocument'],
    mutationFn: async (url: string) => {
      try {
        const data = await post(api.parse, { url });
        if (data?.code === 0) {
          message.success(i18n.t('message.uploaded'));
        }
        return data;
      } catch (error) {
        message.error('error');
      }
    },
  });

  return { parseDocument: mutateAsync, data, loading };
};

export const useSetDocumentMeta = () => {
  const queryClient = useQueryClient();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['setDocumentMeta'],
    mutationFn: async (params: IDocumentMetaRequestBody) => {
      try {
        const { data } = await kbService.setMeta({
          meta: params.meta,
          doc_id: params.documentId,
        });

        if (data?.code === 0) {
          // queryClient.invalidateQueries({ queryKey: ['fetchDocumentList'] });
          queryClient.invalidateQueries({
            queryKey: ['fetchMixedContentList'],
          });

          message.success(i18n.t('message.modified'));
        }
        return data?.code;
      } catch (error) {
        message.error('error');
      }
    },
  });

  return { setDocumentMeta: mutateAsync, data, loading };
};

// 新的hook：同时获取文件夹和文档数据
export const useFetchMixedContentList = () => {
  const { knowledgeId } = useGetKnowledgeSearchParams();
  const { searchString, handleInputChange } = useHandleSearchChange();
  const { pagination, setPagination } = useGetPaginationWithRouter();
  const { id } = useParams();

  // 从URL参数获取当前目录ID
  const [searchParams, setSearchParams] = useSearchParams();
  const currentDirectoryId = searchParams.get('directory_id') || undefined;

  // 获取当前目录信息和完整路径
  const { data: directoryPath } = useQuery({
    queryKey: ['directoryPath', currentDirectoryId],
    queryFn: async () => {
      if (!currentDirectoryId) return [];

      const kbId = knowledgeId || id;
      // 获取所有目录，不限制parent_id
      const { data } = await directoryManagerService.listDirectories({
        kb_id: kbId,
        get_all: true, // 获取所有目录用于构建完整路径
      });

      if (data.code === 0) {
        const directories = data.data || [];
        const directoryMap = new Map(
          directories.map((dir: any) => [dir.id, dir]),
        );

        // 构建从根目录到当前目录的完整路径
        const path = [];
        let currentId = currentDirectoryId;

        // 向上追溯到根目录
        while (currentId && directoryMap.has(currentId)) {
          const dir = directoryMap.get(currentId) as any;
          path.unshift(dir); // 添加到数组开头
          currentId = dir.parent_id;

          // 防止无限循环
          if (path.length > 10) {
            break;
          }
        }

        return path;
      }
      return [];
    },
    enabled: !!currentDirectoryId && !!(knowledgeId || id),
  });

  const { data, isFetching: loading } = useQuery<{
    items: IMixedItem[];
    total: number;
  }>({
    queryKey: [
      'fetchMixedContentList',
      searchString,
      pagination,
      currentDirectoryId,
    ],
    initialData: { items: [], total: 0 },
    refetchInterval: 15000,
    enabled: !!knowledgeId || !!id,
    queryFn: async () => {
      const kbId = knowledgeId || id;

      try {
        const pageSize = pagination.pageSize;
        const currentPage = pagination.current;
        const globalOffset = (currentPage - 1) * pageSize;

        const fetchDocumentPage = async (page: number) => {
          const ret = await kbService.get_document_list({
            kb_id: kbId,
            keywords: searchString,
            page_size: pageSize,
            page,
            directory_id: currentDirectoryId,
            orderby: 'name',
            desc: false,
          });

          if (ret.data.code === 0) {
            return {
              docs: ret.data.data?.docs || [],
              total: ret.data.data?.total || 0,
            };
          }

          return { docs: [], total: 0 };
        };

        if (searchString) {
          const documentsRes = await fetchDocumentPage(currentPage);
          const mixedItems: IMixedItem[] = documentsRes.docs.map(
            (doc: any) => ({
              ...doc,
              type: 'document',
            }),
          );

          return {
            items: mixedItems,
            total: documentsRes.total,
          };
        }

        const directoriesRes = await directoryManagerService.listDirectories({
          kb_id: kbId,
          parent_id: currentDirectoryId,
        });

        const directories =
          directoriesRes.data.code === 0 ? directoriesRes.data.data || [] : [];
        const directoriesTotal = directories.length;

        const directorySliceStart = Math.min(globalOffset, directoriesTotal);
        const directorySliceEnd = Math.min(
          directorySliceStart + pageSize,
          directoriesTotal,
        );
        const directoriesPage = directories.slice(
          directorySliceStart,
          directorySliceEnd,
        );

        const mixedItems: IMixedItem[] = directoriesPage.map((dir: any) => ({
          id: dir.id,
          name: dir.name,
          type: 'directory',
          create_time: dir.create_time,
          parent_id: dir.parent_id,
          kb_id: dir.kb_id,
        }));

        const remainingSlots = pageSize - mixedItems.length;
        const docStart = Math.max(0, globalOffset - directoriesTotal);

        let documentsTotal = 0;

        if (remainingSlots > 0) {
          const firstDocPage = Math.floor(docStart / pageSize) + 1;
          const withinPageOffset = docStart % pageSize;

          const firstRes = await fetchDocumentPage(firstDocPage);
          documentsTotal = firstRes.total;

          const docs: any[] = firstRes.docs.slice(
            withinPageOffset,
            withinPageOffset + remainingSlots,
          );

          if (docs.length < remainingSlots) {
            const secondRes = await fetchDocumentPage(firstDocPage + 1);
            documentsTotal = Math.max(documentsTotal, secondRes.total);
            docs.push(...secondRes.docs.slice(0, remainingSlots - docs.length));
          }

          docs.forEach((doc: any) => {
            mixedItems.push({
              ...doc,
              type: 'document',
            });
          });
        } else {
          const firstRes = await fetchDocumentPage(1);
          documentsTotal = firstRes.total;
        }

        return {
          items: mixedItems,
          total: directoriesTotal + documentsTotal,
        };
      } catch (error) {
        console.error('获取混合内容失败:', error);
        return {
          items: [],
          total: 0,
        };
      }
    },
  });

  const onInputChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      setPagination({ page: 1 });
      handleInputChange(e);
    },
    [handleInputChange, setPagination],
  );

  // 导航到指定目录
  const navigateToDirectory = useCallback(
    (directoryId?: string) => {
      const newParams = new URLSearchParams(searchParams);
      if (directoryId) {
        newParams.set('directory_id', directoryId);
      } else {
        newParams.delete('directory_id');
      }
      // 同时设置page为1，避免后续setPagination覆盖
      newParams.set('page', '1');
      setSearchParams(newParams);
      // 不要调用setPagination，因为它会用旧的searchParams覆盖新设置的directory_id
      // setPagination({ page: 1 });
    },
    [searchParams, setSearchParams],
  );

  // 返回上级目录
  const navigateToParent = useCallback(() => {
    // 这里需要根据当前目录获取父目录ID
    // 可以通过API获取当前目录信息来得到parent_id
    navigateToDirectory(undefined); // 临时实现：返回根目录
  }, [navigateToDirectory]);

  return {
    searchString,
    mixedItems: data.items,
    pagination: {
      ...pagination,
      total: data.total,
    },
    handleInputChange: onInputChange,
    loading,
    currentDirectoryId,
    directoryPath: directoryPath || [],
    navigateToDirectory,
    navigateToParent,
  };
};
