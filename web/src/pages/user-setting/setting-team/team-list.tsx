import { useListTenant } from '@/hooks/user-setting-hooks';
import { ITenant } from '@/interfaces/database/user-setting';
import { listTenantUser } from '@/services/user-service';
import { formatDate } from '@/utils/date';

import { DeleteOutlined, EditOutlined, TeamOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import { Button, Space, Table, Tooltip } from 'antd';
import { useEffect, useState } from 'react';
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
  const { data, loading } = useListTenant();
  const { handleDeleteTeam } = useHandleDeleteTeam();
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  // 获取团队成员数量
  const getMemberCount = async (teamId: string) => {
    const { data } = await listTenantUser(teamId);
    return data?.data?.length || 0;
  };

  useEffect(() => {
    const fetchMemberCounts = async () => {
      if (data) {
        const counts: Record<string, number> = {};
        for (const team of data) {
          counts[team.tenant_id] = await getMemberCount(team.tenant_id);
        }
        setMemberCounts(counts);
      }
    };

    fetchMemberCounts();
  }, [data]);

  const columns: TableProps<ITenant>['columns'] = [
    {
      title: '名称',
      dataIndex: 'nickname',
      key: 'nickname',
      render: (value, record) => (
        <a onClick={() => onSelectTeam(record.tenant_id)}>{value}</a>
      ),
    },
    {
      title: '团队成员',
      key: 'memberCount',
      render: (_, record) => (
        <Space>
          <TeamOutlined />
          {memberCounts[record.tenant_id] || 0}
        </Space>
      ),
    },
    {
      title: '更新日期',
      dataIndex: 'update_date',
      key: 'update_date',
      render: (value) => formatDate(value),
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
                console.log('点击编辑按钮', record.tenant_id);
                startEditTeam(record.tenant_id);
              }}
            />
          </Tooltip>

          <Tooltip title={'删除'}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDeleteTeam(record.tenant_id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Table<ITenant>
      rowKey={'tenant_id'}
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={false}
      rowClassName={(record) =>
        record.tenant_id === selectedTeamId ? 'ant-table-row-selected' : ''
      }
    />
  );
};

export default TeamList;
