import { useListTenantUser } from '@/hooks/user-setting-hooks';
import { ITenantUser } from '@/interfaces/database/user-setting';
import { formatDate } from '@/utils/date';
import { DeleteOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import { Button, Table, Tag } from 'antd';
import { upperFirst } from 'lodash';
import { useEffect, useState } from 'react';
import { TenantRole } from '../constants';
import { useHandleDeleteUser } from './hooks';

const ColorMap = {
  [TenantRole.Normal]: 'green',
  [TenantRole.Invite]: 'orange',
  [TenantRole.Owner]: 'red',
};

interface UserTableProps {
  teamId?: string | null;
}

const UserTable = (team: any) => {
  const { data, loading } = useListTenantUser();
  console.log(data);
  const { handleDeleteTenantUser } = useHandleDeleteUser();
  const [filteredData, setFilteredData] = useState<ITenantUser[]>([]);

  // 根据选中的团队ID过滤用户数据
  useEffect(() => {
    if (team.team) {
      const users = team.team.members;
      // 根据用户ids 批量从api获取用户信息 TODO
      setFilteredData(data);
    } else {
      setFilteredData(data);
    }
  }, [data, team.id]);

  const columns: TableProps<ITenantUser>['columns'] = [
    {
      title: '名称',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render(value, { role }) {
        return (
          <Tag color={ColorMap[role as keyof typeof ColorMap]}>
            {upperFirst(role)}
          </Tag>
        );
      },
    },
    {
      title: '更新日期',
      dataIndex: 'update_date',
      key: 'update_date',
      render(value) {
        return formatDate(value);
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="text" onClick={handleDeleteTenantUser(record.user_id)}>
          <DeleteOutlined size={20} />
        </Button>
      ),
    },
  ];

  return (
    <Table<ITenantUser>
      rowKey={'user_id'}
      columns={columns}
      dataSource={filteredData}
      loading={loading}
      pagination={false}
    />
  );
};

export default UserTable;
