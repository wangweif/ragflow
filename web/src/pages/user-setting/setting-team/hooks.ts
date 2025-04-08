import { useSetModalState, useShowDeleteConfirm } from '@/hooks/common-hooks';

import {
  useAddTenantUser,
  useAgreeTenant,
  useCreateTenant,
  useDeleteTenantUser,
  useFetchUserInfo,
  useUpdateTenant,
} from '@/hooks/user-setting-hooks';
import { addUser } from '@/services/user-service';
import { Modal } from 'antd';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const useAddUser = () => {
  const { addTenantUser } = useAddTenantUser();

  const {
    visible: addingTenantModalVisible,
    hideModal: hideAddingTenantModal,
    showModal: showAddingTenantModal,
  } = useSetModalState();

  const handleAddUserOk = useCallback(
    async (payload?: {
      email?: string;
      nickname?: string;
      // role?: string;
      teamId?: string;
    }) => {
      // 添加用户
      console.log(payload);
      if (
        payload?.nickname &&
        payload?.email &&
        // payload?.role &&
        payload?.teamId
      ) {
        const { data: res = {}, response } = await addUser(
          payload.teamId,
          payload.email,
          payload.nickname,
          'member',
        );
        hideAddingTenantModal();
      }
    },
    [addTenantUser, hideAddingTenantModal],
  );

  return {
    addingTenantModalVisible,
    hideAddingTenantModal,
    showAddingTenantModal,
    handleAddUserOk,
  };
};

export const useHandleDeleteUser = () => {
  const { deleteTenantUser, loading } = useDeleteTenantUser();
  const showDeleteConfirm = useShowDeleteConfirm();
  const { t } = useTranslation();

  const handleDeleteTenantUser = (userId: string) => () => {
    showDeleteConfirm({
      title: t('setting.sureDelete'),
      onOk: async () => {
        const code = await deleteTenantUser({ userId });
        if (code === 0) {
        }
        return;
      },
    });
  };

  return { handleDeleteTenantUser, loading };
};

export const useHandleAgreeTenant = () => {
  const { agreeTenant } = useAgreeTenant();
  const { deleteTenantUser } = useDeleteTenantUser();
  const { data: user } = useFetchUserInfo();

  const handleAgree = (tenantId: string, isAgree: boolean) => () => {
    if (isAgree) {
      agreeTenant(tenantId);
    } else {
      deleteTenantUser({ tenantId, userId: user.id });
    }
  };

  return { handleAgree };
};

export const useHandleQuitUser = () => {
  const { deleteTenantUser, loading } = useDeleteTenantUser();
  const showDeleteConfirm = useShowDeleteConfirm();
  const { t } = useTranslation();

  const handleQuitTenantUser = (userId: string, tenantId: string) => () => {
    showDeleteConfirm({
      title: t('setting.sureQuit'),
      onOk: async () => {
        deleteTenantUser({ userId, tenantId });
      },
    });
  };

  return { handleQuitTenantUser, loading };
};

export const useCreateTeam = () => {
  const { createTenant, loading } = useCreateTenant();
  // 获取当前用户信息
  const { data: userInfo } = useFetchUserInfo();
  console.log(userInfo);
  const {
    visible: createTeamModalVisible,
    hideModal: hideCreateTeamModal,
    showModal: showCreateTeamModal,
  } = useSetModalState();

  const handleCreateTeamOk = useCallback(
    async (payload?: { name?: string }) => {
      if (payload?.name) {
        await createTenant({
          name: payload.name,
          tenantId: userInfo.id,
        });
        hideCreateTeamModal();
      }
    },
    [createTenant, hideCreateTeamModal, userInfo.id],
  );

  return {
    createTeamModalVisible,
    hideCreateTeamModal,
    showCreateTeamModal,
    handleCreateTeamOk,
    loading,
  };
};

export const useTeamSelection = () => {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const selectTeam = useCallback((teamId: string) => {
    setSelectedTeamId(teamId);
  }, []);

  return {
    selectedTeamId,
    selectTeam,
  };
};

export const useHandleDeleteTeam = () => {
  const { deleteTenantUser, loading } = useDeleteTenantUser();
  const showDeleteConfirm = useShowDeleteConfirm();

  const handleDeleteTeam = (teamId: string) => () => {
    showDeleteConfirm({
      title: '您确定要删除该团队吗',
      onOk: async () => {
        // 在实际应用中，这里应该调用删除团队的API
        // 暂时模拟，使用已有的删除团队成员API
        // 实际中应该替换为删除团队的方法
        await deleteTenantUser({ userId: teamId, tenantId: teamId });
      },
    });
  };

  return { handleDeleteTeam, loading };
};

export const useEditTeam = () => {
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const { updateTenant, loading: updateLoading } = useUpdateTenant();
  const {
    visible: editTeamModalVisible,
    hideModal: hideEditTeamModal,
    showModal: showEditTeamModal,
  } = useSetModalState();

  const startEditTeam = useCallback(
    (teamId: string) => {
      console.log('teamId', teamId);
      setEditingTeamId(teamId);
      showEditTeamModal();
    },
    [showEditTeamModal],
  );

  const handleEditTeamOk = useCallback(
    async (payload?: { name?: string }) => {
      if (payload?.name && editingTeamId) {
        try {
          await updateTenant({ tenantId: editingTeamId, name: payload.name });
          hideEditTeamModal();
          setEditingTeamId(null);
        } catch (error) {
          console.error('更新团队名称失败', error);
          Modal.error({
            title: '更新失败',
            content: '更新团队名称失败',
          });
        }
      }
    },
    [editingTeamId, hideEditTeamModal, updateTenant],
  );

  return {
    editTeamModalVisible,
    hideEditTeamModal,
    startEditTeam,
    handleEditTeamOk,
    editingTeamId,
    loading: updateLoading,
  };
};
