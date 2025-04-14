import { useListTeamUser } from '@/hooks/user-setting-hooks';
import { ITenantUser } from '@/interfaces/database/user-setting';
import { DeleteOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import { Button, Table, Tag } from 'antd';
import { upperFirst } from 'lodash';
import { useEffect } from 'react';
import { TenantRole } from '../constants';
import { useHandleRemoveTeamMember } from './hooks';

const ColorMap = {
  [TenantRole.Normal]: 'green',
  [TenantRole.Invite]: 'orange',
  [TenantRole.Owner]: 'red',
};

interface UserTableProps {
  teamId?: string | null;
  onRefresh?: (refreshFunc: () => void) => void;
  team: any;
}

const UserTable = ({ team, onRefresh }: UserTableProps) => {
  const teamId = team.id;
  const { data, loading, refetch } = useListTeamUser(teamId);
  console.log('memberlist: ', data);
  const { handleRemoveTeamUser } = useHandleRemoveTeamMember(() => {
    refetch();
  });

  // 将refetch函数传递给父组件
  useEffect(() => {
    if (onRefresh && refetch) {
      onRefresh(refetch);
    }
  }, [onRefresh, refetch]);

  // const [filteredData, setFilteredData] = useState<ITenantUser[]>([]);

  // // 根据选中的团队ID过滤用户数据
  // useEffect(() => {
  //   if (team.team) {
  //     const users = team.team.members;
  //     // 根据用户ids 批量从api获取用户信息 TODO
  //     setFilteredData(data);
  //   } else {
  //     setFilteredData(data);
  //   }
  // }, [data, team.id]);

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
    // {
    //   title: '更新日期',
    //   dataIndex: 'update_date',
    //   key: 'update_date',
    //   render(value) {
    //     return formatDate(value);
    //   },
    // },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="text" onClick={handleRemoveTeamUser(teamId, record.id)}>
          <DeleteOutlined size={20} />
        </Button>
      ),
    },
  ];

  return (
    <Table<ITenantUser>
      rowKey={'id'}
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={false}
    />
  );
};

export default UserTable;
