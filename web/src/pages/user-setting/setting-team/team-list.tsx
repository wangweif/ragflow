import { useListSubTeams, useListTenant } from '@/hooks/user-setting-hooks';
import { ITeam } from '@/interfaces/database/user-setting';

import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import { Button, Space, Table, Tooltip } from 'antd';
import { useHandleDeleteTeam } from './hooks';

interface TeamListProps {
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  startEditTeam: (teamId: string) => void;
}

const TeamList = ({
  selectedTeamId,
  onSelectTeam,
  startEditTeam,
}: TeamListProps) => {
  // 如果有selectedTeamId，获取子团队，否则获取所有顶级团队
  const { data: subTeams, loading: subTeamsLoading } =
    useListSubTeams(selectedTeamId);
  const { data: allTeams, loading: allTeamsLoading } = useListTenant();
  // 从allTeams中获取所有顶级团队
  const topTeams = allTeams?.filter((team) => team.parent_id === null);
  const { handleDeleteTeam } = useHandleDeleteTeam();

  const columns: TableProps<ITeam>['columns'] = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (value, record) => (
        <a onClick={() => onSelectTeam(record.id)}>{value}</a>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Tooltip title={'编辑'}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                console.log('点击编辑按钮', record.id);
                startEditTeam(record.id);
              }}
            />
          </Tooltip>

          <Tooltip title={'删除'}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDeleteTeam(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 根据是否有selectedTeamId决定显示子团队还是所有顶级团队
  const tableData = selectedTeamId ? subTeams : topTeams;
  const loading = selectedTeamId ? subTeamsLoading : allTeamsLoading;

  return (
    <Table<ITeam>
      rowKey={'id'}
      columns={columns}
      dataSource={tableData}
      loading={loading}
      pagination={false}
      rowClassName={(record) =>
        record.id === selectedTeamId ? 'ant-table-row-selected' : ''
      }
    />
  );
};

export default TeamList;
