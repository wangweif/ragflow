import { LlmModelType } from '@/constants/knowledge';
import { useSetModalState } from '@/hooks/common-hooks';
import {
  useFetchKnowledgeBaseConfiguration,
  useUpdateKnowledge,
} from '@/hooks/knowledge-hooks';
import { useSelectLlmOptionsByModelType } from '@/hooks/llm-hooks';
import { useNavigateToDataset } from '@/hooks/route-hook';
import {
  useFetchUserInfo,
  useSelectParserList,
} from '@/hooks/user-setting-hooks';
import api from '@/utils/api';
import {
  getBase64FromUploadFileList,
  getUploadFileListFromBase64,
} from '@/utils/file-util';
import { get, post } from '@/utils/request';
import { useIsFetching } from '@tanstack/react-query';
import { Form, UploadFile, message } from 'antd';
import { FormInstance } from 'antd/lib';
import pick from 'lodash/pick';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'umi';

// 获取知识库ID
export const useKnowledgeBaseId = (): string => {
  const [searchParams] = useSearchParams();
  const knowledgeBaseId = searchParams.get('id');

  return knowledgeBaseId || '';
};

export const useSubmitKnowledgeConfiguration = (form: FormInstance) => {
  const { saveKnowledgeConfiguration, loading } = useUpdateKnowledge();
  const { data: userInfo } = useFetchUserInfo();
  const navigateToDataset = useNavigateToDataset();
  const [assignLoading, setAssignLoading] = useState(false);
  const knowledgeBaseId = useKnowledgeBaseId();
  const teamId = Form.useWatch('team_id', form);

  // 分配知识库权限给用户
  const assignPermission = async (
    selectedMembers: Record<string, Set<string>>,
  ) => {
    try {
      setAssignLoading(true);
      // 将所有用户信息和权限添加到数组中
      const permissions = [];
      for (const [userId, permission_types] of Object.entries(
        selectedMembers,
      )) {
        permissions.push({
          user_id: userId,
          team_id: teamId,
          permission_types: Array.from(permission_types),
        });
      }
      // 为管理员赋权
      permissions.push({
        user_id: userInfo.id,
        team_id: teamId,
        permission_types: ['write', 'read'],
      });
      await post(api.assignKnowledgePermission(knowledgeBaseId), {
        permissions,
      });
      message.success('知识库权限分配成功');
    } catch (error) {
      console.error('分配知识库权限过程中出错:', error);
      message.error('知识库权限分配失败');
    } finally {
      setAssignLoading(false);
    }
  };

  const submitKnowledgeConfiguration = useCallback(async () => {
    const values = await form.validateFields();
    const avatar = await getBase64FromUploadFileList(values.avatar);

    // 移出values中的selectedMembers,以便直接调用原始的更新api
    const { selectedMembers, ...rest } = values;

    // 处理权限和团队成员信息
    await saveKnowledgeConfiguration({
      ...rest,
      avatar,
      permission: 'team',
    });

    //为选中的用户分配权限
    if (selectedMembers?.length > 0) {
      // 数据预处理
      const result: Record<string, Set<string>> = {};
      selectedMembers.forEach((key: string) => {
        const matches = key.match(/^member-(.+?)(?:-(read|write))?$/);
        if (!matches) return;

        const [, userId, permission] = matches;

        // 初始化用户的权限集合（如果尚未存在）
        if (!result[userId]) {
          result[userId] = new Set();
        }
        if (permission) {
          if (permission === 'write') {
            result[userId].add('read');
          }
          result[userId].add(permission);
        }
      });

      // 分配权限
      await assignPermission(result);
    }

    navigateToDataset();
  }, [saveKnowledgeConfiguration, form, navigateToDataset]);

  return {
    assignPermission,
    submitKnowledgeConfiguration,
    submitLoading: loading || assignLoading,
    navigateToDataset,
  };
};

// The value that does not need to be displayed in the analysis method Select
const HiddenFields = ['email', 'picture', 'audio'];

export function useSelectChunkMethodList() {
  const parserList = useSelectParserList();

  return parserList.filter((x) => !HiddenFields.some((y) => y === x.value));
}

export function useSelectEmbeddingModelOptions() {
  const allOptions = useSelectLlmOptionsByModelType();
  return allOptions[LlmModelType.Embedding];
}

export function useHasParsedDocument() {
  const { data: knowledgeDetails } = useFetchKnowledgeBaseConfiguration();
  return knowledgeDetails.chunk_num > 0;
}

export const useFetchKnowledgeConfigurationOnMount = (form: FormInstance) => {
  const { data: knowledgeDetails } = useFetchKnowledgeBaseConfiguration();

  useEffect(() => {
    const fileList: UploadFile[] = getUploadFileListFromBase64(
      knowledgeDetails.avatar,
    );

    // 设置初始表单数据
    const initialValues = {
      ...pick(knowledgeDetails, [
        'description',
        'name',
        'permission',
        'embd_id',
        'parser_id',
        'language',
        'parser_config',
        'pagerank',
      ]),
      avatar: fileList,
    };

    // 如果存在团队成员权限数据，初始化树选择
    if (
      knowledgeDetails.operator_permission &&
      knowledgeDetails.permission === 'team'
    ) {
      const operatorPermission = Array.isArray(
        knowledgeDetails.operator_permission,
      )
        ? knowledgeDetails.operator_permission
        : [];

      // 设置选定的成员
      if (operatorPermission.length > 0) {
        // @ts-ignore - 忽略类型错误，因为我们知道表单结构
        initialValues.selectedMembers = operatorPermission.map(
          (id: string) => `member-${id}`,
        );
      }
    }

    form.setFieldsValue(initialValues);
  }, [form, knowledgeDetails]);

  return knowledgeDetails;
};

export const useSelectKnowledgeDetailsLoading = () =>
  useIsFetching({ queryKey: ['fetchKnowledgeDetail'] }) > 0;

export const useHandleChunkMethodChange = () => {
  const [form] = Form.useForm();
  const chunkMethod = Form.useWatch('parser_id', form);

  useEffect(() => {
    console.log('🚀 ~ useHandleChunkMethodChange ~ chunkMethod:', chunkMethod);
  }, [chunkMethod]);

  return { form, chunkMethod };
};

export const useRenameKnowledgeTag = () => {
  const [tag, setTag] = useState<string>('');
  const {
    visible: tagRenameVisible,
    hideModal: hideTagRenameModal,
    showModal: showFileRenameModal,
  } = useSetModalState();

  const handleShowTagRenameModal = useCallback(
    (record: string) => {
      setTag(record);
      showFileRenameModal();
    },
    [showFileRenameModal],
  );

  return {
    initialName: tag,
    tagRenameVisible,
    hideTagRenameModal,
    showTagRenameModal: handleShowTagRenameModal,
  };
};

export const useKnowledgePermissions = (knowledgeBaseId: string) => {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!knowledgeBaseId) return;

      try {
        setLoading(true);
        const response = await get(
          api.getKnowledgePermissions(knowledgeBaseId),
        );
        if (response.data.code === 0) {
          const permData = response.data.data || [];
          setPermissions(permData);

          // 根据权限数据生成需要选中的节点
          const selectedKeys: string[] = [];
          permData.forEach((perm: any) => {
            if (perm.user_id) {
              selectedKeys.push(
                `member-${perm.user_id}-${perm.permission_type}`,
              );
            }
          });
          setCheckedKeys(selectedKeys);
        } else {
          console.error('获取知识库权限失败:', response.message);
        }
      } catch (error) {
        console.error('获取知识库权限失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [knowledgeBaseId]);

  return { permissions, loading, checkedKeys };
};
