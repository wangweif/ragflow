import directoryManagerService from '@/services/directory-manager-service';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'umi';

// 获取当前目录ID的hook
export const useGetDirectoryId = (): string => {
  const [searchParams] = useSearchParams();
  const directoryId = searchParams.get('directory_id');

  // 调试信息
  console.log('=== useGetDirectoryId Debug ===');
  console.log('All URL params:', Object.fromEntries(searchParams.entries()));
  console.log('directory_id param:', searchParams.get('directory_id'));
  console.log('==============================');

  return directoryId || '';
};

export const useCreateDirectory = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['createDirectory'],
    mutationFn: async (params: {
      kb_id: string;
      name: string;
      parent_id?: string;
    }) => {
      const { data } = await directoryManagerService.createDirectory(params);
      if (data.code === 0) {
        message.success(t('message.created'));
        queryClient.invalidateQueries({ queryKey: ['directoryList'] });
        queryClient.invalidateQueries({ queryKey: ['directoryTree'] });
        queryClient.invalidateQueries({ queryKey: ['fetchMixedContentList'] });
      }
      return data.code;
    },
  });

  return { data, loading, createDirectory: mutateAsync };
};

export const useDirectoryList = (kb_id: string, parent_id?: string) => {
  const { data, isFetching: loading } = useQuery({
    queryKey: ['directoryList', kb_id, parent_id],
    queryFn: async () => {
      const { data } = await directoryManagerService.listDirectories({
        kb_id,
        parent_id,
      });
      return data;
    },
    enabled: !!kb_id,
  });

  return { data, loading };
};

export const useDirectoryTree = (kb_id: string) => {
  const { data, isFetching: loading } = useQuery({
    queryKey: ['directoryTree', kb_id],
    queryFn: async () => {
      const { data } = await directoryManagerService.getDirectoryTree({
        kb_id,
      });
      return data;
    },
    enabled: !!kb_id,
  });

  return { data, loading };
};

export const useRenameDirectory = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['renameDirectory'],
    mutationFn: async (params: { directory_id: string; name: string }) => {
      const { data } = await directoryManagerService.renameDirectory(params);
      if (data.code === 0) {
        message.success(t('message.modified'));
        queryClient.invalidateQueries({ queryKey: ['directoryList'] });
        queryClient.invalidateQueries({ queryKey: ['directoryTree'] });
        queryClient.invalidateQueries({ queryKey: ['fetchMixedContentList'] });
      }
      return data.code;
    },
  });

  return { data, loading, renameDirectory: mutateAsync };
};

export const useDeleteDirectory = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['deleteDirectory'],
    mutationFn: async (params: { directory_id: string }) => {
      const { data } = await directoryManagerService.deleteDirectory(params);
      if (data.code === 0) {
        message.success(t('message.deleted'));
        queryClient.invalidateQueries({ queryKey: ['directoryList'] });
        queryClient.invalidateQueries({ queryKey: ['directoryTree'] });
        queryClient.invalidateQueries({ queryKey: ['fetchMixedContentList'] });
      }
      return data.code;
    },
  });

  return { data, loading, deleteDirectory: mutateAsync };
};
