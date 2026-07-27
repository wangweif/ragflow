import { useFetchUserInfo, useListTenant } from '@/hooks/user-setting-hooks';
import { Breadcrumb, Button, Card, Empty, Space, Typography } from 'antd';

import {
  ArrowLeftOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useRef, useState } from 'react';
import AddTeamModal from './add-team-modal';
import AddingUserModal from './add-user-modal';
import EditTeamModal from './edit-team-modal';
import {
  useAddUser,
  useCreateTeam,
  useEditTeam,
  useTeamSelection,
} from './hooks';
import styles from './index.less';
import TeamList from './team-list';
import UserTable from './user-table';

const { Text } = Typography;
const iconStyle = { fontSize: 20, color: '#1890ff' };

// 团队导航路径接口
interface TeamPath {
  id: string;
  name: string;
}

const UserSettingTeam = () => {
  const { data: userInfo } = useFetchUserInfo();
  const { selectedTeamId, selectTeam } = useTeamSelection();
  const { data: teams } = useListTenant();
  const userTableRefreshRef = useRef<() => void | undefined>();

  // 团队导航路径
  const [teamPath, setTeamPath] = useState<TeamPath[]>([]);

  // 递归查找团队
  const findTeamById = (teamList: any[], teamId: string): any => {
    for (const team of teamList) {
      if (team.id === teamId) {
        return team;
      }
      if (team.children && team.children.length > 0) {
        const found = findTeamById(team.children, teamId);
        if (found) return found;
      }
    }
    return null;
  };

  // 获取当前选中团队
  const getCurrentTeam = () => {
    if (!selectedTeamId || !teams) return '';
    return findTeamById(teams, selectedTeamId);
  };

  // 添加用户相关
  const {
    addingTenantModalVisible,
    hideAddingTenantModal,
    showAddingTenantModal,
    handleAddUserOk,
  } = useAddUser();

  // 处理添加用户确认
  const handleAddUser = (payload: any) => {
    return handleAddUserOk(payload, userTableRefreshRef.current);
  };

  // 创建团队相关
  const {
    createTeamModalVisible,
    hideCreateTeamModal,
    showCreateTeamModal,
    handleCreateTeamOk,
    loading: createTeamLoading,
  } = useCreateTeam();

  // 编辑团队相关
  const {
    editTeamModalVisible,
    hideEditTeamModal,
    handleEditTeamOk,
    editingTeamId,
    loading,
    startEditTeam,
  } = useEditTeam();

  // 团队导航 - 处理选择团队
  const handleSelectTeam = (teamId: string) => {
    // 在团队列表中查找团队
    const selectedTeam = findTeamById(teams, teamId);
    if (selectedTeam) {
      // 更新导航路径
      const newPath = [...teamPath, { id: teamId, name: selectedTeam.name }];
      setTeamPath(newPath);
      selectTeam(teamId);
    }
  };

  // 导航到特定层级的团队
  const navigateToTeam = (index: number) => {
    if (index === -1) {
      // 返回根级别
      selectTeam('');
      setTeamPath([]);
    } else {
      // 返回到指定层级
      const newPath = teamPath.slice(0, index + 1);
      const targetTeamId = newPath[newPath.length - 1].id;
      setTeamPath(newPath);
      selectTeam(targetTeamId);
    }
  };

  // 返回上一级
  const handleBackToParent = () => {
    if (teamPath.length <= 1) {
      // 如果只有一级，返回根目录
      navigateToTeam(-1);
    } else {
      // 返回上一级
      navigateToTeam(teamPath.length - 2);
    }
  };

  const currentTeam = getCurrentTeam();
  const currentTeamName =
    typeof currentTeam === 'object' ? currentTeam?.name || '' : '';

  return (
    <div className={styles.teamWrapper}>
      {/* 导航面包屑 */}
      <Card className={styles.teamHeaderCard} bordered={false}>
        <Breadcrumb
          items={[
            {
              title: '部门列表',
              onClick: () => navigateToTeam(-1),
            },
            ...teamPath.map((item, index) => ({
              title: item.name,
              onClick: () => navigateToTeam(index),
            })),
          ]}
        />
        {selectedTeamId && (
          <Space style={{ marginTop: 16 }}>
            <Button
              type="primary"
              onClick={handleBackToParent}
              icon={<ArrowLeftOutlined />}
            >
              {'返回上级部门'}
            </Button>
          </Space>
        )}
      </Card>

      {/* 子团队列表卡片 */}
      <Card
        title={
          <Space>
            <TeamOutlined style={iconStyle} />
            {selectedTeamId ? `${currentTeamName} - 子部门` : '部门列表'}
          </Space>
        }
        extra={
          <Button
            type="primary"
            onClick={showCreateTeamModal}
            icon={<PlusOutlined />}
          >
            {selectedTeamId ? '创建子部门' : '创建部门'}
          </Button>
        }
        bordered={false}
      >
        <TeamList
          selectedTeamId={selectedTeamId}
          onSelectTeam={handleSelectTeam}
          startEditTeam={startEditTeam}
        />
      </Card>

      {/* 团队成员列表卡片 */}
      {selectedTeamId && (
        <Card
          title={
            <Space>
              <TeamOutlined style={iconStyle} />
              <Text strong className={styles.teamTitle}>
                {currentTeamName && `${currentTeamName} - `}
                {'部门成员'}
              </Text>
            </Space>
          }
          extra={
            <Button
              type="primary"
              onClick={showAddingTenantModal}
              icon={<PlusOutlined />}
            >
              {'添加用户'}
            </Button>
          }
          bordered={false}
        >
          {selectedTeamId ? (
            <UserTable
              team={currentTeam}
              onRefresh={(refreshFunc: () => void) => {
                userTableRefreshRef.current = refreshFunc;
              }}
            />
          ) : (
            <Empty description={'请选择一个部门查看成员'} />
          )}
        </Card>
      )}

      {/* 添加用户模态框 */}
      {addingTenantModalVisible && (
        <AddingUserModal
          visible
          hideModal={hideAddingTenantModal}
          onOk={handleAddUser}
          teamId={selectedTeamId ?? ''}
        />
      )}

      {/* 创建团队模态框 */}
      {createTeamModalVisible && (
        <AddTeamModal
          visible
          hideModal={hideCreateTeamModal}
          onOk={handleCreateTeamOk}
          loading={createTeamLoading}
          parentId={selectedTeamId}
        />
      )}

      {/* 编辑团队模态框 */}
      {editTeamModalVisible && (
        <EditTeamModal
          visible
          hideModal={hideEditTeamModal}
          onOk={handleEditTeamOk}
          teamId={editingTeamId}
          loading={loading}
        />
      )}
    </div>
  );
};

export default UserSettingTeam;
