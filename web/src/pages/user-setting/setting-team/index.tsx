import {
  useFetchUserInfo,
  useListTenantUser,
} from '@/hooks/user-setting-hooks';
import { Button, Card, Space } from 'antd';
import { useTranslation } from 'react-i18next';

import { PlusOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import AddTeamModal from './add-team-modal';
import AddingUserModal from './add-user-modal';
import { useAddUser, useCreateTeam, useTeamSelection } from './hooks';
import styles from './index.less';
import TeamList from './team-list';
import TenantTable from './tenant-table';
import UserTable from './user-table';

const iconStyle = { fontSize: 20, color: '#1677ff' };

const UserSettingTeam = () => {
  const { data: userInfo } = useFetchUserInfo();
  const { t } = useTranslation();
  const { selectedTeamId, selectTeam } = useTeamSelection();

  // 添加用户相关
  useListTenantUser();
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

  return (
    <div className={styles.teamWrapper}>
      {/* 团队列表和创建团队按钮 */}
      <Card
        title={
          <Space>
            <TeamOutlined style={iconStyle} /> {'团队列表'}
          </Space>
        }
        extra={
          <Button
            type="primary"
            onClick={showCreateTeamModal}
            icon={<PlusOutlined />}
          >
            {'创建团队'}
          </Button>
        }
        bordered={false}
      >
        <TeamList selectedTeamId={selectedTeamId} onSelectTeam={selectTeam} />
      </Card>

      {/* 工作区信息和添加用户按钮 */}
      {/* <Card className={styles.teamCard}>
        <Flex align="center" justify={'space-between'}>
          <Typography.Title level={5}>
            {userInfo.nickname} {t('setting.workspace')}
          </Typography.Title>
          <Button type="primary" onClick={showAddingTenantModal}>
            <UserAddOutlined />
            {"添加用户"}
          </Button>
        </Flex>
      </Card> */}

      {/* 团队成员表格 */}
      <Card
        title={
          <Space>
            <UserOutlined style={iconStyle} /> {'团队成员'}
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
        <UserTable />
      </Card>

      {/* 已加入的团队表格 */}
      <Card
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
    </div>
  );
};

export default UserSettingTeam;
