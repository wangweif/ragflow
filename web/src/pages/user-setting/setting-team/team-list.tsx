import { useListTenant } from '@/hooks/user-setting-hooks';
import { ITenant } from '@/interfaces/database/user-setting';

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
  console.log(data);
  const { handleDeleteTeam } = useHandleDeleteTeam();
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchMemberCounts = async () => {
      if (data) {
        const counts: Record<string, number> = {};
        for (const team of data) {
          console.log(Object.keys(team.members).length);
          counts[team.id] = Object.keys(team.members).length;
          console.log(counts[team.id]);
        }
        setMemberCounts(counts);
      }
    };

    fetchMemberCounts();
  }, [data]);

  const columns: TableProps<ITenant>['columns'] = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (value, record) => (
        <a onClick={() => onSelectTeam(record.id)}>{value}</a>
      ),
    },
    {
      title: '部门成员',
      key: 'memberCount',
      render: (_, record) => (
        <Space>
          <TeamOutlined />
          {memberCounts[record.id] || 0}
        </Space>
      ),
    },
    // {
    //   title: '更新日期',
    //   dataIndex: 'update_date',
    //   key: 'update_date',
    //   render: (value) => formatDate(value),
    // },
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
      rowKey={'id'}
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={false}
      rowClassName={(record) =>
        record.id === selectedTeamId ? 'ant-table-row-selected' : ''
      }
    />
  );
};

export default TeamList;
