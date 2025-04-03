import { LlmModelType } from '@/constants/knowledge';
import { useSetModalState } from '@/hooks/common-hooks';
import {
  useFetchKnowledgeBaseConfiguration,
  useUpdateKnowledge,
} from '@/hooks/knowledge-hooks';
import { useSelectLlmOptionsByModelType } from '@/hooks/llm-hooks';
import { useNavigateToDataset } from '@/hooks/route-hook';
import { useSelectParserList } from '@/hooks/user-setting-hooks';
import api from '@/utils/api';
import {
  getBase64FromUploadFileList,
  getUploadFileListFromBase64,
} from '@/utils/file-util';
import { post } from '@/utils/request';
import { useIsFetching } from '@tanstack/react-query';
import { Form, UploadFile, message } from 'antd';
import { FormInstance } from 'antd/lib';
import pick from 'lodash/pick';
import { useCallback, useEffect, useState } from 'react';

export const useSubmitKnowledgeConfiguration = (form: FormInstance) => {
  const { saveKnowledgeConfiguration, loading } = useUpdateKnowledge();
  const navigateToDataset = useNavigateToDataset();
  const [assignLoading, setAssignLoading] = useState(false);

  // 分配知识库权限给用户
  const assignPermission = async (
    knowledgeId: string,
    selectedMemberIds: string[],
  ) => {
    if (!selectedMemberIds.length) return;

    try {
      setAssignLoading(true);

      // 多个用户并行处理
      await Promise.all(
        selectedMemberIds.map(async (userId) => {
          try {
            // 创建知识库用户关系记录
            await post(api.assignKnowledgePermission, {
              kb_id: knowledgeId,
              user_id: userId,
            });
          } catch (error) {
            console.error(`为用户 ${userId} 分配知识库权限失败:`, error);
          }
        }),
      );

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

    // 处理权限和团队成员信息
    const permissionData = {
      ...values,
      avatar,
    };

    // 提取选中的用户ID
    let selectedUserIds: string[] = [];

    // 如果设置了团队权限并选择了特定成员，添加到提交数据中
    if (values.permission === 'team' && values.selectedMembers?.length > 0) {
      selectedUserIds = values.selectedMembers
        .filter((key: string) => key.startsWith('member-'))
        .map((key: string) => key.replace('member-', ''));

      // 将操作权限信息传给后端
      permissionData.operator_permission = selectedUserIds;
    }

    // 保存知识库配置
    const result = await saveKnowledgeConfiguration(permissionData);

    // 如果保存成功且有选中的用户，为他们分配权限
    if (
      result?.code === 0 &&
      values.permission === 'team' &&
      selectedUserIds.length > 0
    ) {
      // 使用知识库ID分配权限
      await assignPermission(
        result.data.id || permissionData.kb_id,
        selectedUserIds,
      );
    }

    navigateToDataset();
  }, [saveKnowledgeConfiguration, form, navigateToDataset]);

  return {
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
