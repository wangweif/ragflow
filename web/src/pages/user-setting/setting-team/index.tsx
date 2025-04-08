import { useFetchUserInfo, useListTenant } from '@/hooks/user-setting-hooks';
import { Button, Card, Empty, Space, Typography } from 'antd';

import {
  ArrowLeftOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons';
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
const iconStyle = { fontSize: 20, color: '#1677ff' };

const UserSettingTeam = () => {
  const { data: userInfo } = useFetchUserInfo();
  const { selectedTeamId, selectTeam } = useTeamSelection();
  const { data: teams } = useListTenant();

  // 获取当前选中团队
  const getCurrentTeam = () => {
    if (!selectedTeamId || !teams) return '';
    const currentTeam = teams.find((team) => team.id === selectedTeamId);
    return currentTeam;
  };

  // 添加用户相关
  const {
    addingTenantModalVisible,
    hideAddingTenantModal,
    showAddingTenantModal,
    handleAddUserOk,
  } = useAddUser();

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

  // 返回团队列表
  const handleBackToTeamList = () => {
    selectTeam('');
  };

  const currentTeam = getCurrentTeam();
  const currentTeamName =
    typeof currentTeam === 'object' ? currentTeam?.name || '' : '';

  return (
    <div className={styles.teamWrapper}>
      {!selectedTeamId ? (
        // 团队列表视图
        <Card
          title={
            <Space>
              <TeamOutlined style={iconStyle} /> {'部门列表'}
            </Space>
          }
          extra={
            <Button
              type="primary"
              onClick={showCreateTeamModal}
              icon={<PlusOutlined />}
            >
              {'创建部门'}
            </Button>
          }
          bordered={false}
        >
          <TeamList
            selectedTeamId={selectedTeamId}
            onSelectTeam={selectTeam}
            startEditTeam={startEditTeam}
          />
        </Card>
      ) : (
        // 部门成员视图
        <>
          <Card className={styles.teamHeaderCard}>
            <Space>
              <Button
                type="primary"
                onClick={handleBackToTeamList}
                icon={<ArrowLeftOutlined />}
              >
                {'返回部门列表'}
              </Button>
            </Space>
          </Card>
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
              <UserTable team={currentTeam} />
            ) : (
              <Empty description={'请选择一个部门查看成员'} />
            )}
          </Card>
        </>
      )}

      {/* 已加入的团队表格，不显示 */}
      {/* <Card
        title={
          <Space>
            <TeamOutlined style={iconStyle} /> {'已加入的团队'}
          </Space>
        }
        bordered={false}
      >
        <TenantTable />
      </Card>

      {/* 添加用户模态框 */}
      {addingTenantModalVisible && (
        <AddingUserModal
          visible
          hideModal={hideAddingTenantModal}
          onOk={handleAddUserOk}
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
