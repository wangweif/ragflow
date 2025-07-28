import { KnowledgeRouteKey } from '@/constants/knowledge';
import { useSetModalState } from '@/hooks/common-hooks';
import { useCreateKnowledge } from '@/hooks/knowledge-hooks';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import api from '@/utils/api';
import { post } from '@/utils/request';
import { useCallback, useState } from 'react';
import { useNavigate } from 'umi';

export const useSearchKnowledge = () => {
  const [searchString, setSearchString] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchString(e.target.value);
  };
  return {
    searchString,
    handleInputChange,
  };
};

export const useSaveKnowledge = () => {
  const { visible: visible, hideModal, showModal } = useSetModalState();
  const { data: userInfo } = useFetchUserInfo();
  const { loading, createKnowledge } = useCreateKnowledge();
  const navigate = useNavigate();

  const onCreateOk = useCallback(
    async (name: string) => {
      const ret = await createKnowledge({
        name,
      });
      // 为创建者赋权
      const permissions = [];
      permissions.push({
        user_id: userInfo.id,
        team_id: ret.data.kb_id,
        permission_types: ['write', 'read'],
      });
      const res = await post(api.assignKnowledgePermission(ret.data.kb_id), {
        permissions,
      });

      if (ret?.code === 0) {
        hideModal();
        navigate(
          `/knowledge/${KnowledgeRouteKey.Configuration}?id=${ret.data.kb_id}`,
        );
      }
    },
    [createKnowledge, hideModal, navigate, userInfo],
  );

  return {
    loading,
    onCreateOk,
    visible,
    hideModal,
    showModal,
  };
};
